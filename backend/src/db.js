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

async function initialize() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        is_admin BOOLEAN DEFAULT FALSE,
        is_official_competitor BOOLEAN DEFAULT FALSE,
        profile_picture VARCHAR(500),
        created_at TIMESTAMP DEFAULT NOW()
      );

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
      );

      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(100) UNIQUE NOT NULL,
        value TEXT NOT NULL
      );

      INSERT INTO settings (key, value) VALUES
        ('competition_start', '2026-07-04T00:00:00Z'),
        ('competition_end', '2026-09-07T23:59:59Z'),
        ('rules', 'Welcome to the 2026 Hotdog Showdown!\n\n1. Log each hot dog you eat with a photo as proof.\n2. Each entry must include a title, quantity, and photo.\n3. The competition runs for the dates set by the admin.\n4. Official competitors are flagged by admins on a case-by-case basis.\n5. There are two leaderboards: Overall (everyone) and Official Competitors only.\n6. Admins may adjust or edit any entry to ensure fair play.\n7. This is mostly on the honor system — don''t be that person.\n8. Have fun and eat responsibly!\n\nGo Cubs! 🌭')
      ON CONFLICT (key) DO NOTHING;
    `);

    // Run migrations separately to ensure they always execute
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture VARCHAR(500)`);
    await client.query(`ALTER TABLE hotdogs ADD COLUMN IF NOT EXISTS date_eaten DATE NOT NULL DEFAULT CURRENT_DATE`);

    console.log('Database initialized');
  } finally {
    client.release();
  }
}

module.exports = { pool, initialize };
