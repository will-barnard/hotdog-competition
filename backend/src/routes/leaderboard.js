const express = require('express');
const { pool } = require('../db');

const router = express.Router();

router.get('/overall', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.username, u.is_official_competitor,
             COALESCE(SUM(h.quantity), 0)::int as total_dogs,
             COUNT(h.id)::int as total_entries
      FROM users u
      LEFT JOIN hotdogs h ON u.id = h.user_id
      GROUP BY u.id
      HAVING COALESCE(SUM(h.quantity), 0) > 0
      ORDER BY total_dogs DESC, total_entries DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Overall leaderboard error:', err);
    res.status(500).json({ error: 'Failed to load leaderboard' });
  }
});

router.get('/competitors', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.username, u.is_official_competitor,
             COALESCE(SUM(h.quantity), 0)::int as total_dogs,
             COUNT(h.id)::int as total_entries
      FROM users u
      LEFT JOIN hotdogs h ON u.id = h.user_id
      WHERE u.is_official_competitor = TRUE
      GROUP BY u.id
      HAVING COALESCE(SUM(h.quantity), 0) > 0
      ORDER BY total_dogs DESC, total_entries DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Competitors leaderboard error:', err);
    res.status(500).json({ error: 'Failed to load competitor leaderboard' });
  }
});

module.exports = router;
