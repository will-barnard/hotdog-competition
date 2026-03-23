<template>
  <div>
    <div class="page-header">
      <h1>🏆 Leaderboards</h1>
      <p>Who's eating the most dogs?</p>
    </div>

    <div class="tabs">
      <button class="tab" :class="{ active: tab === 'overall' }" @click="tab = 'overall'">
        🌭 Overall
      </button>
      <button class="tab" :class="{ active: tab === 'competitors' }" @click="tab = 'competitors'; loadCompetitors()">
        🏅 Official Competitors
      </button>
    </div>

    <div v-if="loading" class="loading">Loading leaderboard...</div>

    <div v-else-if="currentList.length === 0" class="card" style="text-align:center; padding:40px;">
      <p style="color:var(--text-muted);">No entries yet. Start eating!</p>
    </div>

    <div v-else class="card" style="padding:0; overflow:hidden;">
      <div class="table-wrap">
      <table class="leaderboard-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Competitor</th>
            <th>Hot Dogs 🌭</th>
            <th>Entries</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(entry, i) in currentList" :key="entry.id">
            <td class="leaderboard-rank" :class="'rank-' + (i + 1)">
              {{ i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i + 1) }}
            </td>
            <td>
              <strong>{{ entry.username }}</strong>
              <span v-if="entry.is_official_competitor" class="official-badge" title="Official Competitor">✔</span>
            </td>
            <td><strong>{{ entry.total_dogs }}</strong></td>
            <td>{{ entry.total_entries }}</td>
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
      tab: 'overall',
      overallList: [],
      competitorsList: [],
      loading: true,
      competitorsLoaded: false
    };
  },
  computed: {
    currentList() {
      return this.tab === 'overall' ? this.overallList : this.competitorsList;
    }
  },
  async created() {
    try {
      this.overallList = await leaderboard.overall();
    } catch (e) {
      console.error(e);
    } finally {
      this.loading = false;
    }
  },
  methods: {
    async loadCompetitors() {
      if (this.competitorsLoaded) return;
      this.loading = true;
      try {
        this.competitorsList = await leaderboard.competitors();
        this.competitorsLoaded = true;
      } catch (e) {
        console.error(e);
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>
