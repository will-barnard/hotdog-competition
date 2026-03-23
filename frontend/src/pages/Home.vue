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
      showProfilePrompt: false
    };
  },
  async created() {
    try {
      this.dates = await settings.get();
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
