const express = require('express');
const { pool } = require('../db');
const { inSeasonSql, officialSql, getCurrentSeason, getSeasonStats } = require('../services/seasons');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Self-healing: ensure photo_hidden column exists before any attempt to read/write it
let photoHiddenEnsured = false;
async function ensurePhotoHiddenColumn() {
  if (photoHiddenEnsured) return;
  try {
    await pool.query('ALTER TABLE hotdogs ADD COLUMN IF NOT EXISTS photo_hidden BOOLEAN NOT NULL DEFAULT FALSE');
    photoHiddenEnsured = true;
  } catch (e) {
    console.error('ensurePhotoHiddenColumn failed:', e.message);
  }
}

// Dogs and official status are for the current season — official status is
// per season and does not carry over, so a new season starts with nobody flagged.
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.username, u.email, u.is_admin, u.created_at,
             ${officialSql('u.id', 's.id')} AS is_official_competitor,
             COALESCE(SUM(h.quantity) FILTER (WHERE ${inSeasonSql('h', 's')}), 0)::int as total_dogs
      FROM users u
      LEFT JOIN seasons s ON s.id = current_season_id()
      LEFT JOIN hotdogs h ON u.id = h.user_id
      GROUP BY u.id, s.id
      ORDER BY u.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Admin get users error:', err);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

router.patch('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid user ID' });

    const { is_official_competitor, is_admin } = req.body;
    if (typeof is_official_competitor !== 'boolean' && typeof is_admin !== 'boolean') {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const exists = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    if (exists.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    if (typeof is_admin === 'boolean') {
      await pool.query('UPDATE users SET is_admin = $1 WHERE id = $2', [is_admin, id]);
    }

    if (typeof is_official_competitor === 'boolean') {
      const season = await getCurrentSeason();
      if (!season) {
        return res.status(409).json({ error: 'Create a season before flagging official competitors' });
      }
      if (is_official_competitor) {
        await pool.query(
          'INSERT INTO season_officials (season_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [season.id, id]
        );
      } else {
        await pool.query('DELETE FROM season_officials WHERE season_id = $1 AND user_id = $2', [season.id, id]);
      }
    }

    const result = await pool.query(
      `SELECT id, username, email, is_admin, ${officialSql('users.id')} AS is_official_competitor FROM users WHERE id = $1`,
      [id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Admin update user error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.get('/hotdogs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const result = await pool.query(`
      SELECT h.*, u.username, ${officialSql()} AS is_official_competitor, u.profile_picture
      FROM hotdogs h
      JOIN users u ON h.user_id = u.id
      ORDER BY h.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    const countResult = await pool.query('SELECT COUNT(*) FROM hotdogs');
    const total = parseInt(countResult.rows[0].count);

    res.json({
      hotdogs: result.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    console.error('Admin get hotdogs error:', err);
    res.status(500).json({ error: 'Failed to load hotdogs' });
  }
});

router.patch('/hotdogs/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await ensurePhotoHiddenColumn();

    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid hotdog ID' });

    const { title, description, quantity, flag_status, flag_text, photo_hidden } = req.body;
    const updates = [];
    const values = [];
    let paramCount = 0;

    if (title !== undefined) {
      paramCount++;
      updates.push(`title = $${paramCount}`);
      values.push(title);
    }

    if (description !== undefined) {
      paramCount++;
      updates.push(`description = $${paramCount}`);
      values.push(description);
    }

    if (quantity !== undefined) {
      const qty = parseInt(quantity);
      if (isNaN(qty) || qty < 0 || qty > 100) {
        return res.status(400).json({ error: 'Quantity must be between 0 and 100' });
      }
      paramCount++;
      updates.push(`quantity = $${paramCount}`);
      values.push(qty);
    }

    if (flag_status !== undefined) {
      if (flag_status !== null && flag_status !== 'warning' && flag_status !== 'foul') {
        return res.status(400).json({ error: 'flag_status must be null, "warning", or "foul"' });
      }
      paramCount++;
      updates.push(`flag_status = $${paramCount}`);
      values.push(flag_status || null);
      // Clear flag text automatically when removing a flag
      if (!flag_status) {
        paramCount++;
        updates.push(`flag_text = $${paramCount}`);
        values.push(null);
      }
    }

    if (flag_text !== undefined && flag_status !== null) {
      paramCount++;
      updates.push(`flag_text = $${paramCount}`);
      values.push(flag_text || null);
    }

    if (typeof photo_hidden === 'boolean') {
      paramCount++;
      updates.push(`photo_hidden = $${paramCount}`);
      values.push(photo_hidden);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    paramCount++;
    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE hotdogs SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Hot dog not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Admin update hotdog error:', err);
    res.status(500).json({ error: 'Failed to update hot dog' });
  }
});

router.delete('/hotdogs/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid hotdog ID' });

    const result = await pool.query('DELETE FROM hotdogs WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Hot dog not found' });
    }

    res.json({ message: 'Hot dog deleted' });
  } catch (err) {
    console.error('Admin delete hotdog error:', err);
    res.status(500).json({ error: 'Failed to delete hot dog' });
  }
});

router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const season = await getCurrentSeason();
    const stats = await getSeasonStats(season && season.id);
    res.json({ ...stats, season });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

module.exports = router;
