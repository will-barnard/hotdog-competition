// Admin season management: create, edit, and end seasons. The Off-Season
// lever and Hall of Fame visibility are plain settings (PUT /api/settings).
//
// Deliberately missing: deleting a season. Dogs aren't attached to a season
// row (membership is by date), so a delete would silently drop that season
// from the Hall of Fame and profiles while its dogs stay behind — do it in
// SQL on purpose if it's ever really needed.
const express = require('express');
const { pool } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { inSeasonSql, withStatus, getSeasonState } = require('../services/seasons');

const router = express.Router();

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

// Validates a full or partial season payload against the existing row.
async function validate(body, existing, excludeId) {
  const name = body.name !== undefined ? String(body.name).trim() : existing && existing.name;
  const startsAt = body.starts_at !== undefined ? new Date(body.starts_at) : existing && existing.starts_at;
  const endsAt = body.ends_at !== undefined ? new Date(body.ends_at) : existing && existing.ends_at;

  if (!name) throw badRequest('Season name is required');
  if (name.length > 100) throw badRequest('Season name must be 100 characters or fewer');
  if (!startsAt || isNaN(startsAt)) throw badRequest('A valid start date is required');
  if (!endsAt || isNaN(endsAt)) throw badRequest('A valid end date is required');
  if (endsAt <= startsAt) throw badRequest('End date must be after the start date');

  // Overlapping seasons would make "which season does this dog count for"
  // ambiguous, so refuse them outright.
  const overlap = await pool.query(
    `SELECT name FROM seasons WHERE id <> $3 AND starts_at < $2 AND ends_at > $1 LIMIT 1`,
    [startsAt, endsAt, excludeId || 0]
  );
  if (overlap.rows.length) throw badRequest(`Those dates overlap the "${overlap.rows[0].name}" season`);

  return { name, startsAt, endsAt };
}

async function getSeasonRow(id) {
  const r = await pool.query('SELECT id, name, starts_at, ends_at FROM seasons WHERE id = $1', [id]);
  return r.rows[0] || null;
}

function sendError(res, err, fallback) {
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error(fallback, err);
  res.status(500).json({ error: fallback });
}

router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [rows, state] = await Promise.all([
      pool.query(`
        SELECT s.id, s.name, s.starts_at, s.ends_at,
               COALESCE(SUM(h.quantity), 0)::int AS total_dogs,
               COUNT(DISTINCT h.user_id)::int AS total_competitors,
               (SELECT COUNT(*)::int FROM season_officials so WHERE so.season_id = s.id) AS total_official_competitors
        FROM seasons s
        LEFT JOIN hotdogs h ON ${inSeasonSql('h', 's')}
        GROUP BY s.id
        ORDER BY s.starts_at DESC
      `),
      getSeasonState()
    ]);
    res.json({
      seasons: rows.rows.map(withStatus),
      current_season_id: state.season ? state.season.id : null,
      state
    });
  } catch (err) {
    sendError(res, err, 'Failed to load seasons');
  }
});

router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, startsAt, endsAt } = await validate(req.body, null, null);
    const r = await pool.query(
      'INSERT INTO seasons (name, starts_at, ends_at) VALUES ($1, $2, $3) RETURNING id, name, starts_at, ends_at',
      [name, startsAt, endsAt]
    );
    res.status(201).json(withStatus(r.rows[0]));
  } catch (err) {
    sendError(res, err, 'Failed to create season');
  }
});

router.patch('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid season ID' });
    const existing = await getSeasonRow(id);
    if (!existing) return res.status(404).json({ error: 'Season not found' });

    const { name, startsAt, endsAt } = await validate(req.body, existing, id);
    const r = await pool.query(
      'UPDATE seasons SET name = $1, starts_at = $2, ends_at = $3 WHERE id = $4 RETURNING id, name, starts_at, ends_at',
      [name, startsAt, endsAt, id]
    );
    res.json(withStatus(r.rows[0]));
  } catch (err) {
    sendError(res, err, 'Failed to update season');
  }
});

// Ends a running season immediately — logging closes (or goes off-season if
// that lever is on) and the season's results freeze.
router.post('/:id/end', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid season ID' });
    const existing = await getSeasonRow(id);
    if (!existing) return res.status(404).json({ error: 'Season not found' });
    if (withStatus(existing).status !== 'active') {
      return res.status(409).json({ error: 'Only a running season can be ended' });
    }
    const r = await pool.query(
      'UPDATE seasons SET ends_at = NOW() WHERE id = $1 RETURNING id, name, starts_at, ends_at',
      [id]
    );
    res.json(withStatus(r.rows[0]));
  } catch (err) {
    sendError(res, err, 'Failed to end season');
  }
});

module.exports = router;
