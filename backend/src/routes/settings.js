const express = require('express');
const { pool } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { getSeasonState, getSeasonStats } = require('../services/seasons');

const router = express.Router();

// Loaded by every page, so the season state rides along here rather than
// costing a second request.
async function loadSettings() {
  const [result, state] = await Promise.all([
    pool.query('SELECT key, value FROM settings'),
    getSeasonState()
  ]);
  const settings = {};
  result.rows.forEach(row => { settings[row.key] = row.value; });
  // competition_start / competition_end are derived from the current season
  // now; the stored legacy values are ignored.
  settings.competition_start = state.season ? state.season.starts_at.toISOString() : null;
  settings.competition_end = state.season ? state.season.ends_at.toISOString() : null;
  return { ...settings, ...state };
}

router.get('/', async (req, res) => {
  try {
    res.json(await loadSettings());
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

const ALLOWED_SETTINGS_KEYS = [
  // Season dates are edited through /api/admin/seasons, not here.
  'rules', 'off_season_mode', 'hall_of_fame_public',
  'home_show_total_competitors', 'home_show_total_official_competitors',
  'home_show_total_dogs', 'home_show_total_entries', 'home_show_prize_pool',
  'site_warning_enabled', 'site_warning_text', 'site_warning_style',
  'welcome_email_enabled', 'welcome_email_delay_minutes', 'welcome_email_subject', 'welcome_email_body',
  'nav_show_vote'
];

router.put('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    for (const key of ALLOWED_SETTINGS_KEYS) {
      if (req.body[key] !== undefined) {
        await pool.query(
          'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
          [key, String(req.body[key])]
        );
      }
    }

    res.json(await loadSettings());
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Home page stats — scoped to the current season (running, next, or the one
// that just ended, in which case these are its final numbers).
router.get('/stats', async (req, res) => {
  try {
    const state = await getSeasonState();
    const stats = await getSeasonStats(state.season && state.season.id);
    res.json({ ...stats, season: state.season });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

module.exports = router;
