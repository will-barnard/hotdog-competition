<!-- TEMPORARY — remove this file, its import and route in router.js, and resetTemp.js + its registration in index.js when done -->
<template>
  <div class="auth-container">
    <div class="card">
      <h1>🔧 Temp Password Reset</h1>
      <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:16px">
        This page is temporary. Remove it when you're done.
      </p>
      <div v-if="message" class="alert alert-success">{{ message }}</div>
      <div v-if="error" class="alert alert-error">{{ error }}</div>
      <form @submit.prevent="reset">
        <div class="form-group">
          <label>Secret</label>
          <input v-model="secret" type="password" required placeholder="RESET_SECRET value" />
        </div>
        <div class="form-group">
          <label>User Email</label>
          <input v-model="email" type="email" required placeholder="user@example.com" />
        </div>
        <div class="form-group">
          <label>New Password</label>
          <input v-model="newPassword" type="password" required placeholder="New password (min 6 chars)" />
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%" :disabled="loading">
          {{ loading ? 'Resetting...' : 'Reset Password' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return { secret: '', email: '', newPassword: '', error: null, message: null, loading: false };
  },
  methods: {
    async reset() {
      this.error = null;
      this.message = null;
      this.loading = true;
      try {
        const res = await fetch('/api/temp-reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secret: this.secret, email: this.email, newPassword: this.newPassword }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Reset failed');
        this.message = data.message + ' — password updated successfully.';
        this.secret = '';
        this.newPassword = '';
      } catch (e) {
        this.error = e.message;
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>
