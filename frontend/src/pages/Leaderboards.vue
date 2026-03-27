<template>
  <div>
    <div class="page-header">
      <h1>🏆 Leaderboards</h1>
      <p>Who's eating the most dogs?</p>
    </div>

    <div style="text-align: left; margin-bottom: 20px;">
      <router-link to="/competitors" class="btn" style="display:inline-block;">👥 Competitors List</router-link>
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

    <div v-else-if="notStarted" class="card" style="text-align:center; padding:40px;">
      <p style="font-size:2rem; margin-bottom:10px;">🏟️</p>
      <p style="font-weight:600; font-size:1.1rem;">Competition has not begun yet</p>
      <p style="color:var(--text-muted); margin-top:8px;">Check back on {{ formattedStart }}</p>
    </div>

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
          <tr v-for="entry in rankedList" :key="entry.id">
            <td class="leaderboard-rank" :class="'rank-' + entry.rank">
              {{ entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : '#' + entry.rank }}
            </td>
            <td>
              <router-link :to="'/profile/' + entry.username" class="profile-link">
                <strong>{{ entry.username }}</strong>
              </router-link>
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
      competitorsLoaded: false,
      notStarted: false,
      competitionStart: null
    };
  },
  computed: {
    currentList() {
      return this.tab === 'overall' ? this.overallList : this.competitorsList;
    },
    rankedList() {
      let rank = 1;
      return this.currentList.map((entry, i, arr) => {
        if (i > 0 && entry.total_dogs === arr[i - 1].total_dogs) {
          // tied on dogs eaten — keep same rank as previous
        } else {
          rank = i + 1;
        }
        return { ...entry, rank };
      });
    },
    formattedStart() {
      if (!this.competitionStart) return '';
      return new Date(this.competitionStart).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }
  },
  async created() {
    try {
      const data = await leaderboard.overall();
      if (data.not_started) {
        this.notStarted = true;
        this.competitionStart = data.competition_start;
      } else {
        this.overallList = data;
      }
    } catch (e) {
      console.error(e);
    } finally {
      this.loading = false;
    }
  },
  methods: {
    async loadCompetitors() {
      if (this.competitorsLoaded || this.notStarted) return;
      this.loading = true;
      try {
        const data = await leaderboard.competitors();
        if (data.not_started) {
          this.notStarted = true;
          this.competitionStart = data.competition_start;
        } else {
          this.competitorsList = data;
          this.competitorsLoaded = true;
        }
      } catch (e) {
        console.error(e);
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>
