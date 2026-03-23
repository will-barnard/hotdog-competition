<template>
  <div class="star-rating">
    <!-- Average display -->
    <div class="star-avg">
      <span class="stars-display" :title="localCount > 0 ? `${localAvg.toFixed(1)} out of 5` : 'No ratings yet'">
        <span
          v-for="n in 5"
          :key="n"
          class="star-static"
          :class="{ filled: n <= Math.round(localAvg), half: !Number.isInteger(localAvg) && n === Math.ceil(localAvg) && localAvg % 1 < 0.75 && localAvg % 1 >= 0.25 }"
        >★</span>
      </span>
      <span class="avg-text" v-if="localCount > 0">
        {{ localAvg.toFixed(1) }} · {{ localCount }} {{ localCount === 1 ? 'rating' : 'ratings' }}
      </span>
      <span class="avg-text muted" v-else>No ratings yet</span>
    </div>

    <!-- Interactive rating row for logged-in users -->
    <div v-if="currentUser" class="star-input-row">
      <span class="rate-label">{{ localMyRating ? 'Yours:' : 'Rate:' }}</span>
      <span class="stars-input">
        <button
          v-for="n in 5"
          :key="n"
          type="button"
          class="star-btn"
          :class="{
            filled: n <= (hoverStar > 0 ? hoverStar : localMyRating || 0),
            hover: hoverStar > 0 && n <= hoverStar
          }"
          :title="`${n} star${n !== 1 ? 's' : ''}`"
          :disabled="submitting"
          @mouseenter="hoverStar = n"
          @mouseleave="hoverStar = 0"
          @click="rate(n)"
        >★</button>
      </span>
      <button
        v-if="localMyRating"
        type="button"
        class="remove-rating"
        title="Remove your rating"
        :disabled="submitting"
        @click="remove"
      >×</button>
    </div>
  </div>
</template>

<script>
import { ratings, auth } from '../api';

export default {
  props: {
    hotdogId: { type: Number, required: true },
    avgStars: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    myRating: { type: Number, default: null }
  },
  data() {
    return {
      localAvg: this.avgStars || 0,
      localCount: this.ratingCount || 0,
      localMyRating: this.myRating || null,
      hoverStar: 0,
      submitting: false,
      currentUser: auth.getUser()
    };
  },
  watch: {
    avgStars(v) { this.localAvg = v || 0; },
    ratingCount(v) { this.localCount = v || 0; },
    myRating(v) { this.localMyRating = v || null; }
  },
  methods: {
    async rate(stars) {
      if (this.submitting) return;
      this.submitting = true;
      try {
        const data = await ratings.rate(this.hotdogId, stars);
        this.localMyRating = data.my_rating;
        this.localAvg = data.avg_stars || 0;
        this.localCount = data.rating_count || 0;
      } catch (e) {
        console.error(e);
      } finally {
        this.submitting = false;
      }
    },
    async remove() {
      if (this.submitting) return;
      this.submitting = true;
      try {
        const data = await ratings.remove(this.hotdogId);
        this.localMyRating = null;
        this.localAvg = data.avg_stars || 0;
        this.localCount = data.rating_count || 0;
      } catch (e) {
        console.error(e);
      } finally {
        this.submitting = false;
      }
    }
  }
};
</script>

<style scoped>
.star-rating {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.star-avg {
  display: flex;
  align-items: center;
  gap: 6px;
}

.stars-display {
  display: inline-flex;
  gap: 1px;
}

.star-static {
  font-size: 0.95rem;
  color: #d1d5db;
  line-height: 1;
}

.star-static.filled {
  color: #f59e0b;
}

.star-static.half {
  /* Half-star approximation via gradient — simple opacity trick */
  opacity: 0.6;
  color: #f59e0b;
}

.avg-text {
  font-size: 0.78rem;
  color: var(--text-secondary);
  font-weight: 600;
}

.avg-text.muted {
  color: var(--text-muted);
  font-weight: normal;
}

.star-input-row {
  display: flex;
  align-items: center;
  gap: 5px;
}

.rate-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  min-width: 36px;
}

.stars-input {
  display: inline-flex;
  gap: 1px;
}

.star-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  color: #d1d5db;
  padding: 0 1px;
  line-height: 1;
  transition: color 0.1s, transform 0.1s;
}

.star-btn:not(:disabled):hover,
.star-btn.hover {
  transform: scale(1.15);
}

.star-btn.filled {
  color: #f59e0b;
}

.star-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.remove-rating {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.75rem;
  color: var(--text-muted);
  padding: 0 2px;
  line-height: 1;
  transition: color 0.15s;
}

.remove-rating:hover {
  color: var(--cubs-red);
}

.remove-rating:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
