<template>
  <div class="auth-container">
    <div class="card">
      <h1>🔑 Forgot Password</h1>
      <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:20px; text-align:center;">
        Enter your email and we'll send you a link to reset your password.
      </p>
      <div v-if="message" class="alert alert-success">{{ message }}</div>
      <div v-if="error" class="alert alert-error">{{ error }}</div>
      <form v-if="!sent" @submit.prevent="requestReset">
        <div class="form-group">
          <label>Email</label>
          <input v-model="email" type="email" required placeholder="your@email.com" />
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%" :disabled="loading">
          {{ loading ? 'Sending...' : 'Send Reset Link' }}
        </button>
      </form>
      <p style="text-align:center; margin-top:16px; color:var(--text-muted); font-size:0.9rem">
        <router-link to="/login" style="color:var(--cubs-blue); font-weight:600">Back to Login</router-link>
      </p>
    </div>
  </div>
</template>

<script>
import { passwordReset } from '../api';

export default {
  data() {
    return { email: '', error: null, message: null, loading: false, sent: false };
  },
  methods: {
    async requestReset() {
      this.error = null;
      this.message = null;
      this.loading = true;
      try {
        const data = await passwordReset.requestReset(this.email);
        this.message = data.message;
        this.sent = true;
      } catch (e) {
        this.error = e.message;
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>
