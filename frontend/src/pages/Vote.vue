<template>
  <div>
    <div class="page-header">
      <h1>🗳️ Vote</h1>
      <p>Have your say on this round's question</p>
    </div>

    <div v-if="loading" class="loading">Loading vote...</div>

    <template v-else>
      <div v-if="current && current.question" class="card home-vote">
        <button
          v-if="showCloseBtn"
          type="button"
          class="home-vote-close"
          title="Not interested — don't ask me again"
          @click="dismissVote"
        >✕</button>

        <div class="home-vote-header">
          <span class="site-warning-icon">🗳️</span>
          <strong>{{ current.question }}</strong>
        </div>

        <p v-if="!current.enabled" class="home-vote-note" style="margin-top:10px;">This vote is closed.</p>

        <div v-if="!isLoggedIn" class="home-vote-body">
          <p class="home-vote-note">
            <router-link to="/login" class="profile-link">Log in</router-link> to cast your vote.
          </p>
        </div>

        <div v-else-if="current.enabled && hasResponded && !voteChanging" class="home-vote-body">
          <p class="home-vote-note">
            ✅ You voted <strong>{{ myChoiceLabel }}</strong>.
            <button type="button" class="home-vote-link-btn" @click="voteChanging = true">Change my vote</button>
          </p>
        </div>

        <div v-else-if="current.enabled && hasAbstained" class="home-vote-body">
          <p class="home-vote-note">You chose not to vote on this one.</p>
        </div>

        <div v-else-if="current.enabled" class="home-vote-body">
          <div v-if="current.vote_type === 'thumbs'" class="home-vote-thumbs">
            <button
              type="button"
              class="home-vote-thumb-btn"
              :class="{ active: currentChoice === 'up' }"
              :disabled="voteSubmitting"
              @click="castThumbs('up')"
            >👍 Yes</button>
            <button
              type="button"
              class="home-vote-thumb-btn"
              :class="{ active: currentChoice === 'down' }"
              :disabled="voteSubmitting"
              @click="castThumbs('down')"
            >👎 No</button>
          </div>
          <div v-else class="home-vote-options">
            <button
              v-for="opt in current.options"
              :key="opt.id"
              type="button"
              class="home-vote-option-btn"
              :class="{ active: currentChoice === opt.id }"
              :disabled="voteSubmitting"
              @click="castOption(opt.id)"
            >{{ opt.label }}</button>
          </div>
        </div>

        <p v-else-if="hasResponded" class="home-vote-note" style="margin-top:10px;">
          You voted <strong>{{ myChoiceLabel }}</strong>.
        </p>

        <VoteResults
          v-if="current.results_visible && current.results"
          :vote-type="current.vote_type"
          :results="current.results"
        />
      </div>

      <div v-else class="card" style="text-align:center; padding:40px; color:var(--text-muted);">
        No vote is running right now. Check back soon!
      </div>

      <div v-if="history.length" class="vote-history">
        <h2 class="vote-history-heading">Past Votes</h2>
        <div v-for="h in history" :key="h.id" class="card home-vote">
          <div class="home-vote-header">
            <span class="site-warning-icon">🗳️</span>
            <strong>{{ h.question || '(untitled vote)' }}</strong>
          </div>
          <p class="home-vote-note" style="margin-top:6px;">Ended {{ formatDate(h.ended_at) }}</p>
          <VoteResults :vote-type="h.vote_type" :results="h.results" />
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import { auth, vote as voteApi } from '../api';
import VoteResults from '../components/VoteResults.vue';

export default {
  components: { VoteResults },
  data() {
    return {
      isLoggedIn: auth.isLoggedIn(),
      loading: true,
      current: null,
      history: [],
      voteChanging: false,
      voteSubmitting: false
    };
  },
  computed: {
    hasResponded() {
      const r = this.current && this.current.my_response;
      if (!r || r.abstained) return false;
      return (r.option_id !== null && r.option_id !== undefined) || !!r.thumbs_choice;
    },
    currentChoice() {
      const r = this.current && this.current.my_response;
      if (!r) return null;
      return this.current.vote_type === 'thumbs' ? r.thumbs_choice : r.option_id;
    },
    myChoiceLabel() {
      if (!this.current || !this.current.my_response) return '';
      if (this.current.vote_type === 'thumbs') {
        return this.current.my_response.thumbs_choice === 'up' ? '👍 Yes' : '👎 No';
      }
      const opt = this.current.options.find(o => o.id === this.current.my_response.option_id);
      return opt ? opt.label : '';
    },
    hasAbstained() {
      const r = this.current && this.current.my_response;
      return !!(r && r.abstained);
    },
    showCloseBtn() {
      return this.isLoggedIn && this.current && this.current.enabled && !this.hasResponded && !this.hasAbstained;
    }
  },
  async created() {
    await this.loadVote();
  },
  methods: {
    async loadVote() {
      try {
        const data = await voteApi.get();
        this.current = data.current;
        this.history = data.history || [];
      } catch (e) {
        console.error(e);
      } finally {
        this.loading = false;
      }
    },
    async castOption(optionId) {
      if (this.voteSubmitting) return;
      this.voteSubmitting = true;
      try {
        await voteApi.respond({ option_id: optionId });
        await this.loadVote();
        this.voteChanging = false;
      } catch (e) {
        console.error(e);
      } finally {
        this.voteSubmitting = false;
      }
    },
    async castThumbs(choice) {
      if (this.voteSubmitting) return;
      this.voteSubmitting = true;
      try {
        await voteApi.respond({ thumbs: choice });
        await this.loadVote();
        this.voteChanging = false;
      } catch (e) {
        console.error(e);
      } finally {
        this.voteSubmitting = false;
      }
    },
    async dismissVote() {
      try {
        await voteApi.abstain();
        await this.loadVote();
      } catch (e) {
        console.error(e);
      }
    },
    formatDate(str) {
      if (!str) return '';
      return new Date(str).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }
  }
};
</script>
