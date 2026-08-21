<template>
  <div class="home-vote-results">
    <div v-for="r in rows" :key="r.key" class="home-vote-result-row">
      <div class="home-vote-result-label">{{ r.label }} <span class="home-vote-result-pct">{{ r.pct }}%</span></div>
      <div class="home-vote-result-bar"><div class="home-vote-result-fill" :style="{ width: r.pct + '%' }"></div></div>
    </div>
    <p class="home-vote-result-total">{{ total }} vote{{ total === 1 ? '' : 's' }}</p>
  </div>
</template>

<script>
export default {
  props: {
    voteType: { type: String, required: true },
    results: { type: [Object, Array], default: null }
  },
  computed: {
    total() {
      if (!this.results) return 0;
      if (this.voteType === 'thumbs') {
        return (this.results.up || 0) + (this.results.down || 0);
      }
      return this.results.reduce((sum, r) => sum + r.count, 0);
    },
    rows() {
      if (!this.results) return [];
      const t = this.total || 1;
      if (this.voteType === 'thumbs') {
        return [
          { key: 'up', label: '👍 Yes', pct: Math.round((this.results.up || 0) / t * 100) },
          { key: 'down', label: '👎 No', pct: Math.round((this.results.down || 0) / t * 100) }
        ];
      }
      return this.results.map(r => ({ key: r.id, label: r.label, pct: Math.round(r.count / t * 100) }));
    }
  }
};
</script>
