<template>
  <div class="comment-section">
    <button class="comment-toggle" @click="toggle">
      💬 {{ open ? 'Hide' : (commentCount === 1 ? '1 comment' : `${commentCount} comments`) }}
    </button>

    <div v-if="open" class="comment-body">
      <div v-if="loading" class="comment-loading">Loading…</div>

      <div v-else>
        <div v-if="commentList.length === 0" class="comment-empty">No comments yet.</div>

        <div v-for="c in commentList" :key="c.id" class="comment-item">
          <router-link :to="'/profile/' + c.username" class="comment-avatar">
            <img v-if="c.profile_picture" :src="c.profile_picture" :alt="c.username" />
            <span v-else class="comment-avatar-fallback">🌭</span>
          </router-link>
          <div class="comment-content">
            <div class="comment-meta">
              <router-link :to="'/profile/' + c.username" class="comment-username">{{ c.username }}</router-link>
              <span class="comment-time">{{ timeAgo(c.created_at) }}</span>
              <button
                v-if="canDelete(c)"
                class="comment-delete"
                @click="deleteComment(c.id)"
                title="Delete comment"
              >✕</button>
            </div>
            <div class="comment-text">{{ c.content }}</div>
          </div>
        </div>

        <div v-if="currentUser" class="comment-form">
          <textarea
            v-model="newComment"
            class="comment-input"
            placeholder="Add a comment…"
            maxlength="500"
            rows="2"
            @keydown.enter.ctrl.prevent="submit"
            @keydown.enter.meta.prevent="submit"
          ></textarea>
          <div class="comment-form-actions">
            <span class="comment-char-count" :class="{ warn: newComment.length > 450 }">
              {{ newComment.length }}/500
            </span>
            <button
              class="btn btn-primary btn-sm"
              :disabled="!newComment.trim() || submitting"
              @click="submit"
            >
              {{ submitting ? 'Posting…' : 'Post' }}
            </button>
          </div>
          <div v-if="postError" class="comment-error">{{ postError }}</div>
        </div>

        <div v-else class="comment-login-prompt">
          <router-link to="/login">Log in</router-link> to leave a comment.
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { comments, auth } from '../api';

export default {
  props: {
    hotdogId: { type: Number, required: true },
    initialCount: { type: Number, default: 0 }
  },
  data() {
    return {
      open: false,
      loaded: false,
      loading: false,
      commentList: [],
      commentCount: this.initialCount,
      newComment: '',
      submitting: false,
      postError: null,
      currentUser: auth.getUser()
    };
  },
  methods: {
    async toggle() {
      this.open = !this.open;
      if (this.open && !this.loaded) {
        await this.load();
      }
    },
    async load() {
      this.loading = true;
      try {
        const data = await comments.list(this.hotdogId);
        this.commentList = data.comments;
        this.commentCount = data.comments.length;
        this.loaded = true;
      } catch (e) {
        console.error(e);
      } finally {
        this.loading = false;
      }
    },
    async submit() {
      if (!this.newComment.trim() || this.submitting) return;
      this.submitting = true;
      this.postError = null;
      try {
        const data = await comments.create(this.hotdogId, this.newComment.trim());
        this.commentList.push(data.comment);
        this.commentCount = this.commentList.length;
        this.newComment = '';
      } catch (e) {
        this.postError = e.message;
      } finally {
        this.submitting = false;
      }
    },
    async deleteComment(id) {
      if (!confirm('Delete this comment?')) return;
      try {
        await comments.delete(id);
        this.commentList = this.commentList.filter(c => c.id !== id);
        this.commentCount = this.commentList.length;
      } catch (e) {
        alert(e.message);
      }
    },
    canDelete(comment) {
      if (!this.currentUser) return false;
      return this.currentUser.id === comment.user_id || this.currentUser.is_admin;
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
    }
  }
};
</script>

<style scoped>
.comment-section {
  border-top: 1px solid var(--border);
  padding-top: 10px;
  margin-top: 10px;
}

.comment-toggle {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 0.82rem;
  cursor: pointer;
  padding: 2px 0;
  font-weight: 600;
  transition: color 0.15s;
}

.comment-toggle:hover {
  color: var(--cubs-blue);
}

.comment-body {
  margin-top: 10px;
}

.comment-loading,
.comment-empty {
  font-size: 0.85rem;
  color: var(--text-muted);
  padding: 4px 0;
}

.comment-item {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
  align-items: flex-start;
}

.comment-avatar {
  flex-shrink: 0;
  text-decoration: none;
}

.comment-avatar img,
.comment-avatar-fallback {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--border);
  display: block;
}

.comment-avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  background: #f0f4f8;
}

.comment-content {
  flex: 1;
  min-width: 0;
}

.comment-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
}

.comment-username {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--cubs-blue);
  text-decoration: none;
}

.comment-username:hover {
  text-decoration: underline;
}

.comment-time {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.comment-delete {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.7rem;
  padding: 0 2px;
  margin-left: auto;
  line-height: 1;
  transition: color 0.15s;
}

.comment-delete:hover {
  color: var(--cubs-red);
}

.comment-text {
  font-size: 0.85rem;
  color: var(--text-primary);
  line-height: 1.4;
  word-break: break-word;
}

.comment-form {
  margin-top: 10px;
}

.comment-input {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 0.85rem;
  font-family: inherit;
  resize: none;
  box-sizing: border-box;
  transition: border-color 0.15s;
}

.comment-input:focus {
  outline: none;
  border-color: var(--cubs-blue);
}

.comment-form-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 6px;
}

.comment-char-count {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.comment-char-count.warn {
  color: var(--cubs-red);
}

.comment-error {
  font-size: 0.8rem;
  color: var(--cubs-red);
  margin-top: 4px;
}

.comment-login-prompt {
  font-size: 0.82rem;
  color: var(--text-muted);
  margin-top: 8px;
}

.comment-login-prompt a {
  color: var(--cubs-blue);
  font-weight: 600;
}
</style>
