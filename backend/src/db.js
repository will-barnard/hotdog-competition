const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'hotdog_showdown',
  user: process.env.DB_USER || 'hotdog',
  password: process.env.DB_PASSWORD || 'hotdog_secret',
  max: 10,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  idleTimeoutMillis: 20000,
  connectionTimeoutMillis: 5000,
  allowExitOnIdle: false,
});

pool.on('error', (err) => {
  console.error('Unexpected pg pool error:', err.message);
});

async function runQuery(client, label, sql) {
  try {
    await client.query(sql);
    console.log(`DB init OK: ${label}`);
  } catch (err) {
    console.error(`DB init FAILED: ${label} —`, err.message);
    throw err;
  }
}

async function waitForPostgres(maxAttempts = 20, delayMs = 3000) {
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

async function initialize() {
  await waitForPostgres();
  const client = await pool.connect();
  try {
    await runQuery(client, 'CREATE users', `
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
    `);

    await runQuery(client, 'CREATE hotdogs', `
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
    `);

    await runQuery(client, 'CREATE settings', `
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(100) UNIQUE NOT NULL,
        value TEXT NOT NULL
      )
    `);

    await runQuery(client, 'INSERT default settings', `
      INSERT INTO settings (key, value) VALUES
        ('competition_start', '2026-07-04T00:00:00Z'),
        ('competition_end', '2026-09-07T23:59:59Z'),
        ('rules', 'Welcome to the 2026 Hotdog Showdown!\n\n1. Log each hot dog you eat with a photo as proof.\n2. Each entry must include a title, quantity, and photo.\n3. The competition runs for the dates set by the admin.\n4. Official competitors are flagged by admins on a case-by-case basis.\n5. There are two leaderboards: Overall (everyone) and Official Competitors only.\n6. Admins may adjust or edit any entry to ensure fair play.\n7. This is mostly on the honor system — don''t be that person.\n8. Have fun and eat responsibly!\n\nGo Cubs! 🌭')
      ON CONFLICT (key) DO NOTHING
    `);

    await runQuery(client, 'ADD COLUMN users.profile_picture', `ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture VARCHAR(500)`);
    await runQuery(client, 'ADD COLUMN hotdogs.date_eaten', `ALTER TABLE hotdogs ADD COLUMN IF NOT EXISTS date_eaten DATE NOT NULL DEFAULT CURRENT_DATE`);

    await runQuery(client, 'CREATE comments', `
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        hotdog_id INTEGER REFERENCES hotdogs(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await runQuery(client, 'CREATE ratings', `
      CREATE TABLE IF NOT EXISTS ratings (
        id SERIAL PRIMARY KEY,
        hotdog_id INTEGER REFERENCES hotdogs(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        stars SMALLINT NOT NULL CHECK (stars >= 1 AND stars <= 5),
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (hotdog_id, user_id)
      )
    `);

    console.log('Database initialized successfully');
  } finally {
    client.release();
  }
}

module.exports = { pool, initialize };
