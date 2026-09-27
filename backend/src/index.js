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
const passwordResetRoutes = require('./routes/passwordReset');
const adminEmailRoutes = require('./routes/adminEmail');
const voteRoutes = require('./routes/vote');
const adminVoteRoutes = require('./routes/adminVote');
const adminSeasonRoutes = require('./routes/adminSeasons');
const hallOfFameRoutes = require('./routes/hallOfFame');
const emailService = require('./services/email');

const app = express();
const PORT = process.env.PORT || 3001;

// Requests reach us through two proxies: Beachhead's nginx-proxy (which sees
// the real client) and then the frontend container's nginx. Trusting only 1
// hop made req.ip the nginx-proxy container for EVERY visitor, so all rate
// limits were one bucket shared by the whole site. 2 hops = the real client
// IP, and it can't be spoofed because nginx-proxy appends the address it saw.
// Override with TRUST_PROXY_HOPS if another proxy (e.g. Cloudflare) is added.
app.set('trust proxy', parseInt(process.env.TRUST_PROXY_HOPS || '2', 10));
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
  // Per IP — but a household or a watch party on one wifi shares a public IP,
  // and every page load makes several API calls, so leave real headroom.
  max: 300,                  // 300 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
// The hot dog post limiter lives in routes/hotdogs.js — it's per user.
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/password-reset', authLimiter);
app.use('/api/', generalLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/hotdogs', hotdogRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/password-reset', passwordResetRoutes);
app.use('/api/admin/email', adminEmailRoutes);
app.use('/api/vote', voteRoutes);
app.use('/api/admin/vote', adminVoteRoutes);
app.use('/api/admin/seasons', adminSeasonRoutes);
app.use('/api/hall-of-fame', hallOfFameRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

async function start() {
  await db.initialize();
  emailService.init();
  emailService.startProcessor();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Hotdog Showdown API running on port ${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
