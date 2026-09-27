const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const exifr = require('exifr');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { pool } = require('../db');
const { todayLocal, addDays } = require('../competitionTime');
const { inSeasonSql, officialSql, getSeasonState, dateInSeason } = require('../services/seasons');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'));
    }
  }
});

router.post('/', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Image is required' });
    }

    const { title, quantity, description, date_eaten } = req.body;

    if (!title || !quantity) {
      return res.status(400).json({ error: 'Title and quantity are required' });
    }

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 1 || qty > 100) {
      return res.status(400).json({ error: 'Quantity must be between 1 and 100' });
    }

    // Validate date_eaten: must be provided, not in the future, within 3 days
    if (!date_eaten) {
      return res.status(400).json({ error: 'Date eaten is required' });
    }
    // Compare calendar days in competition time. The container clock is UTC,
    // so "today" computed with setHours() flipped to tomorrow at 7pm CDT.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date_eaten)) {
      return res.status(400).json({ error: 'Date eaten must be YYYY-MM-DD' });
    }
    const today = todayLocal();
    const threeDaysAgo = addDays(today, -3);

    if (date_eaten > today) {
      return res.status(400).json({ error: 'Cannot log future hot dogs' });
    }
    if (date_eaten < threeDaysAgo) {
      return res.status(400).json({ error: 'Hot dogs can only be logged within 3 days of eating' });
    }

    // Logging is open while a season runs, or anytime the admin has
    // Off-Season mode on. Anything logged outside a running season — or dated
    // outside it — is exhibition and never counts toward any season.
    const state = await getSeasonState();
    if (!state.logging_open) {
      return res.status(400).json({ error: 'The season has ended. Logging is closed.' });
    }
    const isExhibition = !(state.status === 'active' && dateInSeason(date_eaten, state.season));

    const filename = crypto.randomBytes(16).toString('hex') + '.webp';
    const filepath = path.join(uploadsDir, filename);

    await sharp(req.file.buffer)
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(filepath);

    const imageUrl = `/uploads/${filename}`;

    // Extract EXIF date and compare to claimed date_eaten
    let dateMismatch = null; // null = no EXIF data, true = mismatch, false = match
    try {
      const exif = await exifr.parse(req.file.buffer, { pick: ['DateTimeOriginal', 'CreateDate'] });
      const exifDate = exif?.DateTimeOriginal || exif?.CreateDate;
      if (exifDate) {
        const exifDay = new Date(exifDate).toISOString().slice(0, 10);
        dateMismatch = exifDay !== date_eaten;
      }
    } catch {
      // No EXIF or parse failure — leave as null
    }

    const result = await pool.query(
      'INSERT INTO hotdogs (user_id, title, description, quantity, image_url, date_eaten, date_mismatch, is_exhibition) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [req.user.id, title, description || null, qty, imageUrl, date_eaten, dateMismatch, isExhibition]
    );

    const hotdog = result.rows[0];

    const userResult = await pool.query(`SELECT username, ${officialSql('users.id')} AS is_official_competitor FROM users WHERE id = $1`, [req.user.id]);
    hotdog.username = userResult.rows[0].username;
    hotdog.is_official_competitor = userResult.rows[0].is_official_competitor;

    res.status(201).json(hotdog);
  } catch (err) {
    console.error('Create hotdog error:', err);
    res.status(500).json({ error: 'Failed to log hot dog' });
  }
});

router.get('/feed', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const result = await pool.query(`
      SELECT h.*, u.username, ${officialSql()} AS is_official_competitor, u.profile_picture,
             COALESCE(cc.cnt, 0)::int as comment_count
      FROM hotdogs h
      JOIN users u ON h.user_id = u.id
      LEFT JOIN (
        SELECT hotdog_id, COUNT(*)::int as cnt FROM comments GROUP BY hotdog_id
      ) cc ON cc.hotdog_id = h.id
      ORDER BY h.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    const countResult = await pool.query('SELECT COUNT(*) FROM hotdogs');
    const total = parseInt(countResult.rows[0].count);

    for (const row of result.rows) {
      if (row.photo_hidden) row.image_url = null;
    }

    res.json({
      hotdogs: result.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    console.error('Feed error:', err);
    res.status(500).json({ error: 'Failed to load feed' });
  }
})

router.get('/my-feed', authenticateToken, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const result = await pool.query(`
      SELECT h.*, u.username, ${officialSql()} AS is_official_competitor, u.profile_picture,
             COALESCE(cc.cnt, 0)::int as comment_count
      FROM hotdogs h
      JOIN users u ON h.user_id = u.id
      LEFT JOIN (
        SELECT hotdog_id, COUNT(*)::int as cnt FROM comments GROUP BY hotdog_id
      ) cc ON cc.hotdog_id = h.id
      WHERE h.user_id = $1
      ORDER BY h.created_at DESC
      LIMIT $2 OFFSET $3
    `, [req.user.id, limit, offset]);

    const countResult = await pool.query('SELECT COUNT(*) FROM hotdogs WHERE user_id = $1', [req.user.id]);
    const total = parseInt(countResult.rows[0].count);

    for (const row of result.rows) {
      if (row.photo_hidden) row.image_url = null;
    }

    // Current season only, so this matches the leaderboard
    const totalDogs = await pool.query(
      `SELECT COALESCE(SUM(h.quantity), 0)::int as total
       FROM seasons s JOIN hotdogs h ON h.user_id = $1 AND ${inSeasonSql('h', 's')}
       WHERE s.id = current_season_id()`,
      [req.user.id]
    );

    res.json({
      hotdogs: result.rows,
      total_dogs_eaten: totalDogs.rows[0].total,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    console.error('My feed error:', err);
    res.status(500).json({ error: 'Failed to load your feed' });
  }
})

router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

    const result = await pool.query(`
      SELECT h.*, u.username, ${officialSql()} AS is_official_competitor, u.profile_picture
      FROM hotdogs h
      JOIN users u ON h.user_id = u.id
      WHERE h.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Hot dog not found' });
    }

    const row = result.rows[0];
    if (row.photo_hidden) row.image_url = null;

    res.json(row);
  } catch (err) {
    console.error('Get hotdog error:', err);
    res.status(500).json({ error: 'Failed to load hot dog' });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

    const hotdog = await pool.query('SELECT * FROM hotdogs WHERE id = $1', [id]);
    if (hotdog.rows.length === 0) {
      return res.status(404).json({ error: 'Hot dog not found' });
    }

    if (hotdog.rows[0].user_id !== req.user.id && !req.user.is_admin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await pool.query('DELETE FROM hotdogs WHERE id = $1', [id]);
    res.json({ message: 'Hot dog deleted' });
  } catch (err) {
    console.error('Delete hotdog error:', err);
    res.status(500).json({ error: 'Failed to delete hot dog' });
  }
});

module.exports = router;
