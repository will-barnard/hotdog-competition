// Season logic shared by every route that counts dogs or decides whether
// logging is open. Keep the rules here so the leaderboard, home stats,
// profiles and Hall of Fame can never disagree about what "counts".
const { pool } = require('../db');
const { localDateSql, todayLocal } = require('../competitionTime');

// SQL: does hotdog row <h> count toward season row <s>?
function inSeasonSql(h = 'h', s = 's') {
  return `(NOT ${h}.is_exhibition AND ${h}.date_eaten BETWEEN ${localDateSql(`${s}.starts_at`)} AND ${localDateSql(`${s}.ends_at`)})`;
}

// SQL: is <userCol> an official competitor in <seasonExpr>? Defaults to the
// current season, which is what every "✔" badge on the site means.
function officialSql(userCol = 'u.id', seasonExpr = 'current_season_id()') {
  return `EXISTS (SELECT 1 FROM season_officials so WHERE so.user_id = ${userCol} AND so.season_id = ${seasonExpr})`;
}

function statusOf(season, now = new Date()) {
  if (!season) return 'none';
  if (now < season.starts_at) return 'upcoming';
  if (now > season.ends_at) return 'ended';
  return 'active';
}

function withStatus(season) {
  return season ? { ...season, status: statusOf(season) } : null;
}

async function getCurrentSeason(db = pool) {
  const r = await db.query('SELECT id, name, starts_at, ends_at FROM seasons WHERE id = current_season_id()');
  return withStatus(r.rows[0] || null);
}

// ?season=<id> if given and real, otherwise the current season.
async function resolveSeason(idParam, db = pool) {
  const id = parseInt(idParam);
  if (!isNaN(id)) {
    const r = await db.query('SELECT id, name, starts_at, ends_at FROM seasons WHERE id = $1', [id]);
    if (r.rows.length) return withStatus(r.rows[0]);
  }
  return getCurrentSeason(db);
}

// Everything the site needs to decide what mode it is in.
async function getSeasonState(db = pool) {
  const [season, settingsRows] = await Promise.all([
    getCurrentSeason(db),
    db.query("SELECT key, value FROM settings WHERE key IN ('off_season_mode', 'hall_of_fame_public')")
  ]);
  const s = {};
  settingsRows.rows.forEach(r => { s[r.key] = r.value; });
  const status = season ? season.status : 'none';
  const offSeasonMode = s.off_season_mode === 'true';
  return {
    season,
    status,
    // The admin lever as set…
    off_season_mode: offSeasonMode,
    // …and whether it is in effect. A running season always wins, so leaving
    // the lever on when the next season starts can't turn its dogs into
    // exhibition dogs.
    off_season: offSeasonMode && status !== 'active',
    logging_open: status === 'active' || offSeasonMode,
    hall_of_fame_public: s.hall_of_fame_public === 'true'
  };
}

// Is a YYYY-MM-DD date inside the season's Central-time calendar days?
function dateInSeason(ymd, season) {
  if (!season) return false;
  return ymd >= todayLocal(season.starts_at) && ymd <= todayLocal(season.ends_at);
}

async function getSeasonStats(seasonId, db = pool) {
  if (!seasonId) {
    return { total_competitors: 0, total_official_competitors: 0, total_dogs: 0, total_entries: 0, prize_pool: 0 };
  }
  const r = await db.query(`
    SELECT
      COUNT(DISTINCT h.user_id)::int AS total_competitors,
      COALESCE(SUM(h.quantity), 0)::int AS total_dogs,
      COUNT(h.id)::int AS total_entries,
      (SELECT COUNT(*)::int FROM season_officials WHERE season_id = s.id) AS total_official_competitors
    FROM seasons s
    LEFT JOIN hotdogs h ON ${inSeasonSql('h', 's')}
    WHERE s.id = $1
    GROUP BY s.id
  `, [seasonId]);
  const row = r.rows[0] || { total_competitors: 0, total_official_competitors: 0, total_dogs: 0, total_entries: 0 };
  return { ...row, prize_pool: row.total_official_competitors * 5 };
}

module.exports = {
  inSeasonSql, officialSql, statusOf, withStatus,
  getCurrentSeason, resolveSeason, getSeasonState, dateInSeason, getSeasonStats
};
