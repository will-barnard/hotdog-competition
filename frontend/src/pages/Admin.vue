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
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="dog in adminHotdogs" :key="dog.id">
              <td><img :src="dog.image_url" style="width:60px; height:60px; object-fit:cover; border-radius:6px;" /></td>
              <td>{{ dog.title }}</td>
              <td>{{ dog.username }}</td>
              <td>{{ dog.quantity }}</td>
              <td>{{ new Date(dog.created_at).toLocaleDateString() }}</td>
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
      editForm: { title: '', quantity: 0, description: '' },
      error: null,
      success: null,
      stats: null,
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
        description: dog.description || ''
      };
    },
    async saveEdit() {
      try {
        await admin.updateHotdog(this.editModal.id, this.editForm);
        this.editModal.title = this.editForm.title;
        this.editModal.quantity = this.editForm.quantity;
        this.editModal.description = this.editForm.description;
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
