const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { pool } = require('../db');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

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
router.get('/:username', optionalAuth, async (req, res) => {
  try {
    const { username } = req.params;

    const userResult = await pool.query(
      'SELECT id, username, is_official_competitor, profile_picture, created_at FROM users WHERE username = $1',
      [username]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const viewerUserId = req.user ? req.user.id : null;
    const dogsResult = await pool.query(
      `SELECT h.*, u.username, u.is_official_competitor,
              COALESCE(ragg.avg_stars, 0)::float as avg_stars,
              COALESCE(ragg.rating_count, 0)::int as rating_count,
              my_r.stars::int as my_rating
       FROM hotdogs h
       JOIN users u ON h.user_id = u.id
       LEFT JOIN (
         SELECT hotdog_id, AVG(stars)::float as avg_stars, COUNT(*)::int as rating_count
         FROM ratings GROUP BY hotdog_id
       ) ragg ON ragg.hotdog_id = h.id
       LEFT JOIN ratings my_r ON my_r.hotdog_id = h.id AND my_r.user_id = $4
       WHERE h.user_id = $1
       ORDER BY h.created_at DESC
       LIMIT $2 OFFSET $3`,
      [user.id, limit, offset, viewerUserId]
    );

    const countResult = await pool.query('SELECT COUNT(*) FROM hotdogs WHERE user_id = $1', [user.id]);
    const total = parseInt(countResult.rows[0].count);

    const statsResult = await pool.query(
      'SELECT COALESCE(SUM(quantity), 0)::int as total_dogs, COUNT(*)::int as total_entries FROM hotdogs WHERE user_id = $1',
      [user.id]
    );

    res.json({
      user,
      stats: statsResult.rows[0],
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
      'UPDATE users SET profile_picture = $1 WHERE id = $2 RETURNING id, username, email, is_admin, is_official_competitor, profile_picture',
      [imageUrl, req.user.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Profile picture upload error:', err);
    res.status(500).json({ error: 'Failed to upload profile picture' });
  }
});

module.exports = router;
