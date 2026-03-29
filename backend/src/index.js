const express = require('express');
const cors = require('cors');
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

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

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
