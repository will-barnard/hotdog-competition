// The competition runs on Central time. Settings store competition_start /
// competition_end as UTC ISO instants (what the admin form sends), but hot dogs
// are logged against a calendar DATE. Casting a UTC ISO string straight to
// ::date takes the UTC calendar day, so an end of "Sep 29, 11:59 PM CDT"
// (= Sep 30 04:59Z) used to count Sep 30 dogs too. Every window comparison
// converts the instant to a Central calendar date first.
const COMPETITION_TZ = process.env.COMPETITION_TZ || 'America/Chicago';

// Fail loudly at boot on a bad zone name — it is interpolated into SQL below.
try {
  new Intl.DateTimeFormat('en-US', { timeZone: COMPETITION_TZ });
} catch {
  throw new Error(`Invalid COMPETITION_TZ "${COMPETITION_TZ}"`);
}
if (!/^[A-Za-z0-9_+\-\/]+$/.test(COMPETITION_TZ)) {
  throw new Error(`Invalid COMPETITION_TZ "${COMPETITION_TZ}"`);
}

// SQL expression turning a settings instant param (e.g. "$2") into a Central date.
function localDateSql(param) {
  return `((${param})::timestamptz AT TIME ZONE '${COMPETITION_TZ}')::date`;
}

// Today's calendar date in competition time, as YYYY-MM-DD.
function todayLocal(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: COMPETITION_TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(now);
}

// Shift a YYYY-MM-DD string by whole days (pure calendar math, no zones).
function addDays(ymd, days) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

module.exports = { COMPETITION_TZ, localDateSql, todayLocal, addDays };
