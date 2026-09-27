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
            <label>Message</label>
            <textarea v-model="form.html" rows="12" :placeholder="'Hey everyone,\n\nLeave a blank line between paragraphs.\n\nSee you next season!'"></textarea>
            <p style="color:var(--text-muted); font-size:0.82rem; margin-top:6px;">
              Leave a blank line to start a new paragraph. Basic HTML still works, e.g. <code>&lt;b&gt;bold&lt;/b&gt;</code> or <code>&lt;a href="https://…"&gt;a link&lt;/a&gt;</code>.
            </p>
          </div>

          <div class="form-group">
            <label>Photo <span style="font-weight:400; color:var(--text-muted)">(optional — shown in the email)</span></label>
            <div v-if="!image">
              <input ref="photoInput" type="file" accept="image/jpeg,image/png,image/webp,image/gif" :disabled="uploading" @change="onPhotoSelected" />
              <span v-if="uploading" style="margin-left:8px; color:var(--text-muted);">Uploading...</span>
            </div>
            <div v-else class="email-photo-row">
              <img :src="image.path" alt="Attached photo" class="email-photo-thumb" />
              <div class="email-photo-controls">
                <label class="email-photo-option"><input v-model="image.position" type="radio" value="above" /> Above the message</label>
                <label class="email-photo-option"><input v-model="image.position" type="radio" value="below" /> Below the message</label>
                <button type="button" class="btn btn-secondary btn-sm" @click="removePhoto">Remove photo</button>
              </div>
            </div>
          </div>

          <!-- Preview -->
          <div v-if="form.html || image" style="margin-bottom:18px;">
            <label style="font-weight:600; font-size:0.9rem; display:block; margin-bottom:8px;">Preview</label>
            <div class="email-preview">
              <img v-if="image && image.position === 'above'" :src="image.path" alt="" class="email-preview-photo" />
              <div v-html="bodyHtml"></div>
              <img v-if="image && image.position === 'below'" :src="image.path" alt="" class="email-preview-photo" />
            </div>
          </div>

          <!-- Finishing a send that was cut short -->
          <div class="form-group resend-box">
            <label class="email-photo-option" style="font-weight:600;">
              <input v-model="form.skipAlreadySent" type="checkbox" />
              Skip anyone who already received an email with this exact subject
            </label>
            <p class="resend-hint">
              Use this to finish a send that didn't reach everyone: keep the subject exactly the same and only the people who missed it get it.
              It checks Resend's record of the last 7 days.
            </p>
            <details :open="!!form.excludeEmails">
              <summary class="resend-hint" style="cursor:pointer;">Also skip specific addresses…</summary>
              <textarea v-model="form.excludeEmails" rows="3" placeholder="one@example.com, two@example.com" style="margin-top:6px;"></textarea>
              <p class="resend-hint">Paste addresses separated by commas or new lines — e.g. copied from the Resend dashboard if the automatic check can't read it.</p>
            </details>
          </div>

          <div v-if="check" class="check-box">
            <strong>{{ check.total_recipients }}</strong> will get this email
            <span class="resend-hint">
              (of {{ check.group_total }} in the group<template v-if="check.skipped_already_received"> · {{ check.skipped_already_received }} already received it</template><template v-if="check.skipped_excluded"> · {{ check.skipped_excluded }} skipped by your list</template>)
            </span>
            <div v-if="check.total_recipients > check.remaining_today" class="resend-hint" style="color:var(--cubs-red); margin-top:4px;">
              Only {{ check.remaining_today }} can go out today (daily limit) — the rest will be queued and sent automatically tomorrow.
            </div>
            <details v-if="check.recipients && check.recipients.length" style="margin-top:6px;">
              <summary class="resend-hint" style="cursor:pointer;">Show who</summary>
              <div class="resend-hint" style="margin-top:4px; word-break:break-all;">{{ check.recipients.join(', ') }}</div>
            </details>
          </div>

          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button type="button" class="btn btn-secondary" :disabled="checking || sending || !form.subject || !status?.enabled" @click="checkRecipients">
              {{ checking ? 'Checking...' : 'Check Recipients' }}
            </button>
            <button type="submit" class="btn btn-primary" :disabled="sending || checking || !status?.enabled">
              {{ sending ? 'Sending... (this can take a minute)' : 'Send Emails' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Results -->
    <div v-if="result" class="admin-section">
      <h2>📬 Send Results</h2>
      <div class="card">
        <p><strong>Total recipients:</strong> {{ result.total_recipients }}</p>
        <p v-if="result.skipped_already_received"><strong>Skipped (already received it):</strong> {{ result.skipped_already_received }}</p>
        <p v-if="result.skipped_excluded"><strong>Skipped (your list):</strong> {{ result.skipped_excluded }}</p>
        <p><strong>Sent now:</strong> {{ result.sent }}</p>
        <p v-if="result.queued > 0"><strong>Queued for later:</strong> {{ result.queued }} (will send automatically — daily limit or Resend asked us to slow down)</p>
        <template v-if="result.failed > 0">
          <p style="color:var(--cubs-red)"><strong>Failed:</strong> {{ result.failed }}</p>
          <ul class="resend-hint" style="margin:4px 0 0 18px;">
            <li v-for="f in result.failed_recipients" :key="f.email">{{ f.email }} — {{ f.error }}</li>
          </ul>
        </template>
      </div>
    </div>

    <div style="margin-top:20px;">
      <router-link to="/admin" class="btn btn-secondary">← Back to Admin</router-link>
    </div>
  </div>
</template>

<script>
import { adminEmail } from '../api';
import { textToEmailHtml } from '../emailFormat';

export default {
  data() {
    return {
      status: null,
      form: { group: 'all', subject: '', html: '', skipAlreadySent: false, excludeEmails: '' },
      image: null,        // { path, url, position }
      check: null,        // last "Check Recipients" result
      checking: false,
      uploading: false,
      sending: false,
      error: null,
      success: null,
      result: null,
    };
  },
  watch: {
    // A recipient check only holds for the exact settings it was run with.
    'form.subject'() { this.check = null; },
    'form.group'() { this.check = null; },
    'form.skipAlreadySent'() { this.check = null; },
    'form.excludeEmails'() { this.check = null; }
  },
  computed: {
    // What's previewed is exactly what's sent.
    bodyHtml() {
      return textToEmailHtml(this.form.html);
    }
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
    async onPhotoSelected(e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      this.error = null;
      this.uploading = true;
      try {
        const uploaded = await adminEmail.uploadImage(file);
        this.image = { ...uploaded, position: 'above' };
      } catch (err) {
        this.error = err.message;
        e.target.value = '';
      } finally {
        this.uploading = false;
      }
    },
    removePhoto() {
      this.image = null;
    },
    sendOptions(extra = {}) {
      return {
        skip_already_sent: this.form.skipAlreadySent,
        exclude_emails: this.form.excludeEmails,
        ...extra
      };
    },
    async checkRecipients() {
      this.error = null;
      this.checking = true;
      try {
        this.check = await adminEmail.sendBulk(this.form.subject, this.bodyHtml, this.form.group, this.image, this.sendOptions({ dry_run: true }));
        await this.loadStatus(); // the check can correct today's sent count
      } catch (e) {
        this.error = e.message;
      } finally {
        this.checking = false;
      }
    },
    async sendEmail() {
      if (!this.form.html.trim() && !this.image) {
        this.error = 'Add a message or a photo before sending.';
        return;
      }
      const who = this.check ? `${this.check.total_recipients} people` : `the "${this.form.group}" group`;
      if (!confirm(`Send this email to ${who}? This cannot be undone.`)) return;
      this.error = null;
      this.success = null;
      this.result = null;
      this.sending = true;
      try {
        this.result = await adminEmail.sendBulk(this.form.subject, this.bodyHtml, this.form.group, this.image, this.sendOptions());
        this.success = `Done: ${this.result.sent} sent, ${this.result.queued} queued, ${this.result.failed} failed.`;
        this.check = null;
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
  max-height: 400px;
  overflow-y: auto;
}

.email-preview-photo {
  display: block;
  width: 100%;
  max-width: 600px;
  height: auto;
  border-radius: 8px;
  margin: 12px 0;
}

.email-photo-row {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  flex-wrap: wrap;
}

.email-photo-thumb {
  width: 160px;
  max-height: 160px;
  object-fit: cover;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
}

.email-photo-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}

.email-photo-option {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 400;
  cursor: pointer;
}

.email-photo-option input {
  width: auto;
}

.resend-box {
  border: 1px dashed var(--border);
  border-radius: var(--radius-sm);
  padding: 12px 14px;
}

.resend-hint {
  color: var(--text-muted);
  font-size: 0.82rem;
  font-weight: 400;
  margin-top: 4px;
}

.check-box {
  background: var(--bg-light);
  border-radius: var(--radius-sm);
  padding: 10px 14px;
  margin-bottom: 14px;
}
</style>
