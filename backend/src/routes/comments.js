const express = require('express');
const { pool } = require('../db');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/comments/:hotdogId - get all comments for a hotdog
router.get('/:hotdogId', optionalAuth, async (req, res) => {
  const hotdogId = parseInt(req.params.hotdogId);
  if (isNaN(hotdogId)) return res.status(400).json({ error: 'Invalid hotdog ID' });

  try {
    const result = await pool.query(
      `SELECT c.id, c.content, c.created_at,
              u.username, u.profile_picture, u.id AS user_id
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.hotdog_id = $1
       ORDER BY c.created_at ASC`,
      [hotdogId]
    );
    res.json({ comments: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/comments/:hotdogId - add a comment
router.post('/:hotdogId', authenticateToken, async (req, res) => {
  const hotdogId = parseInt(req.params.hotdogId);
  if (isNaN(hotdogId)) return res.status(400).json({ error: 'Invalid hotdog ID' });

  const { content } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Comment cannot be empty' });
  }
  const trimmed = content.trim();
  if (trimmed.length > 500) {
    return res.status(400).json({ error: 'Comment must be 500 characters or fewer' });
  }

  try {
    // Verify hotdog exists
    const dogCheck = await pool.query('SELECT id FROM hotdogs WHERE id = $1', [hotdogId]);
    if (dogCheck.rows.length === 0) return res.status(404).json({ error: 'Hot dog not found' });

    const result = await pool.query(
      `INSERT INTO comments (hotdog_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, content, created_at`,
      [hotdogId, req.user.id, trimmed]
    );

    const comment = result.rows[0];
    res.status(201).json({
      comment: {
        ...comment,
        username: req.user.username,
        profile_picture: req.user.profile_picture || null,
        user_id: req.user.id
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/comments/:id - delete a comment (own or admin)
router.delete('/:id', authenticateToken, async (req, res) => {
  const commentId = parseInt(req.params.id);
  if (isNaN(commentId)) return res.status(400).json({ error: 'Invalid comment ID' });

  try {
    const result = await pool.query('SELECT user_id FROM comments WHERE id = $1', [commentId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Comment not found' });

    const comment = result.rows[0];
    if (comment.user_id !== req.user.id && !req.user.is_admin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await pool.query('DELETE FROM comments WHERE id = $1', [commentId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
