<template>
  <div>
    <div class="page-header">
      <h1>🔥 Hot Dog Feed</h1>
      <p>The latest dogs being devoured</p>
    </div>

    <div v-if="loading" class="loading">Loading the dogs...</div>

    <div v-else-if="hotdogList.length === 0" class="card" style="text-align:center; padding:40px;">
      <p style="font-size:2rem; margin-bottom:10px;">🌭</p>
      <p style="color:var(--text-muted);">No hot dogs logged yet. Be the first!</p>
    </div>

    <div v-else>
      <div class="hotdog-grid">
        <div v-for="dog in hotdogList" :key="dog.id" class="hotdog-card">
          <img :src="dog.image_url" :alt="dog.title" class="hotdog-card-image" />
          <div class="hotdog-card-body">
            <div class="hotdog-card-title">{{ dog.title }}</div>
            <div class="hotdog-card-meta">
              <span>
                <router-link :to="'/profile/' + dog.username" class="profile-link">{{ dog.username }}</router-link>
                <span v-if="dog.is_official_competitor" class="official-badge" title="Official Competitor">✔</span>
              </span>
              <span class="hotdog-card-quantity">🌭 {{ dog.quantity }}</span>
              <span v-if="dog.date_eaten" class="hotdog-card-date">📅 {{ formatDate(dog.date_eaten) }}</span>
              <span>{{ timeAgo(dog.created_at) }}</span>
            </div>
            <div v-if="dog.description" class="hotdog-card-desc">{{ dog.description }}</div>
          </div>
        </div>
      </div>

      <div class="pagination" v-if="pagination.pages > 1">
        <button @click="loadPage(page - 1)" :disabled="page <= 1">← Previous</button>
        <span style="padding:8px 12px; font-weight:600; color:var(--text-secondary);">
          Page {{ page }} of {{ pagination.pages }}
        </span>
        <button @click="loadPage(page + 1)" :disabled="page >= pagination.pages">Next →</button>
      </div>
    </div>
  </div>
</template>

<script>
import { hotdogs } from '../api';

export default {
  data() {
    return {
      hotdogList: [],
      pagination: {},
      page: 1,
      loading: true
    };
  },
  async created() {
    await this.loadPage(1);
  },
  methods: {
    async loadPage(p) {
      this.loading = true;
      try {
        const data = await hotdogs.feed(p);
        this.hotdogList = data.hotdogs;
        this.pagination = data.pagination;
        this.page = p;
      } catch (e) {
        console.error(e);
      } finally {
        this.loading = false;
      }
    },
    timeAgo(dateStr) {
      const seconds = Math.floor((Date.now() - new Date(dateStr)) / 1000);
      if (seconds < 60) return 'just now';
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    },
    formatDate(str) {
      if (!str) return '';
      return new Date(str + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  }
};
</script>
