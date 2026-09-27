const express = require('express');
const { pool } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { inSeasonSql, officialSql, resolveSeason } = require('../services/seasons');

const router = express.Router();

// Both boards accept ?season=<id> (defaults to the current season). After a
// season ends the current season is still that one, so the boards show its
// final standings until the next season is created.
async function seasonBoard(req, res, officialOnly) {
  const season = await resolveSeason(req.query.season);
  if (!season) return res.json([]);
  if (season.status === 'upcoming') {
    return res.json({ not_started: true, competition_start: season.starts_at });
  }
  const result = await pool.query(`
    SELECT u.id, u.username, ${officialSql('u.id', 's.id')} AS is_official_competitor,
           COALESCE(SUM(h.quantity), 0)::int as total_dogs,
           COUNT(h.id)::int as total_entries
    FROM seasons s
    JOIN hotdogs h ON ${inSeasonSql('h', 's')}
    JOIN users u ON u.id = h.user_id
    WHERE s.id = $1 ${officialOnly ? `AND ${officialSql('u.id', 's.id')}` : ''}
    GROUP BY u.id, s.id
    ORDER BY total_dogs DESC, total_entries DESC
  `, [season.id]);
  res.json(result.rows);
}

router.get('/overall', async (req, res) => {
  try {
    await seasonBoard(req, res, false);
  } catch (err) {
    console.error('Overall leaderboard error:', err);
    res.status(500).json({ error: 'Failed to load leaderboard' });
  }
});

router.get('/competitors', async (req, res) => {
  try {
    await seasonBoard(req, res, true);
  } catch (err) {
    console.error('Competitors leaderboard error:', err);
    res.status(500).json({ error: 'Failed to load competitor leaderboard' });
  }
});

// All-time, everyone — the Competitors page.
router.get('/all-competitors', async (req, res) => {  try {
    const result = await pool.query(`
      SELECT u.id, u.username, ${officialSql()} AS is_official_competitor,
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

    const season = await resolveSeason(req.query.season);

    const userResult = await pool.query(
      `SELECT id, username, ${officialSql('users.id')} AS is_official_competitor FROM users WHERE id = $1`,
      [userId]
    );
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const entriesResult = await pool.query(`
      SELECT h.id, h.title, h.date_eaten, h.quantity, h.created_at, h.is_exhibition,
             COALESCE(${inSeasonSql('h', 's')}, FALSE) as in_window
      FROM hotdogs h
      LEFT JOIN seasons s ON s.id = $2
      WHERE h.user_id = $1
      ORDER BY h.date_eaten DESC, h.created_at DESC
    `, [userId, season ? season.id : null]);

    const allTimeTotal = entriesResult.rows.reduce((s, r) => s + r.quantity, 0);
    const windowTotal = entriesResult.rows.filter(r => r.in_window).reduce((s, r) => s + r.quantity, 0);

    res.json({
      user: userResult.rows[0],
      season,
      competition_start: season ? season.starts_at : null,
      competition_end: season ? season.ends_at : null,
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
