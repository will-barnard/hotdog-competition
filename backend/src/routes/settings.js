const express = require('express');
const { pool } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT key, value FROM settings');
    const settings = {};
    result.rows.forEach(row => {
      settings[row.key] = row.value;
    });
    res.json(settings);
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

const ALLOWED_SETTINGS_KEYS = [
  'competition_start', 'competition_end', 'rules',
  'home_show_total_competitors', 'home_show_total_official_competitors',
  'home_show_total_dogs', 'home_show_total_entries', 'home_show_prize_pool'
];

router.put('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    for (const key of ALLOWED_SETTINGS_KEYS) {
      if (req.body[key] !== undefined) {
        await pool.query(
          'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
          [key, String(req.body[key])]
        );
      }
    }

    const result = await pool.query('SELECT key, value FROM settings');
    const settings = {};
    result.rows.forEach(row => { settings[row.key] = row.value; });
    res.json(settings);
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const usersResult = await pool.query(`
      SELECT
        COUNT(*)::int as total_competitors,
        COUNT(*) FILTER (WHERE is_official_competitor = TRUE)::int as total_official_competitors
      FROM users
    `);
    const dogsResult = await pool.query(`
      SELECT
        COALESCE(SUM(quantity), 0)::int as total_dogs,
        COUNT(*)::int as total_entries
      FROM hotdogs
    `);
    const stats = {
      ...usersResult.rows[0],
      ...dogsResult.rows[0],
      prize_pool: usersResult.rows[0].total_official_competitors * 5
    };
    res.json(stats);
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

module.exports = router;
