<template>
  <div>
    <div v-if="loading" class="loading">Loading profile...</div>

    <div v-else-if="error" class="card" style="text-align:center; padding:40px;">
      <p style="font-size:2rem; margin-bottom:10px;">😕</p>
      <p style="color:var(--text-muted);">{{ error }}</p>
    </div>

    <div v-else>
      <div class="profile-header">
        <div class="profile-avatar">
          <img v-if="userData.profile_picture" :src="userData.profile_picture" :alt="userData.username" />
          <div v-else class="profile-avatar-placeholder">🌭</div>
        </div>
        <div class="profile-info">
          <h1>
            {{ userData.username }}
            <span v-if="userData.is_official_competitor" class="official-badge" title="Official Competitor">✔</span>
          </h1>
          <p class="profile-joined">Joined {{ formatDate(userData.created_at) }}</p>
          <div class="profile-stats">
            <div class="profile-stat">
              <span class="profile-stat-num">{{ stats.total_dogs }}</span>
              <span class="profile-stat-label">Hot Dogs</span>
            </div>
            <div class="profile-stat">
              <span class="profile-stat-num">{{ stats.total_entries }}</span>
              <span class="profile-stat-label">Entries</span>
            </div>
          </div>
        </div>
      </div>

      <div class="page-header" style="margin-top: 30px;">
        <h2>🌭 {{ userData.username }}'s Dogs</h2>
      </div>

      <div v-if="hotdogList.length === 0" class="card" style="text-align:center; padding:40px;">
        <p style="color:var(--text-muted);">No hot dogs logged yet.</p>
      </div>

      <div v-else>
        <div class="hotdog-grid">
          <div v-for="dog in hotdogList" :key="dog.id" class="hotdog-card">
            <img :src="dog.image_url" :alt="dog.title" class="hotdog-card-image" />
            <div class="hotdog-card-body">
              <div class="hotdog-card-title">{{ dog.title }}</div>
              <div class="hotdog-card-meta">
                <span class="hotdog-card-quantity">🌭 {{ dog.quantity }}</span>
                <span v-if="dog.date_eaten" class="hotdog-card-date">📅 {{ formatDateShort(dog.date_eaten) }}</span>
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
  </div>
</template>

<script>
import { profile } from '../api';

export default {
  data() {
    return {
      userData: null,
      stats: { total_dogs: 0, total_entries: 0 },
      hotdogList: [],
      pagination: {},
      page: 1,
      loading: true,
      error: null
    };
  },
  async created() {
    await this.loadPage(1);
  },
  methods: {
    async loadPage(p) {
      this.loading = true;
      this.error = null;
      try {
        const data = await profile.get(this.$route.params.username, p);
        this.userData = data.user;
        this.stats = data.stats;
        this.hotdogList = data.hotdogs;
        this.pagination = data.pagination;
        this.page = p;
      } catch (e) {
        this.error = e.message || 'User not found';
      } finally {
        this.loading = false;
      }
    },
    formatDate(str) {
      if (!str) return '';
      return new Date(str).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    },
    formatDateShort(str) {
      if (!str) return '';
      return new Date(str + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
    }
  }
};
</script>

<style scoped>
.profile-header {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 30px;
  background: var(--surface);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.profile-avatar img,
.profile-avatar-placeholder {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  object-fit: cover;
  border: 4px solid var(--primary);
}

.profile-avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3rem;
  background: var(--primary-light);
}

.profile-info h1 {
  margin: 0 0 4px 0;
  font-size: 1.6rem;
}

.profile-joined {
  color: var(--text-muted);
  margin: 0 0 12px 0;
  font-size: 0.9rem;
}

.profile-stats {
  display: flex;
  gap: 24px;
}

.profile-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.profile-stat-num {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--primary);
}

.profile-stat-label {
  font-size: 0.8rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

@media (max-width: 768px) {
  .profile-header {
    flex-direction: column;
    text-align: center;
    padding: 20px;
  }

  .profile-avatar img,
  .profile-avatar-placeholder {
    width: 100px;
    height: 100px;
  }

  .profile-stats {
    justify-content: center;
  }
}
</style>
