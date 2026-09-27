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

// ---------------------------------------------------------------------------
// Talking to Resend.
//
// Two things the original code got wrong, which is how a bulk send lost most
// of its recipients:
//  1. resend.emails.send() does NOT throw on failure — it resolves with
//     { data: null, error }. Code that only caught exceptions counted every
//     rejected email as sent, so nothing recorded who was skipped.
//  2. Sends went out 10 at a time, back to back, which trips Resend's
//     10-requests-per-second limit (429 rate_limit_exceeded).
// Every send now goes through sendOne(): paced below the limit for the whole
// process, retried on 429, and judged by the returned error.
// ---------------------------------------------------------------------------
const MIN_GAP_MS = 150;            // ~6-7 sends/sec, comfortably under 10/sec
const MAX_429_RETRIES = 5;
let nextSlot = 0;

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Reserve the next send slot. Shared by bulk, queue and welcome emails, so
// they can't add up to more than the limit between them.
async function waitForSlot() {
  const now = Date.now();
  const slot = Math.max(now, nextSlot);
  nextSlot = slot + MIN_GAP_MS;
  if (slot > now) await sleep(slot - now);
}

// Returns { ok: true, id } or { ok: false, error, rateLimited }.
async function sendOne({ to, subject, html }) {
  for (let attempt = 0; ; attempt++) {
    await waitForSlot();
    let result;
    try {
      result = await resend.emails.send({ from: fromEmail, to, subject, html });
    } catch (err) {
      return { ok: false, error: err.message }; // network failure etc.
    }
    const error = result && result.error;
    if (!error) return { ok: true, id: result.data && result.data.id };

    const rateLimited = error.statusCode === 429 || error.name === 'rate_limit_exceeded';
    if (rateLimited && attempt < MAX_429_RETRIES) {
      const retryAfter = parseFloat(result.headers && result.headers['retry-after']);
      await sleep(Number.isFinite(retryAfter) ? retryAfter * 1000 : 1000 * (attempt + 1));
      continue;
    }
    return { ok: false, error: error.message || error.name || 'Send failed', rateLimited };
  }
}

// Resend timestamps can look like "2026-09-27 18:32:10.123+00", which JS's
// Date parser doesn't reliably accept. Normalize to ISO first.
function parseResendDate(value) {
  if (!value) return null;
  let v = String(value).trim().replace(' ', 'T');
  v = v.replace(/([+-]\d{2})$/, '$1:00');       // "+00" -> "+00:00"
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(v)) v += 'Z'; // no zone given -> UTC
  const d = new Date(v);
  return isNaN(d) ? null : d;
}

// Emails Resend has on record — i.e. actually accepted — since `sinceDate`.
// Throws a status-400 error with a readable message if the API key isn't
// allowed to list (a "sending access" key can only send).
async function listSentSince(sinceDate, maxPages = 50) {
  const out = [];
  let after;
  for (let page = 0; page < maxPages; page++) {
    await waitForSlot();
    const res = await resend.emails.list(after ? { limit: 100, after } : { limit: 100 });
    if (res.error) {
      const e = new Error(
        res.error.name === 'restricted_api_key' || res.error.statusCode === 401 || res.error.statusCode === 403
          ? "Your Resend API key is only allowed to send, so the site can't look up who already received it. Paste the addresses to skip instead (Resend dashboard → Emails), or use a Full Access key."
          : `Couldn't read Resend's email log: ${res.error.message || res.error.name}`
      );
      e.status = 400;
      throw e;
    }
    const rows = (res.data && res.data.data) || [];
    let reachedOlder = false;
    for (const row of rows) {
      const created = parseResendDate(row.created_at);
      if (created && created < sinceDate) { reachedOlder = true; break; }
      out.push(row);
    }
    if (reachedOlder || !res.data.has_more || rows.length === 0) break;
    after = rows[rows.length - 1].id;
  }
  return out;
}

// Resend is the source of truth for how many went out today. Re-sync the
// local counter to it (it over-counted when rejected sends were counted).
async function syncSentTodayFrom(resendRows) {
  const today = todayKey();
  const n = resendRows.filter(r => {
    const d = parseResendDate(r.created_at);
    return d && d.toISOString().slice(0, 10) === today;
  }).length;
  await pool.query(
    `INSERT INTO email_daily_log (log_date, email_count) VALUES ($1, $2)
     ON CONFLICT (log_date) DO UPDATE SET email_count = $2`,
    [today, n]
  );
  return n;
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

  const r = await sendOne({ to, subject, html });
  if (r.ok) {
    await incrementSent(1);
    return { sent: true };
  }
  if (r.rateLimited) {
    // Still being throttled after retries — hand it to the queue rather than drop it.
    await queueEmail({ to, subject, html });
    return { sent: false, queued: true };
  }
  console.error('[EMAIL] Send failed:', r.error);
  return { sent: false, error: r.error };
}

// Send bulk emails with daily-limit awareness, one at a time at a safe pace.
// Returns { sent, queued, failed, failed_recipients: [{ email, error }] }
async function sendBulk(recipients, subject, html) {
  if (!isEnabled()) return { sent: 0, queued: 0, failed: 0, failed_recipients: [], error: 'Email service not configured' };

  const sentToday = await getSentToday();
  const remaining = Math.max(0, DAILY_LIMIT - sentToday);

  const toSendNow = recipients.slice(0, remaining);
  const toQueue = recipients.slice(remaining);

  let sent = 0;
  let queued = 0;
  const failedRecipients = [];

  for (const email of toSendNow) {
    const r = await sendOne({ to: email, subject, html });
    if (r.ok) {
      sent++;
      await incrementSent(1); // per email, so the count is right even if this is interrupted
    } else if (r.rateLimited) {
      await queueEmail({ to: email, subject, html }); // queue processor will retry
      queued++;
    } else {
      console.error(`[EMAIL] Bulk send failed for ${email}:`, r.error);
      failedRecipients.push({ email, error: r.error });
    }
  }

  // Over today's limit — queue for the next day
  for (const email of toQueue) {
    await queueEmail({ to: email, subject, html });
    queued++;
  }

  return { sent, queued, failed: failedRecipients.length, failed_recipients: failedRecipients };
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
    const r = await sendOne({ to: row.recipient, subject: row.subject, html: row.html_body });
    if (r.ok) {
      await incrementSent(1);
      await pool.query(`UPDATE email_queue SET status = 'sent', sent_at = NOW() WHERE id = $1`, [row.id]);
    } else if (r.rateLimited) {
      break; // still throttled — leave the rest pending for the next run
    } else {
      console.error(`[EMAIL] Queue send failed for ${row.recipient}:`, r.error);
      await pool.query(
        `UPDATE email_queue SET status = 'failed', error = $2 WHERE id = $1`,
        [row.id, r.error]
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

module.exports = { init, isEnabled, sendEmail, sendBulk, getSentToday, startProcessor, listSentSince, syncSentTodayFrom, DAILY_LIMIT };
