<template>
  <div>
    <div class="hero">
      <span class="hero-emoji">🌭</span>
      <h1>2026 Hotdog Showdown</h1>
      <p>How many dogs can you put down? Log your hot dogs, climb the leaderboard, and compete for glory!</p>
    </div>

    <div v-if="dates" class="comp-dates">
      📅 Competition: {{ formatDate(dates.competition_start) }} — {{ formatDate(dates.competition_end) }}
    </div>

    <div v-if="visibleStats.length > 0" class="site-stats">
      <div v-for="stat in visibleStats" :key="stat.key" class="site-stat">
        <div class="site-stat-value">{{ stat.value }}</div>
        <div class="site-stat-label">{{ stat.icon }} {{ stat.label }}</div>
      </div>
    </div>

    <div v-if="showProfilePrompt" class="profile-prompt card">
      <p>📸 <strong>Set your profile picture!</strong> Stand out on the leaderboard.</p>
      <router-link to="/settings" class="btn" style="display:inline-block; margin-top: 8px;">Go to Settings</router-link>
    </div>

    <div class="home-grid">
      <router-link to="/log" class="home-card" v-if="isLoggedIn">
        <span class="home-card-icon">📝</span>
        <span class="home-card-title">Log a Dog</span>
        <span class="home-card-desc">Ate a hot dog? Log it with a photo!</span>
      </router-link>
      <router-link to="/register" class="home-card" v-else>
        <span class="home-card-icon">📝</span>
        <span class="home-card-title">Sign Up to Compete</span>
        <span class="home-card-desc">Create an account and start eating!</span>
      </router-link>

      <router-link to="/feed" class="home-card">
        <span class="home-card-icon">🔥</span>
        <span class="home-card-title">Hot Dog Feed</span>
        <span class="home-card-desc">See the latest dogs being devoured</span>
      </router-link>

      <router-link to="/my-feed" class="home-card" v-if="isLoggedIn">
        <span class="home-card-icon">🐕</span>
        <span class="home-card-title">My Dog Feed</span>
        <span class="home-card-desc">View your personal hot dog history</span>
      </router-link>

      <router-link to="/leaderboards" class="home-card">
        <span class="home-card-icon">🏆</span>
        <span class="home-card-title">Leaderboards</span>
        <span class="home-card-desc">Who's eating the most dogs?</span>
      </router-link>

      <router-link to="/rules" class="home-card">
        <span class="home-card-icon">📜</span>
        <span class="home-card-title">Rules</span>
        <span class="home-card-desc">Read the official competition rules</span>
      </router-link>
    </div>
  </div>
</template>

<script>
import { auth, settings } from '../api';

export default {
  data() {
    return {
      isLoggedIn: auth.isLoggedIn(),
      dates: null,
      showProfilePrompt: false,
      siteStats: null
    };
  },
  computed: {
    visibleStats() {
      if (!this.siteStats || !this.dates) return [];
      const all = [
        { key: 'home_show_total_competitors', label: 'Competitors', icon: '👥', value: this.siteStats.total_competitors },
        { key: 'home_show_total_official_competitors', label: 'Official Competitors', icon: '🏅', value: this.siteStats.total_official_competitors },
        { key: 'home_show_total_dogs', label: 'Hot Dogs Eaten', icon: '🌭', value: this.siteStats.total_dogs },
        { key: 'home_show_total_entries', label: 'Log Posts', icon: '📝', value: this.siteStats.total_entries },
        { key: 'home_show_prize_pool', label: 'Prize Pool', icon: '💰', value: '$' + this.siteStats.prize_pool }
      ];
      return all.filter(s => this.dates[s.key] !== 'false');
    }
  },
  async created() {
    try {
      this.dates = await settings.get();
      const anyVisible = [
        'home_show_total_competitors', 'home_show_total_official_competitors',
        'home_show_total_dogs', 'home_show_total_entries', 'home_show_prize_pool'
      ].some(k => this.dates[k] !== 'false');
      if (anyVisible) {
        try { this.siteStats = await settings.getStats(); } catch (e) { /* ignore */ }
      }
    } catch (e) {
      // ignore
    }
    if (this.isLoggedIn) {
      try {
        const user = await auth.me();
        this.showProfilePrompt = !user.profile_picture;
      } catch (e) {
        // ignore
      }
    }
  },
  methods: {
    formatDate(str) {
      if (!str) return '';
      return new Date(str).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }
  }
};
</script>
