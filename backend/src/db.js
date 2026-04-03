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
  keepAliveInitialDelayMillis: 10000,
  idleTimeoutMillis: 10000,
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

// Retry wrapper for pool.query — retries transient errors up to 3 times
const pool = {
  async query(...args) {
    let lastErr;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await innerPool.query(...args);
      } catch (err) {
        lastErr = err;
        if (isTransient(err) && attempt < 3) {
          console.log(`Transient DB error (attempt ${attempt}/3): ${err.code || err.message} — retrying in ${attempt}s...`);
          await new Promise(r => setTimeout(r, attempt * 1000));
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
      WHERE table_schema = 'public' AND table_name IN ('users', 'hotdogs', 'settings', 'comments', 'ratings')
    `);
    const tables = tableCheck.rows.map(r => r.table_name);
    console.log('Verified tables:', tables.join(', '));
    const requiredTables = ['users', 'hotdogs', 'settings', 'comments', 'ratings'];
    const missingTables = requiredTables.filter(t => !tables.includes(t));
    if (missingTables.length > 0) return false;

    // Verify critical columns exist (the ones added via ALTER TABLE)
    const colCheck = await client.query(`
      SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND (
        (table_name = 'hotdogs' AND column_name = 'date_eaten') OR
        (table_name = 'hotdogs' AND column_name = 'flag_status') OR
        (table_name = 'hotdogs' AND column_name = 'flag_text') OR
        (table_name = 'users' AND column_name = 'profile_picture')
      )
    `);
    const cols = colCheck.rows.map(r => `${r.table_name}.${r.column_name}`);
    if (!cols.includes('hotdogs.date_eaten') || !cols.includes('users.profile_picture') ||
        !cols.includes('hotdogs.flag_status') || !cols.includes('hotdogs.flag_text')) {
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

// --- Initial startup ---

async function initialize() {
  await waitForPostgres();
  await runMigrations();

  const ok = await verifySchema();
  if (!ok) {
    throw new Error('Schema verification failed after initial migration');
  }

  console.log('Database initialized successfully');
}

module.exports = { pool, initialize };
