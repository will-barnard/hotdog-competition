const express = require('express');
const { pool } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const email = require('../services/email');

const router = express.Router();

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
router.post('/bulk', authenticateToken, requireAdmin, async (req, res) => {
  const { subject, html, group } = req.body;
  // group: 'all', 'official', 'exhibition', 'admin'

  if (!subject || !html) {
    return res.status(400).json({ error: 'Subject and html body are required' });
  }

  if (!email.isEnabled()) {
    return res.status(503).json({ error: 'Email service is not configured' });
  }

  try {
    let query = 'SELECT email FROM users';
    if (group === 'official') query += ' WHERE is_official_competitor = TRUE';
    else if (group === 'exhibition') query += ' WHERE is_official_competitor = FALSE';
    else if (group === 'admin') query += ' WHERE is_admin = TRUE';
    // 'all' or undefined = everyone

    const result = await pool.query(query);
    const recipients = result.rows.map(r => r.email);

    if (recipients.length === 0) {
      return res.json({ sent: 0, queued: 0, failed: 0, total_recipients: 0 });
    }

    const stats = await email.sendBulk(recipients, subject, html);
    res.json({ ...stats, total_recipients: recipients.length });
  } catch (err) {
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
