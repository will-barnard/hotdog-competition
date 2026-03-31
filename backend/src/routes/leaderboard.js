const express = require('express');
const { pool } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

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
      LEFT JOIN hotdogs h ON u.id = h.user_id
        AND h.date_eaten >= $1::date
        AND h.date_eaten <= $2::date
      GROUP BY u.id
      HAVING COALESCE(SUM(h.quantity), 0) > 0
      ORDER BY total_dogs DESC, total_entries DESC
    `, [dates.competition_start || '1970-01-01', dates.competition_end || '9999-12-31']);
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
      LEFT JOIN hotdogs h ON u.id = h.user_id
        AND h.date_eaten >= $1::date
        AND h.date_eaten <= $2::date
      WHERE u.is_official_competitor = TRUE
      GROUP BY u.id
      HAVING COALESCE(SUM(h.quantity), 0) > 0
      ORDER BY total_dogs DESC, total_entries DESC
    `, [dates.competition_start || '1970-01-01', dates.competition_end || '9999-12-31']);
    res.json(result.rows);
  } catch (err) {
    console.error('Competitors leaderboard error:', err);
    res.status(500).json({ error: 'Failed to load competitor leaderboard' });
  }
});

router.get('/all-competitors', async (req, res) => {  try {
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

router.get('/breakdown/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

    const dates = await getCompetitionDates();
    const compStart = dates.competition_start || '1970-01-01';
    const compEnd = dates.competition_end || '9999-12-31';

    const userResult = await pool.query(
      'SELECT id, username, is_official_competitor FROM users WHERE id = $1',
      [userId]
    );
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const entriesResult = await pool.query(`
      SELECT id, title, date_eaten, quantity, created_at,
             (date_eaten >= $2::date AND date_eaten <= $3::date) as in_window
      FROM hotdogs
      WHERE user_id = $1
      ORDER BY date_eaten DESC, created_at DESC
    `, [userId, compStart, compEnd]);

    const allTimeTotal = entriesResult.rows.reduce((s, r) => s + r.quantity, 0);
    const windowTotal = entriesResult.rows.filter(r => r.in_window).reduce((s, r) => s + r.quantity, 0);

    res.json({
      user: userResult.rows[0],
      competition_start: compStart,
      competition_end: compEnd,
      entries: entriesResult.rows,
      all_time_total: allTimeTotal,
      window_total: windowTotal
    });
  } catch (err) {
    console.error('Breakdown error:', err);
    res.status(500).json({ error: 'Failed to load breakdown' });
  }
});

module.exports = router;
