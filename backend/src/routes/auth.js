const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // First user to register becomes admin automatically
    const userCount = await pool.query('SELECT COUNT(*) FROM users');
    const isFirstUser = parseInt(userCount.rows[0].count) === 0;

    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash, is_admin) VALUES ($1, $2, $3, $4) RETURNING id, username, email, is_admin, is_official_competitor, profile_picture',
      [username, email, passwordHash, isFirstUser]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, username: user.username, is_admin: user.is_admin, is_official_competitor: user.is_official_competitor },
      JWT_SECRET,
      { expiresIn: '2y' }
    );

    res.status(201).json({ user, token });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await pool.query(
      'SELECT id, username, email, password_hash, is_admin, is_official_competitor, profile_picture FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, is_admin: user.is_admin, is_official_competitor: user.is_official_competitor },
      JWT_SECRET,
      { expiresIn: '2y' }
    );

    const { password_hash, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword, token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, is_admin, is_official_competitor, profile_picture, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

router.patch('/me', authenticateToken, async (req, res) => {
  try {
    const { username } = req.body;

    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const clean = username.trim();
    if (clean.length < 2 || clean.length > 50) {
      return res.status(400).json({ error: 'Username must be between 2 and 50 characters' });
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(clean)) {
      return res.status(400).json({ error: 'Username can only contain letters, numbers, underscores, dots, and hyphens' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE username = $1 AND id != $2', [clean, req.user.id]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const result = await pool.query(
      'UPDATE users SET username = $1 WHERE id = $2 RETURNING id, username, email, is_admin, is_official_competitor, profile_picture',
      [clean, req.user.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update username error:', err);
    res.status(500).json({ error: 'Failed to update username' });
  }
});

router.patch('/me/password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];

    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

module.exports = router;
