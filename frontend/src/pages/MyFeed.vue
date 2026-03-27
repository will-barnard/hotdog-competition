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
        <HotDogCard
          v-for="dog in hotdogList"
          :key="dog.id"
          :dog="dog"
          :rating="ratingData[dog.id] || {}"
          :expanded-id="expandedId"
          :can-delete="true"
          @expand="expandedId = $event"
          @delete="deleteDog"
        />
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
import { hotdogs, ratings, auth } from '../api';
import HotDogCard from '../components/HotDogCard.vue';

export default {
  components: { HotDogCard },
  data() {
    return {
      hotdogList: [],
      ratingData: {},
      pagination: {},
      page: 1,
      totalDogs: null,
      loading: true,
      expandedId: null,
    };
  },
  async created() {
    await this.loadPage(1);
  },
  methods: {
    async loadPage(p) {
      this.loading = true;
      this.expandedId = null;
      try {
        const data = await hotdogs.myFeed(p);
        this.hotdogList = data.hotdogs;
        this.pagination = data.pagination;
        this.totalDogs = data.total_dogs_eaten;
        this.page = p;
        const ids = data.hotdogs.map(d => d.id);
        const user = auth.getUser();
        this.ratingData = await ratings.batch(ids, user?.id);
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
  }
};
</script>
