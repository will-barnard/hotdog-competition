const { Resend } = require('resend');
const { pool } = require('../db');

const DAILY_LIMIT = 100;

let resend;
let fromEmail;

function init() {
  const apiKey = process.env.RESEND_API_KEY;
  fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !fromEmail) {
    console.warn('[EMAIL] RESEND_API_KEY or RESEND_FROM_EMAIL not set — email sending disabled.');
    return;
  }
  resend = new Resend(apiKey);
  console.log(`[EMAIL] Resend configured, from: ${fromEmail}`);
}

function isEnabled() {
  return !!resend && !!fromEmail;
}

// Get today's UTC date string for tracking
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// Get the count of emails sent today
async function getSentToday() {
  const result = await pool.query(
    `SELECT COALESCE(SUM(email_count), 0)::int AS total
     FROM email_daily_log WHERE log_date = $1`,
    [todayKey()]
  );
  return result.rows[0].total;
}

// Increment today's sent count
async function incrementSent(count = 1) {
  await pool.query(
    `INSERT INTO email_daily_log (log_date, email_count)
     VALUES ($1, $2)
     ON CONFLICT (log_date) DO UPDATE SET email_count = email_daily_log.email_count + $2`,
    [todayKey(), count]
  );
}

// Send a single email, respecting the daily limit. Returns { sent, queued, error }.
async function sendEmail({ to, subject, html }) {
  if (!isEnabled()) return { sent: false, error: 'Email service not configured' };

  const sentToday = await getSentToday();
  if (sentToday >= DAILY_LIMIT) {
    // Queue for next available day
    await queueEmail({ to, subject, html });
    return { sent: false, queued: true };
  }

  try {
    await resend.emails.send({ from: fromEmail, to, subject, html });
    await incrementSent(1);
    return { sent: true };
  } catch (err) {
    console.error('[EMAIL] Send failed:', err.message);
    return { sent: false, error: err.message };
  }
}

// Send bulk emails with daily-limit awareness.
// Returns { sent: number, queued: number, failed: number }
async function sendBulk(recipients, subject, html) {
  if (!isEnabled()) return { sent: 0, queued: 0, failed: 0, error: 'Email service not configured' };

  let sentToday = await getSentToday();
  const remaining = Math.max(0, DAILY_LIMIT - sentToday);

  const toSendNow = recipients.slice(0, remaining);
  const toQueue = recipients.slice(remaining);

  let sent = 0;
  let failed = 0;

  // Send in batches of 10 to avoid hammering the API
  for (let i = 0; i < toSendNow.length; i += 10) {
    const batch = toSendNow.slice(i, i + 10);
    const results = await Promise.allSettled(
      batch.map(email =>
        resend.emails.send({ from: fromEmail, to: email, subject, html })
      )
    );
    for (const r of results) {
      if (r.status === 'fulfilled') sent++;
      else {
        console.error('[EMAIL] Bulk send failed for one recipient:', r.reason?.message);
        failed++;
      }
    }
  }

  if (sent > 0) await incrementSent(sent);

  // Queue the rest
  let queued = 0;
  for (const email of toQueue) {
    await queueEmail({ to: email, subject, html });
    queued++;
  }

  return { sent, queued, failed };
}

async function queueEmail({ to, subject, html }) {
  await pool.query(
    `INSERT INTO email_queue (recipient, subject, html_body, status) VALUES ($1, $2, $3, 'pending')`,
    [to, subject, html]
  );
}

// Process queued emails — call this periodically (e.g. every 60s via setInterval)
async function processQueue() {
  if (!isEnabled()) return;

  const sentToday = await getSentToday();
  const remaining = Math.max(0, DAILY_LIMIT - sentToday);
  if (remaining === 0) return;

  const result = await pool.query(
    `SELECT id, recipient, subject, html_body FROM email_queue
     WHERE status = 'pending' ORDER BY created_at ASC LIMIT $1`,
    [remaining]
  );

  for (const row of result.rows) {
    try {
      await resend.emails.send({ from: fromEmail, to: row.recipient, subject: row.subject, html: row.html_body });
      await incrementSent(1);
      await pool.query(`UPDATE email_queue SET status = 'sent', sent_at = NOW() WHERE id = $1`, [row.id]);
    } catch (err) {
      console.error(`[EMAIL] Queue send failed for ${row.recipient}:`, err.message);
      await pool.query(
        `UPDATE email_queue SET status = 'failed', error = $2 WHERE id = $1`,
        [row.id, err.message]
      );
    }
  }
}

// Process welcome emails — checks for users who registered N minutes ago and haven't been sent one
async function processWelcomeEmails() {
  if (!isEnabled()) return;

  // Check if welcome email is enabled
  const settingsResult = await pool.query(
    `SELECT key, value FROM settings WHERE key IN ('welcome_email_enabled', 'welcome_email_delay_minutes', 'welcome_email_subject', 'welcome_email_body')`
  );
  const s = {};
  settingsResult.rows.forEach(r => { s[r.key] = r.value; });

  if (s.welcome_email_enabled !== 'true') return;

  const delayMinutes = parseInt(s.welcome_email_delay_minutes) || 30;
  const subject = s.welcome_email_subject;
  const body = s.welcome_email_body;

  if (!subject || !body) return;

  // Find users who:
  // 1. Registered at least delayMinutes ago
  // 2. Haven't been sent a welcome email yet
  const users = await pool.query(
    `SELECT u.id, u.email, u.username FROM users u
     WHERE u.created_at <= NOW() - ($1 || ' minutes')::interval
       AND NOT EXISTS (SELECT 1 FROM welcome_email_log w WHERE w.user_id = u.id)
     ORDER BY u.created_at ASC LIMIT 20`,
    [String(delayMinutes)]
  );

  for (const user of users.rows) {
    // Personalize the body
    const personalizedHtml = body.replace(/\{\{username\}\}/g, user.username);
    const personalizedSubject = subject.replace(/\{\{username\}\}/g, user.username);

    const result = await sendEmail({ to: user.email, subject: personalizedSubject, html: personalizedHtml });

    // Log regardless of send/queue so we don't retry
    await pool.query(
      `INSERT INTO welcome_email_log (user_id, status) VALUES ($1, $2)`,
      [user.id, result.sent ? 'sent' : (result.queued ? 'queued' : 'failed')]
    );
  }
}

// Start the background processor
function startProcessor() {
  // Process queue every 60 seconds
  setInterval(() => {
    processQueue().catch(err => console.error('[EMAIL] Queue processor error:', err.message));
    processWelcomeEmails().catch(err => console.error('[EMAIL] Welcome email processor error:', err.message));
  }, 60 * 1000);

  // Also run once at startup after a short delay
  setTimeout(() => {
    processQueue().catch(err => console.error('[EMAIL] Initial queue process error:', err.message));
    processWelcomeEmails().catch(err => console.error('[EMAIL] Initial welcome process error:', err.message));
  }, 10000);
}

module.exports = { init, isEnabled, sendEmail, sendBulk, getSentToday, startProcessor, DAILY_LIMIT };
