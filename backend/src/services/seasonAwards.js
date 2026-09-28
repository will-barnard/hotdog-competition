// Season awards for the Hall of Fame. Every stat only looks at dogs that
// count toward the season (same rule as the leaderboard: dated inside the
// season, not exhibition), and every rating stat ignores people rating their
// own dogs — the site allows it, so otherwise anyone could crown themselves.
//
// Each award is null when there isn't enough data yet; the thresholds below
// keep one lucky (or spiteful) rating from deciding a title.
const { pool } = require('../db');
const { inSeasonSql } = require('./seasons');

const THRESHOLDS = {
  ratingsPerDog: 3,      // highest / lowest rated dog: needs this many ratings
  ratedDogsForFavorite: 3, // photo favorite: needs this many rated dogs
  ratingsForHarshCritic: 5 // harshest critic: needs to have given this many ratings
};

// Dogs that count toward season $1. `visibleOnly` drops entries whose photo an
// admin hid — the photo is what's being rated/discussed in those awards.
function seasonDogs(visibleOnly = false) {
  return `
    s AS (SELECT * FROM seasons WHERE id = $1),
    d AS (
      SELECT h.* FROM hotdogs h CROSS JOIN s
      WHERE ${inSeasonSql('h', 's')} ${visibleOnly ? 'AND NOT h.photo_hidden' : ''}
    )`;
}

// Fields shown for an award that's about one specific entry.
const DOG_FIELDS = `d.id, d.title, d.quantity, d.date_eaten,
  CASE WHEN d.photo_hidden THEN NULL ELSE d.image_url END AS image_url,
  u.username, u.profile_picture`;

function ratedDogSql(direction) {
  return `
    WITH ${seasonDogs(true)},
    r AS (
      SELECT d.id, AVG(rt.stars)::float AS avg_stars, COUNT(*)::int AS rating_count
      FROM d JOIN ratings rt ON rt.hotdog_id = d.id AND rt.user_id <> d.user_id
      GROUP BY d.id HAVING COUNT(*) >= $2
    )
    SELECT ${DOG_FIELDS}, r.avg_stars, r.rating_count
    FROM r JOIN d ON d.id = r.id JOIN users u ON u.id = d.user_id
    ORDER BY r.avg_stars ${direction}, r.rating_count DESC, d.id
    LIMIT 1`;
}

