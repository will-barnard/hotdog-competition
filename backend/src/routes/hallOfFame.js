// Hall of Fame: every season that has started — the one in progress first,
// then finished ones newest first — with its top 3, season totals and awards
// (services/seasonAwards.js). Hidden (404) from everyone but admins until the
// admin turns on the hall_of_fame_public setting.
const express = require('express');
const { pool } = require('../db');
const { optionalAuth } = require('../middleware/auth');
const { inSeasonSql, officialSql, getSeasonState, withStatus } = require('../services/seasons');
const { getSeasonAwards, THRESHOLDS } = require('../services/seasonAwards');

const router = express.Router();

async function isAdmin(req) {
  if (!req.user) return false;
  // JWT claims can be stale — check the DB, same as requireAdmin.
  const r = await pool.query('SELECT is_admin FROM users WHERE id = $1', [req.user.id]);
  return !!(r.rows[0] && r.rows[0].is_admin);
}

router.get('/', optionalAuth, async (req, res) => {
  try {
    const state = await getSeasonState();
    const admin = await isAdmin(req);
    if (!state.hall_of_fame_public && !admin) {
      return res.status(404).json({ error: 'The Hall of Fame is not open yet' });
    }

    const seasonsResult = await pool.query(`
      SELECT s.id, s.name, s.starts_at, s.ends_at,
             COALESCE(SUM(h.quantity), 0)::int AS total_dogs,
             COUNT(h.id)::int AS total_entries,
             COUNT(DISTINCT h.user_id)::int AS total_competitors,
             (SELECT COUNT(*)::int FROM season_officials so WHERE so.season_id = s.id) AS total_official_competitors
      FROM seasons s
      LEFT JOIN hotdogs h ON ${inSeasonSql('h', 's')}
      WHERE s.starts_at <= NOW()
      GROUP BY s.id
      ORDER BY s.ends_at DESC
    `);

    // Same as the leaderboard: listed by dogs then entries, but people tied on
    // dogs share a place (two 🥈s), so the podium matches the standings.
    const podiumResult = await pool.query(`
      WITH totals AS (
        SELECT s.id AS season_id, u.id AS user_id, u.username, u.profile_picture,
               SUM(h.quantity)::int AS total_dogs, COUNT(h.id)::int AS total_entries,
               ${officialSql('u.id', 's.id')} AS is_official
        FROM seasons s
        JOIN hotdogs h ON ${inSeasonSql('h', 's')}
        JOIN users u ON u.id = h.user_id
        WHERE s.starts_at <= NOW()
        GROUP BY s.id, u.id
      ), ranked AS (
        SELECT *,
               RANK() OVER (PARTITION BY season_id ORDER BY total_dogs DESC)::int AS place,
               ROW_NUMBER() OVER (PARTITION BY season_id ORDER BY total_dogs DESC, total_entries DESC) AS rn
        FROM totals
      )
      SELECT season_id, user_id, username, profile_picture, total_dogs, total_entries, is_official, place
      FROM ranked WHERE rn <= 3
      ORDER BY season_id, rn
    `);

    const seasons = await Promise.all(seasonsResult.rows.map(async row => {
      const s = withStatus(row);
      return {
        ...s,
        podium: podiumResult.rows.filter(p => p.season_id === s.id),
        awards: await getSeasonAwards(s.id, { ended: s.status === 'ended' })
      };
    }));

    res.json({ public: state.hall_of_fame_public, thresholds: THRESHOLDS, seasons });
  } catch (err) {
    console.error('Hall of Fame error:', err);
    res.status(500).json({ error: 'Failed to load the Hall of Fame' });
  }
});

module.exports = router;
