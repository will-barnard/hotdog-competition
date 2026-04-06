#!/usr/bin/env bash
# =============================================================================
# seed-dev-data.sh
# Injects dummy data into the dev database.
# Run AFTER starting dev containers and creating your admin account.
# Usage: ./seed-dev-data.sh
# =============================================================================

set -e

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5433}"
DB_NAME="${DB_NAME:-hotdog_showdown}"
DB_USER="${DB_USER:-hotdog}"

# Load DB_PASSWORD from .env if not already set
if [ -z "$DB_PASSWORD" ] && [ -f ".env" ]; then
  export DB_PASSWORD=$(grep '^DB_PASSWORD=' .env | cut -d '=' -f2-)
fi

if [ -z "$DB_PASSWORD" ]; then
  echo "ERROR: DB_PASSWORD not set. Set it as an env var or ensure .env exists."
  exit 1
fi

export PGPASSWORD="$DB_PASSWORD"

PSQL="psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"

echo ""
echo "=== Hotdog Showdown Dev Data Seeder ==="
echo "Connecting to $DB_HOST:$DB_PORT/$DB_NAME as $DB_USER"
echo ""

# Verify connection
$PSQL -c "SELECT 1" > /dev/null 2>&1 || {
  echo "ERROR: Could not connect to the database."
  echo "Make sure dev containers are running: docker compose -f docker-compose.dev.yml up -d"
  exit 1
}

echo "Connected. Seeding dummy data..."
echo ""

$PSQL <<'SQL'

