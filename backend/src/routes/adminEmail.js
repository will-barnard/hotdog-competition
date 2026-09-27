const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { pool } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const email = require('../services/email');
const { officialSql } = require('../services/seasons');

const router = express.Router();

// Photos for bulk emails. They're shown inline in the email body via a public
// URL (not sent as attachments): one small file on our server instead of a
// copy inside every email, and queued emails keep working because the queue
// only stores the HTML. Lives in the persistent uploads volume.
const emailImagesDir = path.join(__dirname, '../../uploads/email');
fs.mkdirSync(emailImagesDir, { recursive: true });
const EMAIL_IMAGE_PATH = /^\/uploads\/email\/[a-f0-9]{32}\.jpg$/;

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(Object.assign(new Error('Only JPEG, PNG, WebP or GIF images are allowed'), { status: 400 }));
  }
}).single('image');

// Email clients fetch the image from the live site, so it needs an absolute
// URL. Same fallback chain as the password-reset links.
function publicBaseUrl() {
  const base = process.env.FRONTEND_URL || process.env.ALLOWED_ORIGINS?.split(',')[0]?.trim() || 'https://hotdogcompetition.com';
  return base.replace(/\/+$/, '');
}

function photoHtml(imagePath) {
  const src = publicBaseUrl() + imagePath;
  return `<p style="margin:16px 0;"><img src="${src}" alt="" width="600" style="display:block; width:100%; max-width:600px; height:auto; border:0; border-radius:8px;" /></p>`;
}

// POST /api/admin/email/image — upload a photo for the next bulk email
router.post('/image', authenticateToken, requireAdmin, (req, res) => {
  imageUpload(req, res, async (uploadErr) => {
    if (uploadErr) {
      const tooBig = uploadErr.code === 'LIMIT_FILE_SIZE';
      return res.status(tooBig ? 413 : (uploadErr.status || 400)).json({
        error: tooBig ? 'Photo is too large (15 MB max)' : uploadErr.message
      });
    }
    if (!req.file) return res.status(400).json({ error: 'No photo uploaded' });

    try {
      const filename = crypto.randomBytes(16).toString('hex') + '.jpg';
      // JPEG, not WebP: Outlook and some older mail apps can't show WebP.
      // 1200px wide covers retina at the 600px email width; rotate() applies
      // the phone's EXIF orientation; flatten() gives transparent PNGs a white
      // background instead of black.
      await sharp(req.file.buffer)
        .rotate()
        .resize({ width: 1200, withoutEnlargement: true })
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: 82, mozjpeg: true })
        .toFile(path.join(emailImagesDir, filename));

      const imagePath = `/uploads/email/${filename}`;
      res.status(201).json({ path: imagePath, url: publicBaseUrl() + imagePath });
    } catch (err) {
      console.error('Email image upload error:', err);
      res.status(400).json({ error: "Couldn't read that image — try a JPEG or PNG" });
    }
  });
});

// GET /api/admin/email/status — daily limit status
router.get('/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const sentToday = await email.getSentToday();
    const queueResult = await pool.query(
      `SELECT COUNT(*)::int AS pending FROM email_queue WHERE status = 'pending'`
    );
    res.json({
      enabled: email.isEnabled(),
      daily_limit: email.DAILY_LIMIT,
      sent_today: sentToday,
      remaining_today: Math.max(0, email.DAILY_LIMIT - sentToday),
      queued: queueResult.rows[0].pending,
    });
  } catch (err) {
    console.error('Email status error:', err);
    res.status(500).json({ error: 'Failed to get email status' });
  }
});

// POST /api/admin/email/bulk — send a bulk email to all or a group of users
// Works out who a bulk email goes to, after optional skips:
//  - skip_already_sent: anyone Resend has on record as having been sent an
//    email with this exact subject in the last 7 days (catches a send that
//    was cut short — rejected emails never reach Resend's log), plus anyone
//    already waiting in our own queue for this subject.
//  - exclude_emails: addresses pasted by the admin (fallback when the Resend
//    key isn't allowed to read the log).
async function resolveRecipients({ group, subject, skip_already_sent, exclude_emails }) {
  let query = 'SELECT email FROM users';
  // Official = official in the current season
  if (group === 'official') query += ` WHERE ${officialSql('users.id')}`;
  else if (group === 'exhibition') query += ` WHERE NOT ${officialSql('users.id')}`;
  else if (group === 'admin') query += ' WHERE is_admin = TRUE';
  // 'all' or undefined = everyone
  const result = await pool.query(query);
  const all = result.rows.map(r => r.email);

  const norm = e => String(e).trim().toLowerCase();
  const alreadyGot = new Set();
  const manual = new Set(
    (Array.isArray(exclude_emails) ? exclude_emails : String(exclude_emails || '').split(/[\s,;]+/))
      .map(norm).filter(e => e.includes('@'))
  );

  if (skip_already_sent) {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const sentRows = await email.listSentSince(since);
    // While we have Resend's log in hand, correct today's sent counter — it
    // over-counted rejected sends before this fix.
    await email.syncSentTodayFrom(sentRows);
    for (const row of sentRows) {
      if (row.subject === subject) (row.to || []).forEach(t => alreadyGot.add(norm(t)));
    }
    const pending = await pool.query(
      `SELECT recipient FROM email_queue WHERE status = 'pending' AND subject = $1`, [subject]
    );
    pending.rows.forEach(r => alreadyGot.add(norm(r.recipient)));
  }

  const recipients = [];
  let skippedAlready = 0;
  let skippedManual = 0;
  for (const e of all) {
    if (alreadyGot.has(norm(e))) skippedAlready++;
    else if (manual.has(norm(e))) skippedManual++;
    else recipients.push(e);
  }
  return { group_total: all.length, skipped_already_received: skippedAlready, skipped_excluded: skippedManual, recipients };
}

