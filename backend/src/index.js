const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const db = require('./db');
const authRoutes = require('./routes/auth');
const hotdogRoutes = require('./routes/hotdogs');
const adminRoutes = require('./routes/admin');
const leaderboardRoutes = require('./routes/leaderboard');
const settingsRoutes = require('./routes/settings');
const profileRoutes = require('./routes/profile');
const commentRoutes = require('./routes/comments');
const ratingRoutes = require('./routes/ratings');
const resetTempRoutes = require('./routes/resetTemp'); // TEMPORARY

const app = express();
const PORT = process.env.PORT || 3001;

app.set('trust proxy', 1);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://hotdogcompetition.com')
  .split(',').map(o => o.trim()).filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    // Allow requests with no origin (curl, Postman, server-to-server, health checks)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rate limiting — auth endpoints get a tighter window
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,                   // 30 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,  // 1 minute
  max: 120,                  // 120 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
const hotdogPostLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,  // 1 minute
  max: 2,                    // 2 hotdog posts per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Slow down! Maximum 2 hotdog posts per minute.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/temp-reset', authLimiter);
app.use('/api/', generalLimiter);
app.post('/api/hotdogs', hotdogPostLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/hotdogs', hotdogRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/temp-reset', resetTempRoutes); // TEMPORARY

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

async function start() {
  await db.initialize();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Hotdog Showdown API running on port ${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
