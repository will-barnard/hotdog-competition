const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { inSeasonSql, officialSql } = require('../services/seasons');

const router = express.Router();

const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'));
    }
  }
});

// GET /api/profile/:username - public profile
router.get('/:username', async (req, res) => {
  try {
    const { username } = req.params;

    const userResult = await pool.query(
      `SELECT id, username, ${officialSql('users.id')} AS is_official_competitor, profile_picture, created_at FROM users WHERE username = $1`,
      [username]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const dogsResult = await pool.query(
      `SELECT h.*, u.username, ${officialSql()} AS is_official_competitor, u.profile_picture,
              COALESCE(cc.cnt, 0)::int as comment_count
       FROM hotdogs h
       JOIN users u ON h.user_id = u.id
       LEFT JOIN (
         SELECT hotdog_id, COUNT(*)::int as cnt FROM comments GROUP BY hotdog_id
       ) cc ON cc.hotdog_id = h.id
       WHERE h.user_id = $1
       ORDER BY h.created_at DESC
       LIMIT $2 OFFSET $3`,
      [user.id, limit, offset]
    );

    for (const row of dogsResult.rows) {
      if (row.photo_hidden) row.image_url = null;
    }

    const countResult = await pool.query('SELECT COUNT(*) FROM hotdogs WHERE user_id = $1', [user.id]);
    const total = parseInt(countResult.rows[0].count);

    const statsResult = await pool.query(
      'SELECT COALESCE(SUM(quantity), 0)::int as total_dogs, COUNT(*)::int as total_entries FROM hotdogs WHERE user_id = $1',
      [user.id]
    );

    // One row per season that has started, with this user's counted dogs and
    // their rank among everyone in that season. Seasons they sat out (no dogs,
    // not official) are dropped.
    const seasonsResult = await pool.query(`
      WITH totals AS (
        SELECT s.id AS season_id, h.user_id,
               SUM(h.quantity)::int AS dogs, COUNT(h.id)::int AS entries
        FROM seasons s JOIN hotdogs h ON ${inSeasonSql('h', 's')}
        GROUP BY s.id, h.user_id
      ), ranked AS (
        -- Ties on dogs share a rank, same as the leaderboard and Hall of Fame
        SELECT *, RANK() OVER (PARTITION BY season_id ORDER BY dogs DESC)::int AS rank
        FROM totals
      )
      SELECT s.id, s.name, s.starts_at, s.ends_at,
             (NOW() BETWEEN s.starts_at AND s.ends_at) AS is_active,
             COALESCE(r.dogs, 0) AS total_dogs,
             COALESCE(r.entries, 0) AS total_entries,
             r.rank,
             ${officialSql('$1', 's.id')} AS is_official
      FROM seasons s
      LEFT JOIN ranked r ON r.season_id = s.id AND r.user_id = $1
      WHERE s.starts_at <= NOW()
      ORDER BY s.starts_at DESC
    `, [user.id]);
    const seasons = seasonsResult.rows.filter(r => r.total_dogs > 0 || r.is_official);

    res.json({
      user,
      // All-time: every dog ever logged, exhibition included.
      stats: statsResult.rows[0],
      seasons,
      hotdogs: dogsResult.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    console.error('Profile error:', err);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

// POST /api/profile/picture - upload profile picture
router.post('/picture', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Image is required' });
    }

    const filename = 'pfp-' + crypto.randomBytes(16).toString('hex') + '.webp';
    const filepath = path.join(uploadsDir, filename);

    await sharp(req.file.buffer)
      .resize(400, 400, { fit: 'cover' })
      .webp({ quality: 80 })
      .toFile(filepath);

    // Delete old profile picture file if exists
    const oldResult = await pool.query('SELECT profile_picture FROM users WHERE id = $1', [req.user.id]);
    const oldPic = oldResult.rows[0]?.profile_picture;
    if (oldPic) {
      const oldPath = path.join(__dirname, '../../', oldPic);
      fs.unlink(oldPath, () => {}); // ignore errors
    }

    const imageUrl = `/uploads/${filename}`;
    const result = await pool.query(
      `UPDATE users SET profile_picture = $1 WHERE id = $2 RETURNING id, username, email, is_admin, ${officialSql('users.id')} AS is_official_competitor, profile_picture`,
      [imageUrl, req.user.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Profile picture upload error:', err);
    res.status(500).json({ error: 'Failed to upload profile picture' });
  }
});

module.exports = router;
