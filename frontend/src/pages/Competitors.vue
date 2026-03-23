<template>
  <div>
    <div class="page-header">
      <h1>👥 Competitors List</h1>
      <p>Everyone competing in the 2026 Hotdog Showdown</p>
    </div>

    <div class="card" style="max-width: 600px; margin-bottom: 20px; padding: 12px;">
      <input
        v-model="search"
        type="text"
        placeholder="Search competitors..."
        style="width: 100%; padding: 10px 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 1rem;"
      />
    </div>

    <div v-if="loading" class="loading">Loading competitors...</div>

    <div v-else-if="filtered.length === 0" class="card" style="text-align:center; padding:40px;">
      <p style="color:var(--text-muted);">{{ search ? 'No competitors match your search.' : 'No competitors yet.' }}</p>
    </div>

    <div v-else class="card" style="padding:0; overflow:hidden;">
      <div class="table-wrap">
        <table class="leaderboard-table">
          <thead>
            <tr>
              <th>Competitor</th>
              <th>Hot Dogs 🌭</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in filtered" :key="c.id">
              <td>
                <router-link :to="'/profile/' + c.username" class="profile-link">
                  <strong>{{ c.username }}</strong>
                </router-link>
                <span v-if="c.is_official_competitor" class="official-badge" title="Official Competitor">✔</span>
              </td>
              <td>{{ c.total_dogs }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script>
import { leaderboard } from '../api';

export default {
  data() {
    return {
      allList: [],
      search: '',
      loading: true
    };
  },
  computed: {
    filtered() {
      if (!this.search) return this.allList;
      const q = this.search.toLowerCase();
      return this.allList.filter(c => c.username.toLowerCase().includes(q));
    }
  },
  async created() {
    try {
      this.allList = await leaderboard.allCompetitors();
    } catch (e) {
      console.error(e);
    } finally {
      this.loading = false;
    }
  }
};
</script>
