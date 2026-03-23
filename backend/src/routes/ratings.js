const express = require('express');
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/ratings/batch?ids=1,2,3&userId=X - batch fetch ratings for multiple hotdogs
router.get('/batch', async (req, res) => {
  try {
    const idsParam = req.query.ids || '';
    const ids = idsParam.split(',').map(Number).filter(n => !isNaN(n) && n > 0);
    if (ids.length === 0) return res.json({ ratings: {} });

    const userId = req.query.userId ? parseInt(req.query.userId) : null;

    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const aggResult = await pool.query(
      `SELECT hotdog_id, AVG(stars)::float as avg_stars, COUNT(*)::int as rating_count
       FROM ratings WHERE hotdog_id IN (${placeholders}) GROUP BY hotdog_id`,
      ids
    );

    const ratingsMap = {};
    for (const id of ids) {
      ratingsMap[id] = { avg_stars: 0, rating_count: 0, my_rating: null };
    }
    for (const row of aggResult.rows) {
      ratingsMap[row.hotdog_id].avg_stars = row.avg_stars;
      ratingsMap[row.hotdog_id].rating_count = row.rating_count;
    }

    if (userId) {
      const myResult = await pool.query(
        `SELECT hotdog_id, stars FROM ratings WHERE hotdog_id IN (${placeholders}) AND user_id = $${ids.length + 1}`,
        [...ids, userId]
      );
      for (const row of myResult.rows) {
        ratingsMap[row.hotdog_id].my_rating = row.stars;
      }
    }

    res.json({ ratings: ratingsMap });
  } catch (err) {
    // If ratings table doesn't exist yet, return empty
    if (err.code === '42P01') {
      return res.json({ ratings: {} });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

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
