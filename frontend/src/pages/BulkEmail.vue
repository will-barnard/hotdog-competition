<template>
  <div>
    <div class="page-header">
      <h1>📧 Bulk Emailer</h1>
      <p>Send emails to your users</p>
    </div>

    <div v-if="error" class="alert alert-error">{{ error }}</div>
    <div v-if="success" class="alert alert-success">{{ success }}</div>

    <!-- Email Status -->
    <div class="admin-section" v-if="status">
      <h2>📊 Daily Email Status</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">{{ status.sent_today }}</div>
          <div class="stat-label">Sent Today</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ status.remaining_today }}</div>
          <div class="stat-label">Remaining Today</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ status.daily_limit }}</div>
          <div class="stat-label">Daily Limit</div>
        </div>
        <div class="stat-card" v-if="status.queued > 0">
          <div class="stat-value" style="color:var(--cubs-red)">{{ status.queued }}</div>
          <div class="stat-label">Queued for Later</div>
        </div>
      </div>
      <div v-if="!status.enabled" class="alert alert-error" style="margin-top:16px;">
        ⚠️ Email service is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL in your environment.
      </div>
    </div>

    <!-- Compose -->
    <div class="admin-section">
      <h2>✉️ Compose Email</h2>
      <div class="card">
        <form @submit.prevent="sendEmail">
          <div class="form-group">
            <label>Recipient Group</label>
            <select v-model="form.group">
              <option value="all">All Users</option>
              <option value="official">Official Competitors Only</option>
              <option value="exhibition">Exhibition (Non-Official) Only</option>
              <option value="admin">Admins Only</option>
            </select>
          </div>
          <div class="form-group">
            <label>Subject</label>
            <input v-model="form.subject" type="text" required placeholder="Email subject line" maxlength="200" />
          </div>
          <div class="form-group">
            <label>Body <span style="font-weight:400; color:var(--text-muted)">(HTML supported)</span></label>
            <textarea v-model="form.html" rows="12" required placeholder="Email body content..."></textarea>
          </div>

          <!-- Preview -->
          <div v-if="form.html" style="margin-bottom:18px;">
            <label style="font-weight:600; font-size:0.9rem; display:block; margin-bottom:8px;">Preview</label>
            <div class="email-preview" v-html="form.html"></div>
          </div>

          <button type="submit" class="btn btn-primary" :disabled="sending || !status?.enabled">
            {{ sending ? 'Sending...' : 'Send Emails' }}
          </button>
        </form>
      </div>
    </div>

    <!-- Results -->
    <div v-if="result" class="admin-section">
      <h2>📬 Send Results</h2>
      <div class="card">
        <p><strong>Total recipients:</strong> {{ result.total_recipients }}</p>
        <p><strong>Sent now:</strong> {{ result.sent }}</p>
        <p v-if="result.queued > 0"><strong>Queued for later:</strong> {{ result.queued }} (daily limit reached — will send tomorrow)</p>
        <p v-if="result.failed > 0" style="color:var(--cubs-red)"><strong>Failed:</strong> {{ result.failed }}</p>
      </div>
    </div>

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
      status: null,
      form: { group: 'all', subject: '', html: '' },
      sending: false,
      error: null,
      success: null,
      result: null,
    };
  },
  async created() {
    await this.loadStatus();
  },
  methods: {
    async loadStatus() {
      try {
        this.status = await adminEmail.getStatus();
      } catch (e) {
        this.error = e.message;
      }
    },
    async sendEmail() {
      if (!confirm(`Send this email to the "${this.form.group}" group? This cannot be undone.`)) return;
      this.error = null;
      this.success = null;
      this.result = null;
      this.sending = true;
      try {
        this.result = await adminEmail.sendBulk(this.form.subject, this.form.html, this.form.group);
        this.success = `Email sent! ${this.result.sent} delivered, ${this.result.queued} queued.`;
        await this.loadStatus();
      } catch (e) {
        this.error = e.message;
      } finally {
        this.sending = false;
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