-- ============================================================
-- 1. USERS (hashed password = "password123" via bcrypt cost 10)
--    We insert a known bcrypt hash so we don't need Node.js here.
--    All dummy users have password: password123
-- ============================================================
INSERT INTO users (username, email, password_hash, is_admin, is_official_competitor, created_at)
VALUES
  ('joey_dogs',     'joey@example.com',     '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', false, true,  NOW() - INTERVAL '30 days'),
  ('frank_buns',    'frank@example.com',    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', false, true,  NOW() - INTERVAL '28 days'),
  ('sausage_queen', 'queen@example.com',    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', false, true,  NOW() - INTERVAL '25 days'),
  ('mustard_mike',  'mike@example.com',     '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', false, true,  NOW() - INTERVAL '20 days'),
  ('relish_rita',   'rita@example.com',     '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', false, false, NOW() - INTERVAL '18 days'),
  ('ketchup_karl',  'karl@example.com',     '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', false, false, NOW() - INTERVAL '15 days'),
  ('nacho_nina',    'nina@example.com',     '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', false, true,  NOW() - INTERVAL '12 days'),
  ('bunmaster',     'bun@example.com',      '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', false, true,  NOW() - INTERVAL '10 days'),
  ('grill_gus',     'gus@example.com',      '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', false, false, NOW() - INTERVAL '7 days'),
  ('chicago_champ', 'champ@example.com',    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', false, true,  NOW() - INTERVAL '5 days')
ON CONFLICT (username) DO NOTHING;

-- ============================================================
-- 2. HOTDOG ENTRIES
--    Uses a placeholder image URL (publicly accessible hot dog image).
--    date_eaten spread across the competition window (July 4 – Sept 7 2026)
--    but for dev we use recent dates so the leaderboard is active.
-- ============================================================

-- Helper: get user ids by username
DO $$
DECLARE
  u_joey         INT;
  u_frank        INT;
  u_queen        INT;
  u_mike         INT;
  u_rita         INT;
  u_karl         INT;
  u_nina         INT;
  u_bun          INT;
  u_gus          INT;
  u_champ        INT;
BEGIN
  SELECT id INTO u_joey   FROM users WHERE username = 'joey_dogs';
  SELECT id INTO u_frank  FROM users WHERE username = 'frank_buns';
  SELECT id INTO u_queen  FROM users WHERE username = 'sausage_queen';
  SELECT id INTO u_mike   FROM users WHERE username = 'mustard_mike';
  SELECT id INTO u_rita   FROM users WHERE username = 'relish_rita';
  SELECT id INTO u_karl   FROM users WHERE username = 'ketchup_karl';
  SELECT id INTO u_nina   FROM users WHERE username = 'nacho_nina';
  SELECT id INTO u_bun    FROM users WHERE username = 'bunmaster';
  SELECT id INTO u_gus    FROM users WHERE username = 'grill_gus';
  SELECT id INTO u_champ  FROM users WHERE username = 'chicago_champ';

  INSERT INTO hotdogs (user_id, title, description, quantity, image_url, date_eaten, created_at) VALUES
    -- joey_dogs: total 14 dogs across 4 entries
    (u_joey,  'Opening Day Dogs',         'Crushed 4 at the ballpark opener. Mustard only, no ketchup — ever.',   4, 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Hotdog_-_Evan_Swigart.jpg/640px-Hotdog_-_Evan_Swigart.jpg', CURRENT_DATE - 20, NOW() - INTERVAL '20 days'),
    (u_joey,  'Late Night Snack Run',      'Two dogs after the Cubs game. Worth every calorie.',                   2, 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Hotdog_-_Evan_Swigart.jpg/640px-Hotdog_-_Evan_Swigart.jpg', CURRENT_DATE - 15, NOW() - INTERVAL '15 days'),
    (u_joey,  'Lunch Gauntlet',            'Ate 5 in under 12 minutes. Personal record.',                         5, 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Hotdog_-_Evan_Swigart.jpg/640px-Hotdog_-_Evan_Swigart.jpg', CURRENT_DATE - 10, NOW() - INTERVAL '10 days'),
    (u_joey,  'Sunday Funday Finale',      'Three with the crew. Who needs brunch?',                              3, 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Hotdog_-_Evan_Swigart.jpg/640px-Hotdog_-_Evan_Swigart.jpg', CURRENT_DATE - 3,  NOW() - INTERVAL '3 days'),

    -- frank_buns: 11 dogs
    (u_frank, 'Backyard BBQ Blitz',        'Grilled 6 myself. Smoked jalapeño cheddar dogs.',                     6, 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Hotdog_-_Evan_Swigart.jpg/640px-Hotdog_-_Evan_Swigart.jpg', CURRENT_DATE - 18, NOW() - INTERVAL '18 days'),
    (u_frank, 'Gas Station Detour',        'Two questionable rollers at 11pm. No regrets.',                       2, 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Hotdog_-_Evan_Swigart.jpg/640px-Hotdog_-_Evan_Swigart.jpg', CURRENT_DATE - 12, NOW() - INTERVAL '12 days'),
    (u_frank, 'Park District Classic',     'Three at the park concession stand.',                                 3, 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Hotdog_-_Evan_Swigart.jpg/640px-Hotdog_-_Evan_Swigart.jpg', CURRENT_DATE - 5,  NOW() - INTERVAL '5 days'),

    -- sausage_queen: 11 dogs
    (u_queen, 'Wrigley Upper Deck Run',    'Four dogs in three innings. Stay hydrated, people.',                  4, 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Hotdog_-_Evan_Swigart.jpg/640px-Hotdog_-_Evan_Swigart.jpg', CURRENT_DATE - 22, NOW() - INTERVAL '22 days'),
    (u_queen, 'The Relish Incident',       'Tried relish for the first time. Ate 3 to cope.',                    3, 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Hotdog_-_Evan_Swigart.jpg/640px-Hotdog_-_Evan_Swigart.jpg', CURRENT_DATE - 14, NOW() - INTERVAL '14 days'),
    (u_queen, 'Championship Prep',         'Four dogs as training for the big day.',                              4, 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Hotdog_-_Evan_Swigart.jpg/640px-Hotdog_-_Evan_Swigart.jpg', CURRENT_DATE - 6,  NOW() - INTERVAL '6 days'),

    -- mustard_mike: 9 dogs
    (u_mike,  'Mustard Only Monday',       'Three dogs, mustard only. The only correct way.',                     3, 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Hotdog_-_Evan_Swigart.jpg/640px-Hotdog_-_Evan_Swigart.jpg', CURRENT_DATE - 19, NOW() - INTERVAL '19 days'),
    (u_mike,  'Double Dog Dare',           'Two dogs, ate standing up at a food cart.',                           2, 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Hotdog_-_Evan_Swigart.jpg/640px-Hotdog_-_Evan_Swigart.jpg', CURRENT_DATE - 9,  NOW() - INTERVAL '9 days'),
    (u_mike,  'Friday Night Feast',        'Four dogs while watching the game at home.',                          4, 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Hotdog_-_Evan_Swigart.jpg/640px-Hotdog_-_Evan_Swigart.jpg', CURRENT_DATE - 2,  NOW() - INTERVAL '2 days'),

    -- relish_rita: 7 dogs (non-competitor)
    (u_rita,  'Street Fair Discovery',     'Found the best hot dog cart in the city. Ate two.',                   2, 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Hotdog_-_Evan_Swigart.jpg/640px-Hotdog_-_Evan_Swigart.jpg', CURRENT_DATE - 16, NOW() - INTERVAL '16 days'),
    (u_rita,  'Rita''s Five for Five',      'Five dogs in five different styles. Ranked them.',                   5, 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Hotdog_-_Evan_Swigart.jpg/640px-Hotdog_-_Evan_Swigart.jpg', CURRENT_DATE - 8,  NOW() - INTERVAL '8 days'),

    -- ketchup_karl: 6 dogs (non-competitor, uses ketchup, the heathen)
    (u_karl,  'Controversial Log',         'Put ketchup on all of them. Three dogs.',                             3, 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Hotdog_-_Evan_Swigart.jpg/640px-Hotdog_-_Evan_Swigart.jpg', CURRENT_DATE - 13, NOW() - INTERVAL '13 days'),
    (u_karl,  'Karl Doubles Down',         'Three more. Still used ketchup.',                                     3, 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Hotdog_-_Evan_Swigart.jpg/640px-Hotdog_-_Evan_Swigart.jpg', CURRENT_DATE - 4,  NOW() - INTERVAL '4 days'),

    -- nacho_nina: 8 dogs
    (u_nina,  'Nachos AND Dogs?',          'Proved you can have both. Four dogs alongside nachos.',               4, 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Hotdog_-_Evan_Swigart.jpg/640px-Hotdog_-_Evan_Swigart.jpg', CURRENT_DATE - 17, NOW() - INTERVAL '17 days'),
    (u_nina,  'Nina''s Night Out',          'Four dogs between two bars on Wrigleyville.',                        4, 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Hotdog_-_Evan_Swigart.jpg/640px-Hotdog_-_Evan_Swigart.jpg', CURRENT_DATE - 7,  NOW() - INTERVAL '7 days'),

    -- bunmaster: 5 dogs
    (u_bun,   'Bun Appreciation Post',     'Two classic Chicago-style. The bun is underrated.',                   2, 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Hotdog_-_Evan_Swigart.jpg/640px-Hotdog_-_Evan_Swigart.jpg', CURRENT_DATE - 11, NOW() - INTERVAL '11 days'),
    (u_bun,   'Triple Threat',             'Three dogs back to back. Bun held up every time.',                    3, 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Hotdog_-_Evan_Swigart.jpg/640px-Hotdog_-_Evan_Swigart.jpg', CURRENT_DATE - 1,  NOW() - INTERVAL '1 day'),

    -- grill_gus: 4 dogs (non-competitor)
    (u_gus,   'Grill Test Run',            'Four dogs off my new pellet grill. Incredible results.',              4, 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Hotdog_-_Evan_Swigart.jpg/640px-Hotdog_-_Evan_Swigart.jpg', CURRENT_DATE - 9,  NOW() - INTERVAL '9 days'),

    -- chicago_champ: 12 dogs
    (u_champ, 'True Chicago Style',        'Four dogs, dragged through the garden. Perfect.',                     4, 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Hotdog_-_Evan_Swigart.jpg/640px-Hotdog_-_Evan_Swigart.jpg', CURRENT_DATE - 21, NOW() - INTERVAL '21 days'),
    (u_champ, 'Lunch Back-to-Back',        'Four more. I am become dog.',                                         4, 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Hotdog_-_Evan_Swigart.jpg/640px-Hotdog_-_Evan_Swigart.jpg', CURRENT_DATE - 11, NOW() - INTERVAL '11 days'),
    (u_champ, 'Championship Mentality',    'Four to close out the week. Eyes on the prize.',                      4, 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Hotdog_-_Evan_Swigart.jpg/640px-Hotdog_-_Evan_Swigart.jpg', CURRENT_DATE - 2,  NOW() - INTERVAL '2 days');

END $$;

-- ============================================================
-- 3. COMMENTS
-- ============================================================
DO $$
DECLARE
  ids INT[];
  u_joey INT; u_frank INT; u_queen INT; u_mike INT; u_rita INT;
  u_nina INT; u_bun INT; u_champ INT;
BEGIN
  SELECT id INTO u_joey  FROM users WHERE username = 'joey_dogs';
  SELECT id INTO u_frank FROM users WHERE username = 'frank_buns';
  SELECT id INTO u_queen FROM users WHERE username = 'sausage_queen';
  SELECT id INTO u_mike  FROM users WHERE username = 'mustard_mike';
  SELECT id INTO u_rita  FROM users WHERE username = 'relish_rita';
  SELECT id INTO u_nina  FROM users WHERE username = 'nacho_nina';
  SELECT id INTO u_bun   FROM users WHERE username = 'bunmaster';
  SELECT id INTO u_champ FROM users WHERE username = 'chicago_champ';

  SELECT ARRAY(SELECT id FROM hotdogs ORDER BY id LIMIT 10) INTO ids;

  INSERT INTO comments (hotdog_id, user_id, content, created_at) VALUES
    (ids[1], u_frank, 'Respect. Opening day fuel.',               NOW() - INTERVAL '19 days'),
    (ids[1], u_queen, 'Mustard only is the law.',                 NOW() - INTERVAL '19 days'),
    (ids[1], u_champ, 'Four is a warm-up, not a flex.',           NOW() - INTERVAL '18 days'),
    (ids[2], u_bun,   'Gas station dogs hit different at 11pm.',  NOW() - INTERVAL '11 days'),
    (ids[2], u_nina,  'No regrets is the right attitude.',        NOW() - INTERVAL '11 days'),
    (ids[3], u_joey,  'Five in 12 min is serious business.',      NOW() - INTERVAL '13 days'),
    (ids[3], u_mike,  'What''s your training regimen?',            NOW() - INTERVAL '13 days'),
    (ids[4], u_rita,  'Chicago style supremacy confirmed.',       NOW() - INTERVAL '5 days'),
    (ids[4], u_frank, 'Four dogs in three innings is the pace.',  NOW() - INTERVAL '5 days'),
    (ids[5], u_champ, 'Ketchup 😤',                              NOW() - INTERVAL '3 days'),
    (ids[5], u_nina,  'We don''t talk about that.',               NOW() - INTERVAL '3 days'),
    (ids[6], u_bun,   'Bun integrity is everything.',             NOW() - INTERVAL '2 days'),
    (ids[6], u_joey,  'The bun is a support structure. Respect.', NOW() - INTERVAL '2 days');

END $$;

-- ============================================================
-- 4. RATINGS
-- ============================================================
DO $$
DECLARE
  ids INT[];
  u_joey INT; u_frank INT; u_queen INT; u_mike INT;
  u_nina INT; u_bun INT; u_champ INT; u_rita INT;
BEGIN
  SELECT id INTO u_joey  FROM users WHERE username = 'joey_dogs';
  SELECT id INTO u_frank FROM users WHERE username = 'frank_buns';
  SELECT id INTO u_queen FROM users WHERE username = 'sausage_queen';
  SELECT id INTO u_mike  FROM users WHERE username = 'mustard_mike';
  SELECT id INTO u_rita  FROM users WHERE username = 'relish_rita';
  SELECT id INTO u_nina  FROM users WHERE username = 'nacho_nina';
  SELECT id INTO u_bun   FROM users WHERE username = 'bunmaster';
  SELECT id INTO u_champ FROM users WHERE username = 'chicago_champ';

  SELECT ARRAY(SELECT id FROM hotdogs ORDER BY id LIMIT 15) INTO ids;

  INSERT INTO ratings (hotdog_id, user_id, stars) VALUES
    (ids[1],  u_frank, 5), (ids[1],  u_queen, 4), (ids[1],  u_champ, 5),
    (ids[2],  u_nina,  3), (ids[2],  u_bun,   4),
    (ids[3],  u_joey,  5), (ids[3],  u_mike,  5), (ids[3],  u_queen, 4),
    (ids[4],  u_rita,  5), (ids[4],  u_frank, 4), (ids[4],  u_bun,   5),
    (ids[5],  u_champ, 1), (ids[5],  u_nina,  2),
    (ids[6],  u_joey,  5), (ids[6],  u_frank, 5),
    (ids[7],  u_mike,  4), (ids[7],  u_rita,  5),
    (ids[8],  u_bun,   4), (ids[8],  u_joey,  3),
    (ids[9],  u_champ, 5), (ids[9],  u_queen, 5),
    (ids[10], u_nina,  4), (ids[10], u_mike,  4)
  ON CONFLICT (hotdog_id, user_id) DO NOTHING;

END $$;

-- ============================================================
-- 5. SEED SETTINGS so leaderboard/home page are active
--    Sets competition_start to yesterday so it shows data immediately.
-- ============================================================
INSERT INTO settings (key, value) VALUES
  ('competition_start', (CURRENT_TIMESTAMP - INTERVAL '1 day')::text),
  ('competition_end',   '2026-09-07T23:59:59Z')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

SQL

echo ""
echo "=== Seed complete! Summary: ==="
$PSQL -t -c "
SELECT
  (SELECT COUNT(*) FROM users)    || ' users',
  (SELECT COUNT(*) FROM hotdogs)  || ' hotdog entries',
  (SELECT COALESCE(SUM(quantity),0) FROM hotdogs) || ' total dogs logged',
  (SELECT COUNT(*) FROM comments) || ' comments',
  (SELECT COUNT(*) FROM ratings)  || ' ratings';
"

$PSQL -t -c "
SELECT '  ' || u.username || ': ' || COALESCE(SUM(h.quantity),0) || ' dogs (' || CASE WHEN u.is_official_competitor THEN 'official' ELSE 'exhibition' END || ')'
FROM users u LEFT JOIN hotdogs h ON u.id = h.user_id
GROUP BY u.id ORDER BY COALESCE(SUM(h.quantity),0) DESC;
"

echo ""
echo "All dummy accounts use password: password123"
echo "Open http://localhost:5173 to view the dev app."
echo ""
