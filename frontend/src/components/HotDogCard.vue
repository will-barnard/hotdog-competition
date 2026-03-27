<template>
  <div class="hotdog-card">
    <div
      class="img-wrap"
      :style="{ cursor: isExpanded ? 'zoom-out' : 'zoom-in' }"
      @click="toggleExpand"
    >
      <img
        :src="dog.image_url"
        :alt="dog.title"
        class="hotdog-card-image"
        :style="isExpanded ? { height: 'auto', maxHeight: '80vh', objectFit: 'contain', background: '#111' } : {}"
      />
    </div>

    <div class="hotdog-card-body">
      <div class="hotdog-card-title">{{ dog.title }}</div>

      <div class="hotdog-card-meta">
        <span v-if="showUsername">
          <router-link :to="'/profile/' + dog.username" class="profile-link">{{ dog.username }}</router-link>
          <span v-if="dog.is_official_competitor" class="official-badge" title="Official Competitor">✔</span>
        </span>
        <span class="hotdog-card-quantity">🌭 {{ dog.quantity }}</span>
        <span v-if="dog.date_eaten" class="hotdog-card-date">📅 {{ formatDate(dog.date_eaten) }}</span>
        <span>{{ timeAgo(dog.created_at) }}</span>
      </div>

      <div v-if="dog.description" class="hotdog-card-desc">
        {{ descVisible }}<button v-if="longDesc" class="read-more-btn" @click.stop="descExpanded = !descExpanded">{{ descExpanded ? 'show less' : 'read more' }}</button>
      </div>

      <StarRating
        :hotdog-id="dog.id"
        :avg-stars="rating.avg_stars || 0"
        :rating-count="rating.rating_count || 0"
        :my-rating="rating.my_rating || null"
      />
      <CommentSection :hotdog-id="dog.id" :initial-count="dog.comment_count || 0" />
      <button v-if="canDelete" @click.stop="$emit('delete', dog.id)" class="btn btn-danger btn-sm" style="margin-top:10px;">Delete</button>
    </div>
  </div>
</template>

<script>
import StarRating from './StarRating.vue';
import CommentSection from './CommentSection.vue';

const TRUNCATE_AT = 150;

export default {
  components: { StarRating, CommentSection },
  props: {
    dog:        { type: Object,  required: true },
    rating:     { type: Object,  default: () => ({}) },
    expandedId: { type: Number,  default: null },
    showUsername: { type: Boolean, default: false },
    canDelete:  { type: Boolean, default: false },
  },
  emits: ['expand', 'delete'],
  data() {
    return { descExpanded: false };
  },
  computed: {
    isExpanded() {
      return this.expandedId === this.dog.id;
    },
    longDesc() {
      return this.dog.description && this.dog.description.length > TRUNCATE_AT;
    },
    descVisible() {
      if (!this.dog.description) return '';
      if (this.descExpanded || !this.longDesc) return this.dog.description;
      return this.dog.description.slice(0, TRUNCATE_AT) + '…';
    },
  },
  methods: {
    toggleExpand() {
      this.$emit('expand', this.isExpanded ? null : this.dog.id);
    },
    formatDate(val) {
      if (!val) return '';
      const d = val instanceof Date ? val : new Date(val + 'T00:00:00');
      if (isNaN(d)) return '';
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
    },
  },
};
</script>

<style scoped>
.img-wrap {
  overflow: hidden;
  border-radius: var(--radius) var(--radius) 0 0;
  line-height: 0;
}

.read-more-btn {
  background: none;
  border: none;
  color: var(--cubs-blue);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0 0 0 4px;
  display: inline;
}

.read-more-btn:hover {
  text-decoration: underline;
}
</style>