// POST /api/admin/email/bulk — send a bulk email to all or a group of users.
// dry_run: true returns who it WOULD go to (and today's remaining quota)
// without sending anything.
router.post('/bulk', authenticateToken, requireAdmin, async (req, res) => {
  const { subject, html, group, image_path, image_position, dry_run } = req.body;
  // group: 'all', 'official', 'exhibition', 'admin'
  // image_path: from POST /image; image_position: 'above' (default) | 'below'

  if (!subject) return res.status(400).json({ error: 'A subject is required' });
  if (!dry_run && !html && !image_path) {
    return res.status(400).json({ error: 'A subject and a message or photo are required' });
  }

  let body = html || '';
  if (image_path) {
    // Only accept paths this server generated, so nothing else can be injected
    // into the email markup.
    if (!EMAIL_IMAGE_PATH.test(image_path) ||
        !fs.existsSync(path.join(emailImagesDir, path.basename(image_path)))) {
      return res.status(400).json({ error: 'That photo is no longer available — please re-attach it' });
    }
    body = image_position === 'below' ? body + photoHtml(image_path) : photoHtml(image_path) + body;
  }

  if (!email.isEnabled()) {
    return res.status(503).json({ error: 'Email service is not configured' });
  }

  try {
    const r = await resolveRecipients(req.body);
    const summary = {
      group_total: r.group_total,
      skipped_already_received: r.skipped_already_received,
      skipped_excluded: r.skipped_excluded,
      total_recipients: r.recipients.length
    };

    if (dry_run) {
      const sentToday = await email.getSentToday();
      return res.json({
        ...summary,
        recipients: r.recipients,
        remaining_today: Math.max(0, email.DAILY_LIMIT - sentToday)
      });
    }

    if (r.recipients.length === 0) {
      return res.json({ ...summary, sent: 0, queued: 0, failed: 0, failed_recipients: [] });
    }

    const stats = await email.sendBulk(r.recipients, subject, body);
    res.json({ ...summary, ...stats });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('Bulk email error:', err);
    res.status(500).json({ error: 'Failed to send bulk email' });
  }
});

// GET /api/admin/email/welcome — get welcome email config
router.get('/welcome', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT key, value FROM settings WHERE key IN ('welcome_email_enabled', 'welcome_email_delay_minutes', 'welcome_email_subject', 'welcome_email_body')`
    );
    const config = {};
    result.rows.forEach(r => { config[r.key] = r.value; });

    res.json({
      enabled: config.welcome_email_enabled === 'true',
      delay_minutes: parseInt(config.welcome_email_delay_minutes) || 30,
      subject: config.welcome_email_subject || '',
      body: config.welcome_email_body || '',
    });
  } catch (err) {
    console.error('Welcome email config error:', err);
    res.status(500).json({ error: 'Failed to get welcome email config' });
  }
});

// PUT /api/admin/email/welcome — update welcome email config
router.put('/welcome', authenticateToken, requireAdmin, async (req, res) => {
  const { enabled, delay_minutes, subject, body } = req.body;

  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled must be a boolean' });
  }

  const delayMin = parseInt(delay_minutes);
  if (isNaN(delayMin) || delayMin < 1 || delayMin > 10080) {
    return res.status(400).json({ error: 'delay_minutes must be between 1 and 10080 (7 days)' });
  }

  if (!subject || !body) {
    return res.status(400).json({ error: 'Subject and body are required' });
  }

  try {
    const pairs = {
      welcome_email_enabled: String(enabled),
      welcome_email_delay_minutes: String(delayMin),
      welcome_email_subject: subject,
      welcome_email_body: body,
    };

    for (const [key, value] of Object.entries(pairs)) {
      await pool.query(
        `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2`,
        [key, value]
      );
    }

    res.json({
      enabled,
      delay_minutes: delayMin,
      subject,
      body,
    });
  } catch (err) {
    console.error('Update welcome email error:', err);
    res.status(500).json({ error: 'Failed to update welcome email config' });
  }
});

module.exports = router;
