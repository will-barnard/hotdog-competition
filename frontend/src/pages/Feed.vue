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
        <HotDogCard
          v-for="dog in hotdogList"
          :key="dog.id"
          :dog="dog"
          :rating="ratingData[dog.id] || {}"
          :expanded-id="expandedId"
          :show-username="true"
          @expand="expandedId = $event"
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
        const data = await hotdogs.feed(p);
        this.hotdogList = data.hotdogs;
        this.pagination = data.pagination;
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
  },
};
</script>
