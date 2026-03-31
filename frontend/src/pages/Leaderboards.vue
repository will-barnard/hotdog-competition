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
            <th v-if="isAdmin"></th>
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
            <td v-if="isAdmin">
              <button class="btn btn-secondary btn-sm" @click="openBreakdown(entry)" title="View entry breakdown">🔍</button>
            </td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>
  </div>

  <!-- Admin breakdown modal -->
  <div v-if="breakdown" class="modal-overlay" @click.self="breakdown = null">
    <div class="modal" style="max-width:620px;">
      <h2>🔍 Entry Breakdown — {{ breakdown.user.username }}</h2>
      <div v-if="breakdownLoading" style="color:var(--text-muted); padding:10px 0">Loading…</div>
      <div v-else>
        <div class="breakdown-summary">
          <div class="breakdown-stat">
            <span class="breakdown-stat-label">Leaderboard total</span>
            <span class="breakdown-stat-value">{{ breakdown.window_total }} 🌭</span>
          </div>
          <div class="breakdown-stat">
            <span class="breakdown-stat-label">All-time total</span>
            <span class="breakdown-stat-value" :style="breakdown.all_time_total !== breakdown.window_total ? 'color:#dc2626' : ''">{{ breakdown.all_time_total }} 🌭</span>
          </div>
          <div class="breakdown-stat" style="grid-column:1/-1">
            <span class="breakdown-stat-label">Competition window</span>
            <span class="breakdown-stat-value" style="font-size:0.85rem; font-weight:500">{{ fmtDate(breakdown.competition_start) }} – {{ fmtDate(breakdown.competition_end) }}</span>
          </div>
        </div>
        <div v-if="breakdown.all_time_total !== breakdown.window_total" class="alert alert-error" style="margin:12px 0 4px; font-size:0.88rem">
          ⚠️ {{ breakdown.all_time_total - breakdown.window_total }} dog{{ breakdown.all_time_total - breakdown.window_total !== 1 ? 's' : '' }} excluded — outside competition window (highlighted below)
        </div>
        <div class="admin-table-wrap" style="margin-top:12px">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Date Eaten</th>
                <th>Qty</th>
                <th>Logged</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="e in breakdown.entries" :key="e.id" :class="{ 'breakdown-out': !e.in_window }">
                <td>{{ e.title }}</td>
                <td>{{ fmtDate(e.date_eaten) }}<span v-if="!e.in_window" class="breakdown-out-tag">out of window</span></td>
                <td><strong>{{ e.quantity }}</strong></td>
                <td style="font-size:0.8rem; color:var(--text-muted)">{{ fmtDate(e.created_at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" @click="breakdown = null">Close</button>
      </div>
    </div>
  </div>
</template>

<script>
import { leaderboard, auth } from '../api';

export default {
  data() {
    return {
      tab: 'overall',
      overallList: [],
      competitorsList: [],
      loading: true,
      competitorsLoaded: false,
      notStarted: false,
      competitionStart: null,
      isAdmin: auth.getUser()?.is_admin || false,
      breakdown: null,
      breakdownLoading: false
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
    },
    async openBreakdown(entry) {
      this.breakdown = { user: entry, entries: [], window_total: 0, all_time_total: 0, competition_start: '', competition_end: '' };
      this.breakdownLoading = true;
      try {
        const data = await leaderboard.breakdown(entry.id);
        this.breakdown = data;
      } catch (e) {
        console.error(e);
        this.breakdown = null;
      } finally {
        this.breakdownLoading = false;
      }
    },
    fmtDate(str) {
      if (!str) return '';
      return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  }
};
</script>
