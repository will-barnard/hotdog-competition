<template>
  <div class="auth-container">
    <div class="card">
      <h1>🌭 Sign Up</h1>
      <div v-if="error" class="alert alert-error">{{ error }}</div>
      <form @submit.prevent="register">
        <div class="form-group">
          <label>Username</label>
          <input v-model="username" type="text" required placeholder="hotdog_king" maxlength="50" />
        </div>
        <div class="form-group">
          <label>Email</label>
          <input v-model="email" type="email" required placeholder="your@email.com" />
        </div>
        <div class="form-group">
          <label>Password</label>
          <input v-model="password" type="password" required placeholder="At least 6 characters" minlength="6" />
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%" :disabled="loading">
          {{ loading ? 'Creating account...' : 'Create Account' }}
        </button>
      </form>
      <p style="text-align:center; margin-top:16px; color:var(--text-muted); font-size:0.9rem">
        Already have an account? <router-link to="/login" style="color:var(--cubs-blue); font-weight:600">Log in</router-link>
      </p>
    </div>
  </div>
</template>

<script>
import { auth } from '../api';

export default {
  data() {
    return { username: '', email: '', password: '', error: null, loading: false };
  },
  methods: {
    async register() {
      this.error = null;
      this.loading = true;
      try {
        await auth.register(this.username, this.email, this.password);
        window.dispatchEvent(new Event('auth-change'));
        this.$router.push('/');
      } catch (e) {
        this.error = e.message;
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>
