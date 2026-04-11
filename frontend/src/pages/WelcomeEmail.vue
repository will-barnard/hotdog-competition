<template>
  <div>
    <div class="page-header">
      <h1>👋 Welcome Email</h1>
      <p>Configure the automatic welcome email sent to new users</p>
    </div>

    <div v-if="error" class="alert alert-error">{{ error }}</div>
    <div v-if="success" class="alert alert-success">{{ success }}</div>

    <div class="card" v-if="loaded">
      <form @submit.prevent="save">
        <div class="form-group">
          <label>Enable Welcome Email</label>
          <div style="display:flex; align-items:center; gap:12px;">
            <button
              type="button"
              class="toggle-btn"
              :class="{ active: form.enabled }"
              @click="form.enabled = !form.enabled"
            >
              {{ form.enabled ? '✔ Enabled' : 'Disabled' }}
            </button>
            <span style="font-size:0.85rem; color:var(--text-muted);">
              When enabled, new users will receive a welcome email after the configured delay.
            </span>
          </div>
        </div>

        <div class="form-group">
          <label>Delay After Registration (minutes)</label>
          <input v-model.number="form.delay_minutes" type="number" min="1" max="10080" required />
          <span style="font-size:0.82rem; color:var(--text-muted); display:block; margin-top:4px;">
            How long after account creation to send the email. Max 10080 (7 days).
          </span>
        </div>

        <div class="form-group">
          <label>Subject</label>
          <input v-model="form.subject" type="text" required placeholder="Welcome to the Hotdog Showdown!" maxlength="200" />
          <span style="font-size:0.82rem; color:var(--text-muted); display:block; margin-top:4px;">
            Use <code>{{username}}</code> to insert the user's name.
          </span>
        </div>

        <div class="form-group">
          <label>Body <span style="font-weight:400; color:var(--text-muted)">(HTML supported)</span></label>
          <textarea v-model="form.body" rows="12" required placeholder="<h2>Welcome, {{username}}!</h2><p>Thanks for joining...</p>"></textarea>
          <span style="font-size:0.82rem; color:var(--text-muted); display:block; margin-top:4px;">
            Use <code>{{username}}</code> to insert the user's name. HTML is supported.
          </span>
        </div>

        <!-- Preview -->
        <div v-if="form.body" style="margin-bottom:18px;">
          <label style="font-weight:600; font-size:0.9rem; display:block; margin-bottom:8px;">Preview</label>
          <div class="email-preview" v-html="previewHtml"></div>
        </div>

        <button type="submit" class="btn btn-primary" :disabled="saving">
          {{ saving ? 'Saving...' : 'Save Configuration' }}
        </button>
      </form>
    </div>

    <div v-else class="loading">Loading...</div>

    <div style="margin-top:20px;">
      <router-link to="/admin" class="btn btn-secondary">← Back to Admin</router-link>
    </div>
  </div>
</template>

<script>
import { adminEmail } from '../api';

export default {
  data() {
    return {
      form: { enabled: false, delay_minutes: 30, subject: '', body: '' },
      loaded: false,
      saving: false,
      error: null,
      success: null,
    };
  },
  computed: {
    previewHtml() {
      return this.form.body.replace(/\{\{username\}\}/g, '<strong>JaneDoe</strong>');
    }
  },
  async created() {
    try {
      const config = await adminEmail.getWelcomeConfig();
      this.form.enabled = config.enabled;
      this.form.delay_minutes = config.delay_minutes;
      this.form.subject = config.subject;
      this.form.body = config.body;
    } catch (e) {
      this.error = e.message;
    }
    this.loaded = true;
  },
  methods: {
    async save() {
      this.error = null;
      this.success = null;
      this.saving = true;
      try {
        await adminEmail.updateWelcomeConfig(this.form);
        this.success = 'Welcome email configuration saved!';
      } catch (e) {
        this.error = e.message;
      } finally {
        this.saving = false;
      }
    }
  }
};
</script>

<style scoped>
.email-preview {
  border: 2px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 16px;
  background: #fafbfc;
  max-height: 300px;
  overflow-y: auto;
}
</style>
