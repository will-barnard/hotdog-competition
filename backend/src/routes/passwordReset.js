const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { pool } = require('../db');
const email = require('../services/email');

const router = express.Router();

// POST /api/password-reset/request — request a password reset email
router.post('/request', async (req, res) => {
  const { email: userEmail } = req.body;

  if (!userEmail) {
    return res.status(400).json({ error: 'Email is required' });
  }

  // Always return 200 to prevent email enumeration
  try {
    const result = await pool.query('SELECT id, username, email FROM users WHERE email = $1', [userEmail]);
    if (result.rows.length === 0) {
      return res.json({ message: 'If that email is registered, a reset link has been sent.' });
    }

    const user = result.rows[0];

    // Invalidate any existing unused tokens for this user
    await pool.query(
      `UPDATE password_reset_tokens SET used = TRUE WHERE user_id = $1 AND used = FALSE`,
      [user.id]
    );

    // Generate a secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [user.id, token, expiresAt]
    );

    // Build reset URL — uses FRONTEND_URL if set, otherwise falls back to allowed origin
    const frontendUrl = process.env.FRONTEND_URL || process.env.ALLOWED_ORIGINS?.split(',')[0]?.trim() || 'https://hotdogcompetition.com';
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #0e3386;">🌭 Hotdog Showdown — Password Reset</h2>
        <p>Hi <strong>${user.username}</strong>,</p>
        <p>You (or someone) requested a password reset for your Hotdog Showdown account.</p>
        <p style="margin: 24px 0;">
          <a href="${resetLink}" style="display: inline-block; padding: 12px 28px; background: #0e3386; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
            Reset My Password
          </a>
        </p>
        <p style="color: #888; font-size: 0.9rem;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
      </div>
    `;

    await email.sendEmail({
      to: user.email,
      subject: '🌭 Password Reset — Hotdog Showdown',
      html,
    });

    res.json({ message: 'If that email is registered, a reset link has been sent.' });
  } catch (err) {
    console.error('Password reset request error:', err);
    res.status(500).json({ error: 'Failed to process reset request' });
  }
});

// POST /api/password-reset/reset — actually reset the password with a valid token
router.post('/reset', async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const result = await pool.query(
      `SELECT t.id AS token_id, t.user_id, t.expires_at, t.used, u.username
       FROM password_reset_tokens t
       JOIN users u ON t.user_id = u.id
       WHERE t.token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const row = result.rows[0];

    if (row.used) {
      return res.status(400).json({ error: 'This reset token has already been used' });
    }

    if (new Date(row.expires_at) < new Date()) {
      return res.status(400).json({ error: 'This reset token has expired' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password and mark token as used — in a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, row.user_id]);
      await client.query('UPDATE password_reset_tokens SET used = TRUE WHERE id = $1', [row.token_id]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    console.log(`[PASSWORD RESET] Password reset for user: ${row.username}`);
    res.json({ message: 'Password has been reset successfully. You can now log in.' });
  } catch (err) {
    console.error('Password reset error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

module.exports = router;
