const express = require('express');
const { pool } = require('../db');

const router = express.Router();

async function getCompetitionDates() {
  const result = await pool.query("SELECT key, value FROM settings WHERE key IN ('competition_start', 'competition_end')");
  const dates = {};
  result.rows.forEach(r => { dates[r.key] = r.value; });
  return dates;
}

router.get('/overall', async (req, res) => {
  try {
    const dates = await getCompetitionDates();
    const now = new Date();
    const compStart = dates.competition_start ? new Date(dates.competition_start) : null;

    if (compStart && now < compStart) {
      return res.json({ not_started: true, competition_start: dates.competition_start });
    }

    const result = await pool.query(`
      SELECT u.id, u.username, u.is_official_competitor,
             COALESCE(SUM(h.quantity), 0)::int as total_dogs,
             COUNT(h.id)::int as total_entries
      FROM users u
      LEFT JOIN hotdogs h ON u.id = h.user_id AND h.date_eaten >= $1::date
      GROUP BY u.id
      HAVING COALESCE(SUM(h.quantity), 0) > 0
      ORDER BY total_dogs DESC, total_entries DESC
    `, [dates.competition_start || '1970-01-01']);
    res.json(result.rows);
  } catch (err) {
    console.error('Overall leaderboard error:', err);
    res.status(500).json({ error: 'Failed to load leaderboard' });
  }
});

router.get('/competitors', async (req, res) => {
  try {
    const dates = await getCompetitionDates();
    const now = new Date();
    const compStart = dates.competition_start ? new Date(dates.competition_start) : null;

    if (compStart && now < compStart) {
      return res.json({ not_started: true, competition_start: dates.competition_start });
    }

    const result = await pool.query(`
      SELECT u.id, u.username, u.is_official_competitor,
             COALESCE(SUM(h.quantity), 0)::int as total_dogs,
             COUNT(h.id)::int as total_entries
      FROM users u
      LEFT JOIN hotdogs h ON u.id = h.user_id AND h.date_eaten >= $1::date
      WHERE u.is_official_competitor = TRUE
      GROUP BY u.id
      HAVING COALESCE(SUM(h.quantity), 0) > 0
      ORDER BY total_dogs DESC, total_entries DESC
    `, [dates.competition_start || '1970-01-01']);
    res.json(result.rows);
  } catch (err) {
    console.error('Competitors leaderboard error:', err);
    res.status(500).json({ error: 'Failed to load competitor leaderboard' });
  }
});

router.get('/all-competitors', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.username, u.is_official_competitor,
             COALESCE(SUM(h.quantity), 0)::int as total_dogs
      FROM users u
      LEFT JOIN hotdogs h ON u.id = h.user_id
      GROUP BY u.id
      ORDER BY u.username ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('All competitors error:', err);
    res.status(500).json({ error: 'Failed to load competitors list' });
  }
});

module.exports = router;
