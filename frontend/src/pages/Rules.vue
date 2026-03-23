<template>
  <div>
    <div class="page-header">
      <h1>📜 Rules</h1>
    </div>

    <div v-if="loading" class="loading">Loading rules...</div>

    <div v-else class="card">
      <div v-if="dates" class="comp-dates">
        📅 Competition: {{ formatDate(dates.competition_start) }} — {{ formatDate(dates.competition_end) }}
      </div>
      <div class="rules-content">{{ rules }}</div>
    </div>
  </div>
</template>

<script>
import { settings } from '../api';

export default {
  data() {
    return { rules: '', dates: null, loading: true };
  },
  async created() {
    try {
      const data = await settings.get();
      this.rules = data.rules || 'No rules set yet.';
      this.dates = data;
    } catch (e) {
      this.rules = 'Failed to load rules.';
    } finally {
      this.loading = false;
    }
  },
  methods: {
    formatDate(str) {
      if (!str) return '';
      return new Date(str).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }
  }
};
</script>
