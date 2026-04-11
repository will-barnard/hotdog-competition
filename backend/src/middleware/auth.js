const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set. Refusing to start with an insecure default.');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Session expired, please log in again', code: 'TOKEN_EXPIRED' });
      }
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (!err) {
        req.user = user;
      }
      next();
    });
  } else {
    next();
  }
}

// Check the DB for current admin status — JWT claims can be stale.
const _adminPool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'hotdog_showdown',
  user: process.env.DB_USER || 'hotdog',
  password: process.env.DB_PASSWORD || 'hotdog_secret',
  max: 2,
});

async function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  try {
    const result = await _adminPool.query('SELECT is_admin FROM users WHERE id = $1', [req.user.id]);
    if (!result.rows.length || !result.rows[0].is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  } catch (err) {
    console.error('requireAdmin DB check failed:', err.message);
    return res.status(500).json({ error: 'Authorization check failed' });
  }
}

module.exports = { authenticateToken, optionalAuth, requireAdmin, JWT_SECRET };
