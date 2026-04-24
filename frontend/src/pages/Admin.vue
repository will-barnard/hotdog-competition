<template>
  <div>
    <div class="page-header">
      <h1>⚙️ Admin Dashboard</h1>
      <p>Manage the 2026 Hotdog Showdown</p>
    </div>

    <div v-if="error" class="alert alert-error">{{ error }}</div>
    <div v-if="success" class="alert alert-success">{{ success }}</div>

    <!-- Stats Widget -->
    <div class="admin-section">
      <h2>📊 Competition Stats</h2>
      <div v-if="stats" class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">{{ stats.total_competitors }}</div>
          <div class="stat-label">Total Competitors</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.total_official_competitors }}</div>
          <div class="stat-label">Official Competitors</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.total_dogs }}</div>
          <div class="stat-label">Hot Dogs Eaten 🌭</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.total_entries }}</div>
          <div class="stat-label">Log Posts</div>
        </div>
        <div class="stat-card stat-card--prize">
          <div class="stat-value">${{ stats.prize_pool }}</div>
          <div class="stat-label">Prize Pool 💰</div>
        </div>
      </div>
      <div v-else class="card" style="color:var(--text-muted); padding:20px;">Loading stats...</div>
    </div>

    <!-- Email Tools -->
    <div class="admin-section">
      <h2>📧 Email Tools</h2>
      <div style="display:flex; flex-wrap:wrap; gap:12px;">
        <router-link to="/admin/bulk-email" class="btn btn-primary">📧 Bulk Emailer</router-link>
        <router-link to="/admin/welcome-email" class="btn btn-primary">👋 Welcome Email</router-link>
      </div>
    </div>

    <!-- Site Warning Banner -->
    <div class="admin-section">
      <h2>🚨 Site Warning Banner</h2>
      <div class="card">
        <p style="color:var(--text-muted); margin-bottom:16px; font-size:0.9rem;">Displays a red warning bar at the top of the home page for all visitors.</p>
        <div class="form-group">
          <label>Warning Message</label>
          <input v-model="warningForm.text" type="text" placeholder="e.g. Competition logging is temporarily suspended." maxlength="300" />
        </div>
        <div class="form-group" style="margin-top:12px;">
          <label>Style</label>
          <div style="display:flex; gap:8px;">
            <button type="button" :class="['flag-opt-btn', 'flag-opt-btn--foul', { active: warningForm.style === 'warning' }]" @click="warningForm.style = 'warning'">⚠️ Warning (Red)</button>
            <button type="button" :class="['flag-opt-btn', 'flag-opt-btn--info', { active: warningForm.style === 'info' }]" @click="warningForm.style = 'info'">ℹ️ Info (Green)</button>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:16px; margin-top:4px;">
          <button
            class="toggle-btn"
            :class="{ active: warningForm.enabled }"
            @click="warningForm.enabled = !warningForm.enabled"
          >
            {{ warningForm.enabled ? '✔ Banner On' : 'Banner Off' }}
          </button>
          <button class="btn btn-primary" :disabled="savingWarning" @click="saveWarning">
            {{ savingWarning ? 'Saving...' : 'Save Warning' }}
          </button>
        </div>
        <div v-if="warningForm.enabled && warningForm.text" :class="['site-warning', warningForm.style === 'info' ? 'site-warning--info' : '']" style="margin-top:16px; border-radius:var(--radius);">
          <span class="site-warning-icon">{{ warningForm.style === 'info' ? 'ℹ️' : '⚠️' }}</span>
          <span>{{ warningForm.text }}</span>
        </div>
      </div>
    </div>

    <!-- Competition Settings -->
    <div class="admin-section">
      <h2>📅 Competition Settings</h2>
      <div class="card">
        <form @submit.prevent="saveSettings">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;" class="settings-dates">
            <div class="form-group">
              <label>Start Date</label>
              <input v-model="settingsForm.competition_start" type="datetime-local" />
            </div>
            <div class="form-group">
              <label>End Date</label>
              <input v-model="settingsForm.competition_end" type="datetime-local" />
            </div>
          </div>
          <div class="form-group">
            <label>Rules</label>
            <textarea v-model="settingsForm.rules" rows="8"></textarea>
          </div>
          <button type="submit" class="btn btn-primary" :disabled="savingSettings">
            {{ savingSettings ? 'Saving...' : 'Save Settings' }}
          </button>
        </form>
      </div>
    </div>

    <!-- Home Page Stats Visibility -->
    <div class="admin-section">
      <h2>🏠 Home Page Stats</h2>
      <div class="card">
        <p style="color:var(--text-muted); margin-bottom:16px; font-size:0.9rem;">Choose which stats are displayed to all visitors on the home page.</p>
        <div class="stat-visibility-list">
          <div v-for="opt in homeStatOptions" :key="opt.key" class="stat-visibility-row">
            <span class="stat-visibility-label">{{ opt.icon }} {{ opt.label }}</span>
            <button
              class="toggle-btn"
              :class="{ active: homeStats[opt.key] }"
              @click="toggleHomeStat(opt.key)"
            >
              {{ homeStats[opt.key] ? '✔ Visible' : 'Hidden' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Users Management -->
    <div class="admin-section">
      <h2>👥 Users</h2>
      <div class="card" style="padding:0;">
        <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Email</th>
              <th>Dogs Eaten</th>
              <th>Official Competitor</th>
              <th>Admin</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in users" :key="u.id">
              <td>
                <strong>{{ u.username }}</strong>
                <span v-if="u.is_official_competitor" class="official-badge">✔</span>
              </td>
              <td>{{ u.email }}</td>
              <td>{{ u.total_dogs }}</td>
              <td>
                <button
                  class="toggle-btn"
                  :class="{ active: u.is_official_competitor }"
                  @click="toggleCompetitor(u)"
                >
                  {{ u.is_official_competitor ? '✔ Official' : 'Exhibition' }}
                </button>
              </td>
              <td>
                <button
                  class="toggle-btn"
                  :class="{ active: u.is_admin }"
                  @click="toggleAdmin(u)"
                >
                  {{ u.is_admin ? '✔ Admin' : 'User' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>
    </div>

    <!-- Hotdog Entries -->
    <div class="admin-section">
      <h2>🌭 Hot Dog Entries</h2>
      <div class="card" style="padding:0;">
        <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Image</th>
              <th>Title</th>
              <th>User</th>
              <th>Quantity</th>
              <th>Flag</th>
              <th>Photo</th>
              <th>Date</th>
              <th>EXIF</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="dog in adminHotdogs" :key="dog.id">
              <td><img :src="dog.image_url" style="width:60px; height:60px; object-fit:cover; border-radius:6px;" /></td>
              <td>{{ dog.title }}</td>
              <td>{{ dog.username }}</td>
              <td>{{ dog.quantity }}</td>
              <td>
                <span v-if="dog.flag_status === 'warning'" class="flag-pill flag-pill--warning">⚠️ Warning</span>
                <span v-else-if="dog.flag_status === 'foul'" class="flag-pill flag-pill--foul">🚫 Foul</span>
                <span v-else style="color:var(--text-muted); font-size:0.8rem">—</span>
              </td>
              <td>
                <span v-if="dog.photo_hidden" class="flag-pill flag-pill--foul">🙈 Hidden</span>
                <span v-else style="color:var(--text-muted); font-size:0.8rem">Visible</span>
              </td>
              <td>{{ new Date(dog.created_at).toLocaleDateString() }}</td>
              <td>
                <span v-if="dog.date_mismatch === true" class="flag-pill flag-pill--warning" title="Photo EXIF date does not match claimed date eaten">📸 Mismatch</span>
                <span v-else-if="dog.date_mismatch === false" style="color:var(--success); font-size:0.8rem" title="Photo EXIF date matches claimed date eaten">✓ Match</span>
                <span v-else style="color:var(--text-muted); font-size:0.8rem" title="No EXIF date in photo">—</span>
              </td>
              <td>
                <button class="btn btn-secondary btn-sm" @click="openEditModal(dog)">Edit</button>
                <button class="btn btn-danger btn-sm" style="margin-left:4px;" @click="deleteHotdog(dog.id)">Delete</button>
              </td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>
      <div class="pagination" v-if="hotdogPagination.pages > 1">
        <button @click="loadHotdogs(hotdogPage - 1)" :disabled="hotdogPage <= 1">← Previous</button>
        <span style="padding:8px 12px; font-weight:600;">Page {{ hotdogPage }} of {{ hotdogPagination.pages }}</span>
        <button @click="loadHotdogs(hotdogPage + 1)" :disabled="hotdogPage >= hotdogPagination.pages">Next →</button>
      </div>
    </div>

    <!-- Edit Modal -->
    <div v-if="editModal" class="modal-overlay" @click.self="editModal = null">
      <div class="modal">
        <h2>Edit Hot Dog Entry</h2>
        <form @submit.prevent="saveEdit">
          <div class="form-group">
            <label>Title</label>
            <input v-model="editForm.title" type="text" required />
          </div>
          <div class="form-group">
            <label>Quantity</label>
            <input v-model.number="editForm.quantity" type="number" min="0" max="100" required />
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea v-model="editForm.description"></textarea>
          </div>
          <div class="form-group">
            <label>Flag</label>
            <div class="flag-options">
              <button type="button" :class="['flag-opt-btn', { active: editForm.flag_status === null }]" @click="editForm.flag_status = null; editForm.flag_text = ''">None</button>
              <button type="button" :class="['flag-opt-btn', 'flag-opt-btn--warning', { active: editForm.flag_status === 'warning' }]" @click="editForm.flag_status = 'warning'">⚠️ Warning</button>
              <button type="button" :class="['flag-opt-btn', 'flag-opt-btn--foul', { active: editForm.flag_status === 'foul' }]" @click="editForm.flag_status = 'foul'">🚫 Foul</button>
            </div>
          </div>
          <div class="form-group" v-if="editForm.flag_status">
            <label>Flag Message <span style="font-weight:400; color:var(--text-muted)">(optional)</span></label>
            <input v-model="editForm.flag_text" type="text" placeholder="e.g. Score adjusted −2 for rule violation" />
          </div>
          <div class="form-group">
            <label>Photo Visibility</label>
            <div style="display:flex; align-items:center; gap:12px;">
              <button
                type="button"
                class="toggle-btn"
                :class="{ active: editForm.photo_hidden }"
                @click="editForm.photo_hidden = !editForm.photo_hidden"
              >
                {{ editForm.photo_hidden ? '🙈 Photo Hidden' : '👁 Photo Visible' }}
              </button>
              <span style="font-size:0.85rem; color:var(--text-muted);">Hidden photos are replaced with a placeholder for all users.</span>
            </div>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" @click="editModal = null">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import { admin, settings as settingsApi } from '../api';

export default {
  data() {
    return {
      users: [],
      adminHotdogs: [],
      hotdogPagination: {},
      hotdogPage: 1,
      settingsForm: {
        competition_start: '',
        competition_end: '',
        rules: ''
      },
      savingSettings: false,
      editModal: null,
      editForm: { title: '', quantity: 0, description: '', flag_status: null, flag_text: '', photo_hidden: false },
      error: null,
      success: null,
      stats: null,
      warningForm: { enabled: false, text: '', style: 'warning' },
      savingWarning: false,
      homeStats: {
        home_show_total_competitors: true,
        home_show_total_official_competitors: true,
        home_show_total_dogs: true,
        home_show_total_entries: true,
        home_show_prize_pool: true
      },
      homeStatOptions: [
        { key: 'home_show_total_competitors', label: 'Total Competitors', icon: '👥' },
        { key: 'home_show_total_official_competitors', label: 'Total Official Competitors', icon: '🏅' },
        { key: 'home_show_total_dogs', label: 'Total Hot Dogs Eaten', icon: '🌭' },
        { key: 'home_show_total_entries', label: 'Total Log Posts', icon: '📝' },
        { key: 'home_show_prize_pool', label: 'Prize Pool', icon: '💰' }
      ]
    };
  },
  async created() {
    await Promise.all([
      this.loadUsers(),
      this.loadHotdogs(1),
      this.loadSettings(),
      this.loadStats()
    ]);
  },
  methods: {
    async loadStats() {
      try {
        this.stats = await admin.getStats();
      } catch (e) {
        console.error(e);
      }
    },
    async loadSettings() {
      try {
        const data = await settingsApi.get();
        this.settingsForm.competition_start = this.toDatetimeLocal(data.competition_start);
        this.settingsForm.competition_end = this.toDatetimeLocal(data.competition_end);
        this.settingsForm.rules = data.rules || '';
        this.warningForm.enabled = data.site_warning_enabled === 'true';
        this.warningForm.text = data.site_warning_text || '';
        this.warningForm.style = data.site_warning_style || 'warning';
        // Load home stat visibility (default true if not set)
        for (const key of Object.keys(this.homeStats)) {
          if (data[key] !== undefined) {
            this.homeStats[key] = data[key] !== 'false';
          }
        }
      } catch (e) {
        console.error(e);
      }
    },
    async toggleHomeStat(key) {
      const newVal = !this.homeStats[key];
      try {
        await settingsApi.update({ [key]: String(newVal) });
        this.homeStats[key] = newVal;
      } catch (e) {
        this.error = e.message;
      }
    },
    async saveWarning() {
      this.savingWarning = true;
      this.error = null;
      this.success = null;
      try {
        await settingsApi.update({
          site_warning_enabled: String(this.warningForm.enabled),
          site_warning_text: this.warningForm.text,
          site_warning_style: this.warningForm.style
        });
        this.success = 'Warning banner saved!';
      } catch (e) {
        this.error = e.message;
      } finally {
        this.savingWarning = false;
      }
    },
    toDatetimeLocal(isoStr) {
      if (!isoStr) return '';
      const d = new Date(isoStr);
      return d.toISOString().slice(0, 16);
    },
    async saveSettings() {
      this.savingSettings = true;
      this.error = null;
      this.success = null;
      try {
        await settingsApi.update({
          competition_start: new Date(this.settingsForm.competition_start).toISOString(),
          competition_end: new Date(this.settingsForm.competition_end).toISOString(),
          rules: this.settingsForm.rules
        });
        this.success = 'Settings saved!';
      } catch (e) {
        this.error = e.message;
      } finally {
        this.savingSettings = false;
      }
    },
    async loadUsers() {
      try {
        this.users = await admin.getUsers();
      } catch (e) {
        console.error(e);
      }
    },
    async toggleCompetitor(user) {
      try {
        const updated = await admin.updateUser(user.id, {
          is_official_competitor: !user.is_official_competitor
        });
        user.is_official_competitor = updated.is_official_competitor;
      } catch (e) {
        this.error = e.message;
      }
    },
    async toggleAdmin(user) {
      try {
        const updated = await admin.updateUser(user.id, {
          is_admin: !user.is_admin
        });
        user.is_admin = updated.is_admin;
      } catch (e) {
        this.error = e.message;
      }
    },
    async loadHotdogs(p) {
      try {
        const data = await admin.getHotdogs(p);
        this.adminHotdogs = data.hotdogs;
        this.hotdogPagination = data.pagination;
        this.hotdogPage = p;
      } catch (e) {
        console.error(e);
      }
    },
    openEditModal(dog) {
      this.editModal = dog;
      this.editForm = {
        title: dog.title,
        quantity: dog.quantity,
        description: dog.description || '',
        flag_status: dog.flag_status || null,
        flag_text: dog.flag_text || '',
        photo_hidden: !!dog.photo_hidden
      };
    },
    async saveEdit() {
      try {
        await admin.updateHotdog(this.editModal.id, this.editForm);
        this.editModal.title = this.editForm.title;
        this.editModal.quantity = this.editForm.quantity;
        this.editModal.description = this.editForm.description;
        this.editModal.flag_status = this.editForm.flag_status;
        this.editModal.flag_text = this.editForm.flag_text;
        this.editModal.photo_hidden = this.editForm.photo_hidden;
        this.editModal = null;
        this.success = 'Hot dog entry updated!';
      } catch (e) {
        this.error = e.message;
      }
    },
    async deleteHotdog(id) {
      if (!confirm('Delete this hot dog entry?')) return;
      try {
        await admin.deleteHotdog(id);
        await this.loadHotdogs(this.hotdogPage);
        this.success = 'Hot dog entry deleted.';
      } catch (e) {
        this.error = e.message;
      }
    }
  }
};
</script>