const QUERIES = {
  highest_rated: [ratedDogSql('DESC'), [THRESHOLDS.ratingsPerDog]],
  lowest_rated: [ratedDogSql('ASC'), [THRESHOLDS.ratingsPerDog]],

  biggest_sitting: [`
    WITH ${seasonDogs()}
    SELECT ${DOG_FIELDS}
    FROM d JOIN users u ON u.id = d.user_id
    ORDER BY d.quantity DESC, d.created_at ASC
    LIMIT 1`, []],

  best_day: [`
    WITH ${seasonDogs()}
    SELECT u.username, u.profile_picture, d.date_eaten,
           SUM(d.quantity)::int AS dogs, COUNT(*)::int AS entries
    FROM d JOIN users u ON u.id = d.user_id
    GROUP BY u.id, d.date_eaten
    ORDER BY dogs DESC, d.date_eaten ASC
    LIMIT 1`, []],

  // Gaps-and-islands: consecutive dates share the same (date - row_number).
  longest_streak: [`
    WITH ${seasonDogs()},
    days AS (SELECT DISTINCT user_id, date_eaten AS day FROM d),
    g AS (
      SELECT user_id, day, day - (ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY day))::int AS grp
      FROM days
    )
    SELECT u.username, u.profile_picture, COUNT(*)::int AS days,
           MIN(g.day) AS start_day, MAX(g.day) AS end_day
    FROM g JOIN users u ON u.id = g.user_id
    GROUP BY u.id, g.grp
    ORDER BY days DESC, start_day ASC
    LIMIT 1`, []],

  // Average of each dog's average, so one heavily-rated dog doesn't dominate.
  photo_favorite: [`
    WITH ${seasonDogs(true)},
    per_dog AS (
      SELECT d.id, d.user_id, AVG(rt.stars) AS avg_stars
      FROM d JOIN ratings rt ON rt.hotdog_id = d.id AND rt.user_id <> d.user_id
      GROUP BY d.id, d.user_id
    )
    SELECT u.username, u.profile_picture, AVG(p.avg_stars)::float AS avg_stars, COUNT(*)::int AS rated_dogs
    FROM per_dog p JOIN users u ON u.id = p.user_id
    GROUP BY u.id
    HAVING COUNT(*) >= $2
    ORDER BY avg_stars DESC, rated_dogs DESC
    LIMIT 1`, [THRESHOLDS.ratedDogsForFavorite]],

  top_critic: [`
    WITH ${seasonDogs()}
    SELECT u.username, u.profile_picture, COUNT(*)::int AS ratings_given, AVG(rt.stars)::float AS avg_given
    FROM ratings rt JOIN d ON d.id = rt.hotdog_id AND rt.user_id <> d.user_id
    JOIN users u ON u.id = rt.user_id
    GROUP BY u.id
    ORDER BY ratings_given DESC, u.username
    LIMIT 1`, []],

  harshest_critic: [`
    WITH ${seasonDogs()}
    SELECT u.username, u.profile_picture, COUNT(*)::int AS ratings_given, AVG(rt.stars)::float AS avg_given
    FROM ratings rt JOIN d ON d.id = rt.hotdog_id AND rt.user_id <> d.user_id
    JOIN users u ON u.id = rt.user_id
    GROUP BY u.id
    HAVING COUNT(*) >= $2
    ORDER BY avg_given ASC, ratings_given DESC
    LIMIT 1`, [THRESHOLDS.ratingsForHarshCritic]],

  most_talked_about: [`
    WITH ${seasonDogs(true)},
    c AS (SELECT hotdog_id, COUNT(*)::int AS comment_count FROM comments GROUP BY hotdog_id)
    SELECT ${DOG_FIELDS}, c.comment_count
    FROM d JOIN c ON c.hotdog_id = d.id JOIN users u ON u.id = d.user_id
    ORDER BY c.comment_count DESC, d.id
    LIMIT 1`, []],

  busiest_day: [`
    WITH ${seasonDogs()}
    SELECT d.date_eaten, SUM(d.quantity)::int AS dogs,
           COUNT(DISTINCT d.user_id)::int AS eaters, COUNT(*)::int AS entries
    FROM d
    GROUP BY d.date_eaten
    ORDER BY dogs DESC, d.date_eaten ASC
    LIMIT 1`, []],

  // The last counted entry posted before the season closed. Only meaningful
  // once the season is over. created_at is a plain TIMESTAMP (server time),
  // so cast it before comparing with the season's end.
  buzzer_beater: [`
    WITH ${seasonDogs()}
    SELECT ${DOG_FIELDS}, d.created_at::timestamptz AS posted_at,
           GREATEST(0, EXTRACT(EPOCH FROM (s.ends_at - d.created_at::timestamptz)))::int AS seconds_before_end
    FROM d CROSS JOIN s JOIN users u ON u.id = d.user_id
    ORDER BY d.created_at DESC
    LIMIT 1`, [], { endedOnly: true }]
};

async function getSeasonAwards(seasonId, { ended }) {
  const names = Object.keys(QUERIES);
  const results = await Promise.all(names.map(name => {
    const [sql, extra, opts = {}] = QUERIES[name];
    if (opts.endedOnly && !ended) return Promise.resolve(null);
    return pool.query(sql, [seasonId, ...extra]).then(r => r.rows[0] || null);
  }));
  const awards = {};
  names.forEach((name, i) => { awards[name] = results[i]; });
  return awards;
}

module.exports = { getSeasonAwards, THRESHOLDS };
