const express = require('express');
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/ratings/:hotdogId - upsert a rating (1-5 stars)
router.post('/:hotdogId', authenticateToken, async (req, res) => {
  const hotdogId = parseInt(req.params.hotdogId);
  if (isNaN(hotdogId)) return res.status(400).json({ error: 'Invalid hotdog ID' });

  const stars = parseInt(req.body.stars);
  if (isNaN(stars) || stars < 1 || stars > 5) {
    return res.status(400).json({ error: 'Stars must be between 1 and 5' });
  }

  try {
    const dogCheck = await pool.query('SELECT id FROM hotdogs WHERE id = $1', [hotdogId]);
    if (dogCheck.rows.length === 0) return res.status(404).json({ error: 'Hot dog not found' });

    await pool.query(
      `INSERT INTO ratings (hotdog_id, user_id, stars)
       VALUES ($1, $2, $3)
       ON CONFLICT (hotdog_id, user_id) DO UPDATE SET stars = EXCLUDED.stars`,
      [hotdogId, req.user.id, stars]
    );

    const agg = await pool.query(
      `SELECT COALESCE(AVG(stars), 0)::float as avg_stars,
              COUNT(*)::int as rating_count
       FROM ratings WHERE hotdog_id = $1`,
      [hotdogId]
    );

    res.json({ success: true, my_rating: stars, ...agg.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/ratings/:hotdogId - remove own rating
router.delete('/:hotdogId', authenticateToken, async (req, res) => {
  const hotdogId = parseInt(req.params.hotdogId);
  if (isNaN(hotdogId)) return res.status(400).json({ error: 'Invalid hotdog ID' });

  try {
    await pool.query(
      'DELETE FROM ratings WHERE hotdog_id = $1 AND user_id = $2',
      [hotdogId, req.user.id]
    );

    const agg = await pool.query(
      `SELECT COALESCE(AVG(stars), 0)::float as avg_stars,
              COUNT(*)::int as rating_count
       FROM ratings WHERE hotdog_id = $1`,
      [hotdogId]
    );

    res.json({ success: true, my_rating: null, ...agg.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
