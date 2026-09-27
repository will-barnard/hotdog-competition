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
        <p style="color:var(--text-muted);">No finished seasons yet. Legends are made at the end of a season.</p>
      </div>

      <section v-for="season in seasons" :key="season.id" class="hof-season">
        <div class="hof-season-head">
          <h2>{{ season.name }} Season</h2>
          <span class="hof-season-meta">{{ formatDate(season.starts_at) }} — {{ formatDate(season.ends_at) }}</span>
        </div>

        <div v-if="season.podium.length === 0" class="card" style="padding:20px; color:var(--text-muted);">
          No dogs were logged this season.
        </div>

        <div v-else class="hof-podium">
          <router-link
            v-for="p in season.podium"
            :key="p.user_id"
            :to="`/profile/${encodeURIComponent(p.username)}`"
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

        <div class="hof-season-stats">
          <span>🌭 {{ season.total_dogs }} dogs eaten</span>
          <span>👥 {{ season.total_competitors }} competitors</span>
          <span>🏅 {{ season.total_official_competitors }} official</span>
        </div>
      </section>
    </template>
  </div>
</template>

<script>
import { hallOfFame } from '../api';

export default {
  data() {
    return {
      loading: true,
      error: null,
      isPublic: true,
      seasons: []
    };
  },
  async created() {
    try {
      const data = await hallOfFame.get();
      this.isPublic = data.public;
      this.seasons = data.seasons;
    } catch (e) {
      this.error = e.message;
    } finally {
      this.loading = false;
    }
  },
  methods: {
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
