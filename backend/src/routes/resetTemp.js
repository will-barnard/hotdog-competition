// TEMPORARY — remove this file and its registration in index.js when done
const express = require('express');
const bcrypt = require('bcrypt');
const { pool } = require('../db');

const router = express.Router();

const RESET_SECRET = process.env.RESET_SECRET;

if (!RESET_SECRET) {
  console.warn('[TEMP RESET] WARNING: RESET_SECRET env var is not set. This endpoint is disabled.');
}

router.post('/', async (req, res) => {
  if (!RESET_SECRET) {
    return res.status(503).json({ error: 'Reset endpoint is disabled (no RESET_SECRET set)' });
  }

  const { secret, email, newPassword } = req.body;

  if (!secret || secret !== RESET_SECRET) {
    return res.status(403).json({ error: 'Invalid secret' });
  }

  if (!email || !newPassword) {
    return res.status(400).json({ error: 'Email and newPassword are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const passwordHash = await bcrypt.hash(newPassword, 12);
    const result = await pool.query(
      'UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING id, username, email',
      [passwordHash, email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No user found with that email' });
    }

    console.warn(`[TEMP RESET] Password reset for user: ${result.rows[0].username} (${email})`);
    res.json({ message: `Password reset for ${result.rows[0].username}` });
  } catch (err) {
    console.error('[TEMP RESET] Error:', err);
    res.status(500).json({ error: 'Reset failed' });
  }
});

module.exports = router;
