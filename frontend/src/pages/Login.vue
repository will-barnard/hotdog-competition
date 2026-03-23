<template>
  <div class="auth-container">
    <div class="card">
      <h1>🌭 Log In</h1>
      <div v-if="error" class="alert alert-error">{{ error }}</div>
      <form @submit.prevent="login">
        <div class="form-group">
          <label>Email</label>
          <input v-model="email" type="email" required placeholder="your@email.com" />
        </div>
        <div class="form-group">
          <label>Password</label>
          <input v-model="password" type="password" required placeholder="Your password" />
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%" :disabled="loading">
          {{ loading ? 'Logging in...' : 'Log In' }}
        </button>
      </form>
      <p style="text-align:center; margin-top:16px; color:var(--text-muted); font-size:0.9rem">
        Don't have an account? <router-link to="/register" style="color:var(--cubs-blue); font-weight:600">Sign up</router-link>
      </p>
    </div>
  </div>
</template>

<script>
import { auth } from '../api';

export default {
  data() {
    return { email: '', password: '', error: null, loading: false };
  },
  methods: {
    async login() {
      this.error = null;
      this.loading = true;
      try {
        await auth.login(this.email, this.password);
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
