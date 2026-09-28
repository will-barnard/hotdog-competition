<template>
  <div>
    <div class="page-header">
      <h1>🏛️ Hall of Fame</h1>
      <p>Legends of the Hotdog Showdown</p>
    </div>

    <div v-if="loading" class="loading">Loading the Hall of Fame...</div>

    <div v-else-if="error" class="card" style="text-align:center; padding:40px;">
      <p style="font-size:2rem; margin-bottom:10px;">🔒</p>
      <p style="color:var(--text-muted);">{{ error }}</p>
    </div>

    <template v-else>
      <div v-if="!isPublic" class="hof-admin-note">
        👀 Admin preview — only admins can see this page. Make it public from the Admin panel.
      </div>

      <div v-if="seasons.length === 0" class="card" style="text-align:center; padding:40px;">
        <p style="font-size:2rem; margin-bottom:10px;">🌭</p>
        <p style="color:var(--text-muted);">No seasons yet. Legends are made once the first season starts.</p>
      </div>

      <section v-for="season in seasons" :key="season.id" class="hof-season">
        <div class="hof-season-head">
          <h2>
            {{ season.name }} Season
            <span v-if="season.status === 'active'" class="season-status season-status--active">In progress</span>
          </h2>
          <span class="hof-season-meta">{{ formatDate(season.starts_at) }} — {{ formatDate(season.ends_at) }}</span>
        </div>

        <div v-if="season.podium.length === 0" class="card" style="padding:20px; color:var(--text-muted);">
          No dogs logged yet this season.
        </div>

        <div v-else class="hof-podium">
          <router-link
            v-for="p in season.podium"
            :key="p.user_id"
            :to="profileLink(p.username)"
            :class="['hof-place', 'hof-place--' + p.place]"
          >
            <div class="hof-medal">{{ medal(p.place) }}</div>
            <img v-if="p.profile_picture" :src="p.profile_picture" :alt="p.username" class="hof-avatar" />
            <div v-else class="hof-avatar hof-avatar--empty">🌭</div>
            <div class="hof-name">
              {{ p.username }}
              <span v-if="p.is_official" class="official-badge" title="Official Competitor that season">✔</span>
            </div>
            <div class="hof-dogs">{{ p.total_dogs }}</div>
            <div class="hof-dogs-label">dogs</div>
          </router-link>
        </div>

        <div class="hof-season-bar">
          <div class="hof-season-stats">
            <span>🌭 {{ season.total_dogs }} dogs eaten</span>
            <span>👥 {{ season.total_competitors }} competitors</span>
            <span>🏅 {{ season.total_official_competitors }} official</span>
          </div>
          <router-link :to="`/leaderboards?season=${season.id}`" class="btn btn-primary btn-sm">
            {{ season.status === 'active' ? 'Live leaderboard' : 'Full final standings' }} →
          </router-link>
        </div>

        <h3 class="hof-awards-title">🎖️ Season Awards<span v-if="season.status === 'active'"> (so far)</span></h3>
        <div class="hof-awards">
          <div v-for="def in awardsFor(season)" :key="def.key" class="award-card">
            <div class="award-icon">{{ def.icon }}</div>
            <div class="award-body">
              <div class="award-title">{{ def.title }}</div>
              <template v-if="season.awards[def.key]">
                <router-link v-if="def.user !== false" :to="profileLink(season.awards[def.key].username)" class="award-winner">
                  {{ season.awards[def.key].username }}
                </router-link>
                <div v-else class="award-winner">{{ def.headline(season.awards[def.key]) }}</div>
                <div class="award-detail">{{ def.detail(season.awards[def.key]) }}</div>
              </template>
              <div v-else class="award-empty">{{ def.empty }}</div>
            </div>
            <img
              v-if="season.awards[def.key] && season.awards[def.key].image_url"
              :src="season.awards[def.key].image_url"
              alt=""
              class="award-thumb"
            />
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script>
import { hallOfFame } from '../api';

