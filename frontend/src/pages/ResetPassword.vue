<template>
  <div class="auth-container">
    <div class="card">
      <h1>🔐 Reset Password</h1>
      <div v-if="message" class="alert alert-success">
        {{ message }}
        <p style="margin-top:12px"><router-link to="/login" style="color:var(--cubs-blue); font-weight:600">Go to Login →</router-link></p>
      </div>
      <div v-if="error" class="alert alert-error">{{ error }}</div>
      <div v-if="!token" class="alert alert-error">
        Invalid reset link. Please request a new one from the
        <router-link to="/forgot-password" style="color:var(--cubs-blue); font-weight:600">forgot password page</router-link>.
      </div>
      <form v-if="token && !done" @submit.prevent="resetPassword">
        <div class="form-group">
          <label>New Password</label>
          <input v-model="newPassword" type="password" required placeholder="Minimum 6 characters" minlength="6" />
        </div>
        <div class="form-group">
          <label>Confirm Password</label>
          <input v-model="confirmPassword" type="password" required placeholder="Re-enter your new password" />
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%" :disabled="loading">
          {{ loading ? 'Resetting...' : 'Reset Password' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script>
import { passwordReset } from '../api';

export default {
  data() {
    return {
      token: null,
      newPassword: '',
      confirmPassword: '',
      error: null,
      message: null,
      loading: false,
      done: false,
    };
  },
  created() {
    const params = new URLSearchParams(window.location.search);
    this.token = params.get('token');
  },
  methods: {
    async resetPassword() {
      this.error = null;
      if (this.newPassword !== this.confirmPassword) {
        this.error = 'Passwords do not match';
        return;
      }
      if (this.newPassword.length < 6) {
        this.error = 'Password must be at least 6 characters';
        return;
      }
      this.loading = true;
      try {
        const data = await passwordReset.reset(this.token, this.newPassword);
        this.message = data.message;
        this.done = true;
      } catch (e) {
        this.error = e.message;
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>
