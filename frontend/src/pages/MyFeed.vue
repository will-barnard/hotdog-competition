<template>
  <div>
    <div class="page-header">
      <h1>🐕 My Dog Feed</h1>
      <p v-if="totalDogs !== null">You've eaten <strong>{{ totalDogs }}</strong> hot dogs! 🌭</p>
    </div>

    <div v-if="loading" class="loading">Loading your dogs...</div>

    <div v-else-if="hotdogList.length === 0" class="card" style="text-align:center; padding:40px;">
      <p style="font-size:2rem; margin-bottom:10px;">🌭</p>
      <p style="color:var(--text-muted);">You haven't logged any hot dogs yet!</p>
      <router-link to="/log" class="btn btn-primary" style="margin-top:16px;">Log Your First Dog</router-link>
    </div>

    <div v-else>
      <div class="hotdog-grid">
        <div v-for="dog in hotdogList" :key="dog.id" class="hotdog-card">
          <img :src="dog.image_url" :alt="dog.title" class="hotdog-card-image" />
          <div class="hotdog-card-body">
            <div class="hotdog-card-title">{{ dog.title }}</div>
            <div class="hotdog-card-meta">
              <span class="hotdog-card-quantity">🌭 {{ dog.quantity }}</span>
              <span v-if="dog.date_eaten" class="hotdog-card-date">📅 {{ formatDate(dog.date_eaten) }}</span>
              <span>{{ timeAgo(dog.created_at) }}</span>
            </div>
            <div v-if="dog.description" class="hotdog-card-desc">{{ dog.description }}</div>
            <CommentSection :hotdog-id="dog.id" />
            <button @click="deleteDog(dog.id)" class="btn btn-danger btn-sm" style="margin-top:10px;">Delete</button>
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
import CommentSection from '../components/CommentSection.vue';

export default {
  components: { CommentSection },
  data() {
    return {
      hotdogList: [],
      pagination: {},
      page: 1,
      totalDogs: null,
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
        const data = await hotdogs.myFeed(p);
        this.hotdogList = data.hotdogs;
        this.pagination = data.pagination;
        this.totalDogs = data.total_dogs_eaten;
        this.page = p;
      } catch (e) {
        console.error(e);
      } finally {
        this.loading = false;
      }
    },
    async deleteDog(id) {
      if (!confirm('Delete this hot dog entry?')) return;
      try {
        await hotdogs.delete(id);
        await this.loadPage(this.page);
      } catch (e) {
        alert(e.message);
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
