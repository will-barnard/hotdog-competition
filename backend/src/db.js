const { Pool } = require('pg');

const TRANSIENT_ERRORS = new Set([
  'EAI_AGAIN',       // DNS resolution temporary failure
  'ECONNREFUSED',    // postgres not accepting connections yet
  'ECONNRESET',      // connection reset
  'EPIPE',           // broken pipe
  'ETIMEDOUT',       // connection timeout
  'CONNECTION_CLOSED', // pg protocol connection closed
]);

const innerPool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'hotdog_showdown',
  user: process.env.DB_USER || 'hotdog',
  password: process.env.DB_PASSWORD || 'hotdog_secret',
  max: 10,
  keepAlive: true,
  keepAliveInitialDelayMillis: 30000,
  idleTimeoutMillis: 60000,       // idle connections held for 60s before removal (was 10s)
  connectionTimeoutMillis: 10000,
  allowExitOnIdle: false,
});

function isTransient(err) {
  if (!err) return false;
  if (TRANSIENT_ERRORS.has(err.code)) return true;
  if (err.code === 'ENOTFOUND') return true;
  if (err.message && err.message.includes('terminated unexpectedly')) return true;
  if (err.message && err.message.includes('EAI_AGAIN')) return true;
  return false;
}

// Retry wrapper for pool.query — retries transient errors with exponential backoff
const RETRY_DELAYS_MS = [500, 1000, 2000, 4000, 8000]; // up to ~15s total
const pool = {
  async query(...args) {
    let lastErr;
    for (let attempt = 0; attempt < RETRY_DELAYS_MS.length + 1; attempt++) {
      try {
        return await innerPool.query(...args);
      } catch (err) {
        lastErr = err;
        if (isTransient(err) && attempt < RETRY_DELAYS_MS.length) {
          const delay = RETRY_DELAYS_MS[attempt];
          console.log(`Transient DB error (attempt ${attempt + 1}/${RETRY_DELAYS_MS.length + 1}): ${err.code || err.message} — retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw err;
      }
    }
    throw lastErr;
  },
  // Pass through connect() for migrations which use client directly
  connect() {
    return innerPool.connect();
  },
  on(...args) {
    return innerPool.on(...args);
  }
};

// --- Migration definitions (module-level so they can be re-run) ---
const migrations = [
  ['CREATE users', `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      is_admin BOOLEAN DEFAULT FALSE,
      is_official_competitor BOOLEAN DEFAULT FALSE,
      profile_picture VARCHAR(500),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `],
  ['CREATE hotdogs', `
    CREATE TABLE IF NOT EXISTS hotdogs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(200) NOT NULL,
      description TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      image_url VARCHAR(500) NOT NULL,
      date_eaten DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `],
  ['CREATE settings', `
    CREATE TABLE IF NOT EXISTS settings (
      id SERIAL PRIMARY KEY,
      key VARCHAR(100) UNIQUE NOT NULL,
      value TEXT NOT NULL
    )
  `],
  ['INSERT default settings', `
    INSERT INTO settings (key, value) VALUES
      ('competition_start', '2026-07-04T00:00:00Z'),
      ('competition_end', '2026-09-07T23:59:59Z'),
      ('rules', 'Welcome to the 2026 Hotdog Showdown!\n\n1. Log each hot dog you eat with a photo as proof.\n2. Each entry must include a title, quantity, and photo.\n3. The competition runs for the dates set by the admin.\n4. Official competitors are flagged by admins on a case-by-case basis.\n5. There are two leaderboards: Overall (everyone) and Official Competitors only.\n6. Admins may adjust or edit any entry to ensure fair play.\n7. This is mostly on the honor system — don''t be that person.\n8. Have fun and eat responsibly!\n\nGo Cubs! 🌭')
    ON CONFLICT (key) DO NOTHING
  `],
  ['ADD COLUMN users.profile_picture', `ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture VARCHAR(500)`],
  ['ADD COLUMN hotdogs.date_eaten', `ALTER TABLE hotdogs ADD COLUMN IF NOT EXISTS date_eaten DATE NOT NULL DEFAULT CURRENT_DATE`],
  ['ADD COLUMN hotdogs.flag_status', `ALTER TABLE hotdogs ADD COLUMN IF NOT EXISTS flag_status VARCHAR(10) DEFAULT NULL`],
  ['ADD COLUMN hotdogs.flag_text', `ALTER TABLE hotdogs ADD COLUMN IF NOT EXISTS flag_text TEXT DEFAULT NULL`],
  ['ADD COLUMN hotdogs.photo_hidden', `ALTER TABLE hotdogs ADD COLUMN IF NOT EXISTS photo_hidden BOOLEAN NOT NULL DEFAULT FALSE`],
  ['ADD COLUMN hotdogs.date_mismatch', `ALTER TABLE hotdogs ADD COLUMN IF NOT EXISTS date_mismatch BOOLEAN DEFAULT NULL`],
  // The day the photo says it was taken (from the camera's embedded metadata),
  // so admins can see *how far* off a mismatch is, not just that it is.
  ['ADD COLUMN hotdogs.photo_taken_date', `ALTER TABLE hotdogs ADD COLUMN IF NOT EXISTS photo_taken_date DATE DEFAULT NULL`],
  ['CREATE comments', `
    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      hotdog_id INTEGER REFERENCES hotdogs(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `],
  ['CREATE ratings', `
    CREATE TABLE IF NOT EXISTS ratings (
      id SERIAL PRIMARY KEY,
      hotdog_id INTEGER REFERENCES hotdogs(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      stars SMALLINT NOT NULL CHECK (stars >= 1 AND stars <= 5),
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (hotdog_id, user_id)
    )
  `],
  ['CREATE password_reset_tokens', `
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      token VARCHAR(255) UNIQUE NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `],
  ['CREATE email_daily_log', `
    CREATE TABLE IF NOT EXISTS email_daily_log (
      log_date DATE PRIMARY KEY,
      email_count INTEGER NOT NULL DEFAULT 0
    )
  `],
  ['CREATE email_queue', `
    CREATE TABLE IF NOT EXISTS email_queue (
      id SERIAL PRIMARY KEY,
      recipient VARCHAR(255) NOT NULL,
      subject TEXT NOT NULL,
      html_body TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      error TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      sent_at TIMESTAMP
    )
  `],
  ['CREATE welcome_email_log', `
    CREATE TABLE IF NOT EXISTS welcome_email_log (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
      status VARCHAR(20) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `],
  ['CREATE votes', `
    CREATE TABLE IF NOT EXISTS votes (
      id SERIAL PRIMARY KEY,
      question TEXT NOT NULL DEFAULT '',
      vote_type VARCHAR(20) NOT NULL DEFAULT 'multiple_choice',
      status VARCHAR(20) NOT NULL DEFAULT 'open',
      enabled BOOLEAN NOT NULL DEFAULT FALSE,
      results_visible BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      ended_at TIMESTAMP
    )
  `],
  // At most one row may be the current "open" vote at a time — admins edit
  // and voters cast against that row; ending it moves it into history and
  // a fresh blank open row takes its place.
  ['CREATE UNIQUE INDEX votes_single_open', `
    CREATE UNIQUE INDEX IF NOT EXISTS votes_single_open_idx ON votes (status) WHERE status = 'open'
  `],
  ['INSERT default open vote row', `
    INSERT INTO votes (question, vote_type, status, enabled, results_visible)
    SELECT '', 'multiple_choice', 'open', FALSE, FALSE
    WHERE NOT EXISTS (SELECT 1 FROM votes WHERE status = 'open')
  `],
  ['CREATE vote_options', `
    CREATE TABLE IF NOT EXISTS vote_options (
      id SERIAL PRIMARY KEY,
      vote_id INTEGER NOT NULL REFERENCES votes(id) ON DELETE CASCADE,
      label VARCHAR(200) NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `],
  ['CREATE vote_responses', `
    CREATE TABLE IF NOT EXISTS vote_responses (
      id SERIAL PRIMARY KEY,
      vote_id INTEGER NOT NULL REFERENCES votes(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      option_id INTEGER REFERENCES vote_options(id) ON DELETE CASCADE,
      thumbs_choice VARCHAR(10),
      abstained BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (vote_id, user_id)
    )
  `],

  // --- Seasons ---
  // A season is one competition window. A dog belongs to a season by its
  // date_eaten (as a Central calendar day, see competitionTime.js) and counts
  // only if it was not logged as exhibition. The competition_start /
  // competition_end settings are legacy: they seed the first season once and
  // are no longer read.
  ['CREATE seasons', `
    CREATE TABLE IF NOT EXISTS seasons (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      starts_at TIMESTAMPTZ NOT NULL,
      ends_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      CHECK (ends_at > starts_at)
    )
  `],
  // Official-competitor status is per season and never carries over.
  // users.is_official_competitor is legacy (seeds the first season only).
  ['CREATE season_officials', `
    CREATE TABLE IF NOT EXISTS season_officials (
      season_id INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (season_id, user_id)
    )
  `],
  // Set on dogs logged while no season is running (off-season mode). Stored
  // rather than derived from the date so an off-season log dated inside the
  // season that just ended can never sneak into its totals.
  ['ADD COLUMN hotdogs.is_exhibition', `ALTER TABLE hotdogs ADD COLUMN IF NOT EXISTS is_exhibition BOOLEAN NOT NULL DEFAULT FALSE`],
  // One-shot: guarded by a settings marker, not "seasons is empty", so deleting
  // seasons or un-flagging officials later is never undone by a reboot.
  ['SEED first season from legacy settings', `
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM settings WHERE key = 'seasons_migrated') THEN
        INSERT INTO seasons (name, starts_at, ends_at)
        SELECT '2026',
               COALESCE((SELECT value FROM settings WHERE key = 'competition_start'), '2026-07-04T05:00:00Z')::timestamptz,
               COALESCE((SELECT value FROM settings WHERE key = 'competition_end'), '2026-09-08T04:59:59Z')::timestamptz
        WHERE NOT EXISTS (SELECT 1 FROM seasons);

        INSERT INTO season_officials (season_id, user_id)
        SELECT (SELECT id FROM seasons ORDER BY starts_at LIMIT 1), id
        FROM users WHERE is_official_competitor = TRUE
        ON CONFLICT DO NOTHING;

        INSERT INTO settings (key, value) VALUES ('seasons_migrated', 'true');
      END IF;
    END $$
  `],
  // The season the site is "about" right now: the running one; else the next
  // one scheduled; else the most recently ended (so its final results stay up).
  ['CREATE FUNCTION current_season_id', `
    CREATE OR REPLACE FUNCTION current_season_id() RETURNS INTEGER LANGUAGE sql STABLE AS $$
      SELECT id FROM seasons
      ORDER BY
        CASE WHEN NOW() BETWEEN starts_at AND ends_at THEN 0
             WHEN starts_at > NOW() THEN 1
             ELSE 2 END,
        CASE WHEN starts_at > NOW() THEN starts_at END ASC NULLS LAST,
        ends_at DESC
      LIMIT 1
    $$
  `],
];

// --- Helpers ---

async function runQuery(client, label, sql) {
  try {
    await client.query(sql);
    console.log(`DB init OK: ${label}`);
  } catch (err) {
    console.error(`DB init WARN: ${label} — ${err.message}`);
  }
}

async function waitForPostgres(maxAttempts = 30, delayMs = 2000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let client;
    try {
      client = await pool.connect();
      await client.query('SELECT 1');
      console.log('PostgreSQL is ready');
      return;
    } catch (err) {
      console.log(`Waiting for PostgreSQL... (attempt ${attempt}/${maxAttempts}): ${err.message}`);
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, delayMs));
      }
    } finally {
      if (client) client.release();
    }
  }
  throw new Error('PostgreSQL did not become ready in time');
}

async function runMigrations() {
  for (const [label, sql] of migrations) {
    const client = await pool.connect();
    try {
      await runQuery(client, label, sql);
    } finally {
      client.release();
    }
  }
}

async function verifySchema() {
  const client = await pool.connect();
  try {
    // Verify tables exist
    const tableCheck = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('users', 'hotdogs', 'settings', 'comments', 'ratings', 'password_reset_tokens', 'email_daily_log', 'email_queue', 'welcome_email_log', 'votes', 'vote_options', 'vote_responses', 'seasons', 'season_officials')
    `);
    const tables = tableCheck.rows.map(r => r.table_name);
    console.log('Verified tables:', tables.join(', '));
    const requiredTables = ['users', 'hotdogs', 'settings', 'comments', 'ratings', 'password_reset_tokens', 'email_daily_log', 'email_queue', 'welcome_email_log', 'votes', 'vote_options', 'vote_responses', 'seasons', 'season_officials'];
    const missingTables = requiredTables.filter(t => !tables.includes(t));
    if (missingTables.length > 0) return false;

    // Verify critical columns exist (the ones added via ALTER TABLE)
    const colCheck = await client.query(`
      SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND (
        (table_name = 'hotdogs' AND column_name = 'date_eaten') OR
        (table_name = 'hotdogs' AND column_name = 'flag_status') OR
        (table_name = 'hotdogs' AND column_name = 'flag_text') OR
        (table_name = 'hotdogs' AND column_name = 'photo_hidden') OR
        (table_name = 'hotdogs' AND column_name = 'date_mismatch') OR
        (table_name = 'hotdogs' AND column_name = 'is_exhibition') OR
        (table_name = 'users' AND column_name = 'profile_picture')
      )
    `);
    const cols = colCheck.rows.map(r => `${r.table_name}.${r.column_name}`);
    if (!cols.includes('hotdogs.date_eaten') || !cols.includes('users.profile_picture') ||
        !cols.includes('hotdogs.flag_status') || !cols.includes('hotdogs.flag_text') ||
        !cols.includes('hotdogs.photo_hidden') || !cols.includes('hotdogs.date_mismatch') ||
        !cols.includes('hotdogs.is_exhibition')) {
      console.log('Missing columns detected, need re-migration');
      return false;
    }

    return true;
  } finally {
    client.release();
  }
}

// --- Re-init on postgres restart ---

let reinitScheduled = false;

pool.on('error', (err) => {
  console.error('Unexpected pg pool error:', err.message);
  scheduleReinit();
});

function scheduleReinit() {
  if (reinitScheduled) return;
  reinitScheduled = true;
  console.log('Scheduling schema re-check in 5 seconds...');
  setTimeout(async () => {
    try {
      await waitForPostgres(15, 2000);
      const ok = await verifySchema();
      if (!ok) {
        console.log('Schema incomplete after reconnect, re-running migrations...');
        await runMigrations();
        const okAfter = await verifySchema();
        if (okAfter) {
          console.log('Schema restored successfully after postgres restart');
        } else {
          console.error('Schema still incomplete after re-migration');
        }
      } else {
        console.log('Schema verified OK after reconnect');
      }
    } catch (e) {
      console.error('Re-init failed:', e.message);
    } finally {
      reinitScheduled = false;
    }
  }, 5000);
}

// Periodic heartbeat: every 30s verify the connection is alive and schema is intact.
// This catches postgres restarts proactively before a user query hits a dead connection.
function startHeartbeat() {
  setInterval(async () => {
    try {
      await innerPool.query('SELECT 1');
    } catch (err) {
      console.error('Heartbeat failed:', err.message);
      scheduleReinit();
    }
  }, 30000);
}

// --- Initial startup ---

async function initialize() {
  await waitForPostgres();
  await runMigrations();

  const ok = await verifySchema();
  if (!ok) {
    throw new Error('Schema verification failed after initial migration');
  }

  console.log('Database initialized successfully');
  startHeartbeat();
}

module.exports = { pool, initialize };
