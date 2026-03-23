const express = require('express');
const { pool } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.username, u.email, u.is_admin, u.is_official_competitor, u.created_at,
             COALESCE(SUM(h.quantity), 0) as total_dogs
      FROM users u
      LEFT JOIN hotdogs h ON u.id = h.user_id
      GROUP BY u.id
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
      SELECT h.*, u.username, u.is_official_competitor
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

    const { title, description, quantity } = req.body;
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

module.exports = router;
