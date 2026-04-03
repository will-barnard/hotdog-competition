const express = require('express');
const { pool } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const datesResult = await pool.query("SELECT key, value FROM settings WHERE key IN ('competition_start', 'competition_end')");
    const dates = {};
    datesResult.rows.forEach(r => { dates[r.key] = r.value; });
    const compStart = dates.competition_start || '1970-01-01';
    const compEnd = dates.competition_end || '9999-12-31';

    const result = await pool.query(`
      SELECT u.id, u.username, u.email, u.is_admin, u.is_official_competitor, u.created_at,
             COALESCE(SUM(CASE WHEN h.date_eaten >= $1::date AND h.date_eaten <= $2::date THEN h.quantity ELSE 0 END), 0)::int as total_dogs
      FROM users u
      LEFT JOIN hotdogs h ON u.id = h.user_id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `, [compStart, compEnd]);
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
    const updates = [];
    const values = [];
    let paramCount = 0;

    if (typeof is_official_competitor === 'boolean') {
      paramCount++;
      updates.push(`is_official_competitor = $${paramCount}`);
      values.push(is_official_competitor);
    }

    if (typeof is_admin === 'boolean') {
      paramCount++;
      updates.push(`is_admin = $${paramCount}`);
      values.push(is_admin);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    paramCount++;
    values.push(id);

    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, username, email, is_admin, is_official_competitor`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

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
      SELECT h.*, u.username, u.is_official_competitor, u.profile_picture
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
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

module.exports = router;