// DATE columns arrive as "2026-09-26T00:00:00.000Z"; the calendar day is the first 10 chars.
function day(val) {
  if (!val) return '';
  const d = new Date(String(val).slice(0, 10) + 'T00:00:00');
  return isNaN(d) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
const stars = n => `★ ${Number(n).toFixed(1)}`;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
function beforeBuzzer(seconds) {
  if (seconds < 60) return `${seconds} sec before the buzzer`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min before the buzzer`;
  return `${Math.round(seconds / 3600)} hr before the end`;
}

export default {
  data() {
    return {
      loading: true,
      error: null,
      isPublic: true,
      thresholds: {},
      seasons: []
    };
  },
  async created() {
    try {
      const data = await hallOfFame.get();
      this.isPublic = data.public;
      this.thresholds = data.thresholds || {};
      this.seasons = data.seasons;
    } catch (e) {
      this.error = e.message;
    } finally {
      this.loading = false;
    }
  },
  methods: {
    awardsFor(season) {
      const t = this.thresholds;
      const defs = [
        { key: 'highest_rated', icon: '🌟', title: 'Highest Rated Dog',
          detail: a => `"${a.title}" · ${stars(a.avg_stars)} from ${plural(a.rating_count, 'rating')}`,
          empty: `Needs a dog with ${t.ratingsPerDog || 3}+ ratings from other people` },
        { key: 'lowest_rated', icon: '🥴', title: 'Lowest Rated Dog',
          detail: a => `"${a.title}" · ${stars(a.avg_stars)} from ${plural(a.rating_count, 'rating')}`,
          empty: `Needs a dog with ${t.ratingsPerDog || 3}+ ratings from other people` },
        { key: 'biggest_sitting', icon: '🍽️', title: 'Biggest Single Sitting',
          detail: a => `${plural(a.quantity, 'dog')} in one go · ${day(a.date_eaten)}`,
          empty: 'No dogs yet' },
        { key: 'best_day', icon: '📅', title: 'Best Single Day',
          detail: a => `${plural(a.dogs, 'dog')} on ${day(a.date_eaten)}${a.entries > 1 ? ` across ${a.entries} entries` : ''}`,
          empty: 'No dogs yet' },
        { key: 'longest_streak', icon: '🔥', title: 'Longest Streak',
          detail: a => `${a.days} day${a.days === 1 ? '' : 's'} in a row · ${day(a.start_day)}${a.days > 1 ? ` – ${day(a.end_day)}` : ''}`,
          empty: 'No dogs yet' },
        { key: 'photo_favorite', icon: '📸', title: 'Photo Favorite',
          detail: a => `${stars(a.avg_stars)} average across ${plural(a.rated_dogs, 'rated dog')}`,
          empty: `Needs someone with ${t.ratedDogsForFavorite || 3}+ dogs rated by others` },
        { key: 'top_critic', icon: '🧐', title: 'Top Critic',
          detail: a => `${plural(a.ratings_given, 'dog')} rated · gives ${stars(a.avg_given)} on average`,
          empty: 'No ratings yet' },
        { key: 'harshest_critic', icon: '😤', title: 'Harshest Critic',
          detail: a => `gives ${stars(a.avg_given)} on average across ${plural(a.ratings_given, 'rating')}`,
          empty: `Needs someone who's rated ${t.ratingsForHarshCritic || 5}+ dogs` },
        { key: 'most_talked_about', icon: '💬', title: 'Most Talked-About Dog',
          detail: a => `"${a.title}" · ${plural(a.comment_count, 'comment')}`,
          empty: 'No comments yet' },
        { key: 'busiest_day', icon: '🚀', title: 'Busiest Day', user: false,
          headline: a => day(a.date_eaten),
          detail: a => `${plural(a.dogs, 'dog')} eaten by ${plural(a.eaters, 'competitor')}`,
          empty: 'No dogs yet' },
        { key: 'buzzer_beater', icon: '⏱️', title: 'Buzzer Beater',
          detail: a => `"${a.title}" · posted ${new Date(a.posted_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}, ${beforeBuzzer(a.seconds_before_end)}`,
          empty: 'No dogs yet' }
      ];
      // No buzzer until there's been a buzzer.
      return season.status === 'active' ? defs.filter(d => d.key !== 'buzzer_beater') : defs;
    },
    profileLink(username) {
      return `/profile/${encodeURIComponent(username)}`;
    },
    medal(place) {
      return { 1: '🥇', 2: '🥈', 3: '🥉' }[place] || '🏅';
    },
    formatDate(str) {
      if (!str) return '';
      return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  }
};
</script>
