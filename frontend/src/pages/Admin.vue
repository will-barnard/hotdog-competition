<template>
  <div>
    <div class="page-header">
      <h1>⚙️ Admin Dashboard</h1>
      <p>Manage the {{ brand }}</p>
    </div>

    <div v-if="error" class="alert alert-error">{{ error }}</div>
    <div v-if="success" class="alert alert-success">{{ success }}</div>

    <!-- Stats Widget -->
    <div class="admin-section">
      <h2>📊 {{ stats && stats.season ? stats.season.name + ' Season' : 'Competition' }} Stats</h2>
      <div v-if="stats" class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">{{ stats.total_competitors }}</div>
          <div class="stat-label">Competitors (logged a dog)</div>
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

    <!-- Vote -->
    <div class="admin-section">
      <h2>🗳️ Vote</h2>
      <div class="card">
        <p style="color:var(--text-muted); margin-bottom:16px; font-size:0.9rem;">
          Runs the poll linked from the home page's Vote tile. Editing the question text (or an option's
          wording, when the option count and vote type stay the same) never resets the tally — adding/removing
          an option or switching vote type does, and you'll be asked to confirm first. Ending a vote closes it
          to new votes, moves it into Past Votes below, and opens a fresh question for you to set up next.
        </p>

        <div style="margin-bottom:16px;">
          <button class="toggle-btn" :class="{ active: voteNavVisible }" @click="toggleVoteNavVisible">
            {{ voteNavVisible ? '✔ Vote Link Shown in Nav/Home' : 'Vote Link Hidden from Nav/Home' }}
          </button>
          <p style="color:var(--text-muted); margin-top:6px; font-size:0.85rem;">
            Controls whether the Vote tile on the home page and the Vote link in the site menus appear at all —
            independent of whether a vote is currently running.
          </p>
        </div>

        <div class="form-group">
          <label>Question</label>
          <input v-model="voteForm.question" type="text" placeholder="e.g. Should we add a veggie dog category next year?" maxlength="300" />
        </div>

        <div class="form-group" style="margin-top:12px;">
          <label>Vote Type</label>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button type="button" :class="['flag-opt-btn', { active: voteForm.vote_type === 'multiple_choice' }]" @click="setVoteType('multiple_choice')">📋 Multiple Choice</button>
            <button type="button" :class="['flag-opt-btn', { active: voteForm.vote_type === 'thumbs' }]" @click="setVoteType('thumbs')">👍👎 Thumbs Up/Down</button>
          </div>
        </div>

        <div v-if="voteForm.vote_type === 'multiple_choice'" class="form-group" style="margin-top:12px;">
          <label>Options</label>
          <div v-for="(opt, i) in voteForm.options" :key="i" style="display:flex; gap:8px; margin-bottom:8px;">
            <input v-model="voteForm.options[i]" type="text" placeholder="Option text" maxlength="200" style="flex:1;" />
            <button type="button" class="btn btn-secondary btn-sm" :disabled="voteForm.options.length <= 2" @click="removeVoteOption(i)">✕</button>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" :disabled="voteForm.options.length >= 8" @click="addVoteOption">+ Add Option</button>
        </div>

        <div style="display:flex; align-items:center; gap:16px; margin-top:16px; flex-wrap:wrap;">
          <button class="toggle-btn" :class="{ active: voteForm.enabled }" @click="voteForm.enabled = !voteForm.enabled">
            {{ voteForm.enabled ? '✔ Vote On' : 'Vote Off' }}
          </button>
          <button class="toggle-btn" :class="{ active: voteForm.results_visible }" @click="voteForm.results_visible = !voteForm.results_visible">
            {{ voteForm.results_visible ? '✔ Results Public' : 'Results Hidden' }}
          </button>
          <button class="btn btn-primary" :disabled="savingVote" @click="saveVote">
            {{ savingVote ? 'Saving...' : 'Save Vote' }}
          </button>
          <button type="button" class="btn btn-secondary" @click="resetVoteResults">Reset Results</button>
          <button type="button" class="btn btn-danger" @click="endVote">End Vote</button>
        </div>

        <div v-if="voteData && voteData.current" style="margin-top:20px; padding-top:16px; border-top:1px solid var(--border);">
          <h3 style="font-size:0.95rem; margin-bottom:10px;">Current Results</h3>
          <div v-for="r in currentAdminRows" :key="r.key" class="home-vote-result-row">
            <div class="home-vote-result-label">{{ r.label }} <span class="home-vote-result-pct">{{ r.count }} ({{ r.pct }}%)</span></div>
            <div class="home-vote-result-bar"><div class="home-vote-result-fill" :style="{ width: r.pct + '%' }"></div></div>
          </div>
          <p style="margin-top:10px; font-size:0.85rem; color:var(--text-muted);">
            {{ voteData.current.total_responses }} total response{{ voteData.current.total_responses === 1 ? '' : 's' }} · {{ voteData.current.abstain_count }} dismissed without voting (admin-only, excluded from the public tally)
          </p>
        </div>
      </div>
    </div>

    <!-- Past Votes -->
    <div class="admin-section" v-if="voteData && voteData.history && voteData.history.length">
      <h2>📜 Past Votes</h2>
      <div v-for="h in voteData.history" :key="h.id" class="card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
          <div>
            <strong>{{ h.question || '(no question set)' }}</strong>
            <p style="color:var(--text-muted); font-size:0.85rem; margin-top:4px;">Ended {{ formatShortDate(h.ended_at) }}</p>
          </div>
          <button
            type="button"
            class="toggle-btn"
            :class="{ active: h.results_visible }"
            @click="toggleHistoryVisibility(h)"
          >
            {{ h.results_visible ? '✔ Public' : 'Hidden' }}
          </button>
        </div>
        <div style="margin-top:14px;">
          <div v-for="r in historyAdminRows(h)" :key="r.key" class="home-vote-result-row">
            <div class="home-vote-result-label">{{ r.label }} <span class="home-vote-result-pct">{{ r.count }} ({{ r.pct }}%)</span></div>
            <div class="home-vote-result-bar"><div class="home-vote-result-fill" :style="{ width: r.pct + '%' }"></div></div>
          </div>
          <p style="margin-top:10px; font-size:0.85rem; color:var(--text-muted);">
            {{ h.total_responses }} total response{{ h.total_responses === 1 ? '' : 's' }} · {{ h.abstain_count }} dismissed without voting
          </p>
        </div>
      </div>
    </div>

    <!-- Seasons -->
    <div class="admin-section">
      <h2>🗓️ Seasons</h2>
      <div class="card">
        <div v-if="seasonState" class="season-state-line">
          <template v-if="seasonState.season">
            <span>Current: <strong>{{ seasonState.season.name }}</strong></span>
            <span :class="['season-status', 'season-status--' + seasonState.status]">{{ statusLabel(seasonState.status) }}</span>
            <span style="color:var(--text-muted)">· Logging {{ loggingLabel }}</span>
          </template>
          <span v-else style="color:var(--text-muted)">No seasons yet — create one below.</span>
        </div>

        <div v-if="seasons.length" class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Season</th>
                <th>Starts</th>
                <th>Ends</th>
                <th>Status</th>
                <th>Dogs</th>
                <th>Official</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="se in seasons" :key="se.id">
                <td>
                  <strong>{{ se.name }}</strong>
                  <span v-if="se.id === currentSeasonId" style="color:var(--text-muted); font-size:0.8rem;"> (current)</span>
                </td>
                <td>{{ formatDateTime(se.starts_at) }}</td>
                <td>{{ formatDateTime(se.ends_at) }}</td>
                <td><span :class="['season-status', 'season-status--' + se.status]">{{ statusLabel(se.status) }}</span></td>
                <td>{{ se.total_dogs }}</td>
                <td>{{ se.total_official_competitors }}</td>
                <td style="white-space:nowrap;">
                  <button type="button" class="btn btn-secondary btn-sm" @click="editSeason(se)">Edit</button>
                  <button v-if="se.status === 'active'" type="button" class="btn btn-danger btn-sm" style="margin-left:6px;" @click="endSeason(se)">End now</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <form @submit.prevent="saveSeason" style="margin-top:20px;">
          <h3 style="font-size:1rem; margin-bottom:10px;">{{ seasonForm.id ? `Edit "${seasonForm.originalName}"` : 'New season' }}</h3>
          <div class="form-group">
            <label>Name</label>
            <input v-model="seasonForm.name" type="text" maxlength="100" placeholder="e.g. 2027" />
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;" class="settings-dates">
            <div class="form-group">
              <label>Start</label>
              <input v-model="seasonForm.starts_at" type="datetime-local" />
            </div>
            <div class="form-group">
              <label>End</label>
              <input v-model="seasonForm.ends_at" type="datetime-local" />
            </div>
          </div>
          <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:12px;">
            Times are in your local time. The name brands the site ("{{ seasonForm.name || '2027' }} Hotdog Showdown").
            <template v-if="!seasonForm.id">Creating a future season makes it the current one right away — the home page, leaderboards and the Official toggles below switch to it, and last season's results live on in the Hall of Fame. Official competitors don't carry over.</template>
          </p>
          <button type="submit" class="btn btn-primary" :disabled="savingSeason">
            {{ savingSeason ? 'Saving...' : (seasonForm.id ? 'Save Season' : 'Create Season') }}
          </button>
          <button v-if="seasonForm.id" type="button" class="btn btn-secondary" style="margin-left:8px;" @click="resetSeasonForm">Cancel</button>
        </form>
      </div>
    </div>

    <!-- Off-Season & Hall of Fame levers -->
    <div class="admin-section">
      <h2>🧢 Off-Season &amp; Hall of Fame</h2>
      <div class="card">
        <div class="lever-row">
          <div>
            <strong>Off-Season mode</strong>
            <p>While no season is running, let people log dogs as exhibition (they never count toward any season) and switch the site to the Away Game Grey theme. Off = logging stays closed between seasons.</p>
            <p v-if="seasonState && seasonState.off_season_mode && seasonState.status === 'active'" style="color:#9a3412;">A season is running, so this does nothing until it ends — then the site goes straight into Off-Season.</p>
          </div>
          <button type="button" class="toggle-btn" :class="{ active: levers.off_season_mode }" @click="toggleLever('off_season_mode')">
            {{ levers.off_season_mode ? '✔ On' : 'Off' }}
          </button>
        </div>
        <div class="lever-row">
          <div>
            <strong>Hall of Fame visible to everyone</strong>
            <p>Top 3 of every finished season. Only admins can see it until this is on. <router-link to="/hall-of-fame">Preview →</router-link></p>
          </div>
          <button type="button" class="toggle-btn" :class="{ active: levers.hall_of_fame_public }" @click="toggleLever('hall_of_fame_public')">
            {{ levers.hall_of_fame_public ? '✔ Public' : 'Admins only' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Rules -->
    <div class="admin-section">
      <h2>📜 Rules</h2>
      <div class="card">
        <form @submit.prevent="saveSettings">
          <div class="form-group">
            <textarea v-model="settingsForm.rules" rows="8"></textarea>
          </div>
          <button type="submit" class="btn btn-primary" :disabled="savingSettings">
            {{ savingSettings ? 'Saving...' : 'Save Rules' }}
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
              <th>Dogs ({{ currentSeasonName }})</th>
              <th>Official ({{ currentSeasonName }})</th>
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
import { admin, settings as settingsApi, adminVote, adminSeasons } from '../api';
import { refreshSite, brandName } from '../siteState';

const emptySeasonForm = () => ({ id: null, originalName: '', name: '', starts_at: '', ends_at: '' });

export default {
  data() {
    return {
      users: [],
      adminHotdogs: [],
      hotdogPagination: {},
      hotdogPage: 1,
      settingsForm: {
        rules: ''
      },
      seasons: [],
      currentSeasonId: null,
      seasonState: null,
      seasonForm: emptySeasonForm(),
      savingSeason: false,
      levers: { off_season_mode: false, hall_of_fame_public: false },
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
      ],
      voteForm: { question: '', vote_type: 'multiple_choice', options: ['', ''], enabled: false, results_visible: false },
      voteData: null,
      savingVote: false,
      voteNavVisible: true
    };
  },
  computed: {
    brand() {
      return this.seasonState && this.seasonState.season
        ? `${this.seasonState.season.name} Hotdog Showdown`
        : brandName();
    },
    currentSeasonName() {
      return this.seasonState && this.seasonState.season ? this.seasonState.season.name : 'season';
    },
    loggingLabel() {
      const st = this.seasonState;
      if (!st || !st.logging_open) return 'closed';
      return st.status === 'active' ? 'open' : 'open (exhibition only)';
    },
    currentAdminRows() {
      if (!this.voteData || !this.voteData.current) return [];
      return this.resultRows(this.voteData.current.vote_type, this.voteData.current.results);
    }
  },
  async created() {
    await Promise.all([
      this.loadUsers(),
      this.loadHotdogs(1),
      this.loadSettings(),
      this.loadSeasons(),
      this.loadStats(),
      this.loadVote()
    ]);
  },
  methods: {
    resultRows(voteType, results) {
      if (!results) return [];
      if (voteType === 'thumbs') {
        const total = (results.up || 0) + (results.down || 0);
        const t = total || 1;
        return [
          { key: 'up', label: '👍 Yes', count: results.up || 0, pct: Math.round((results.up || 0) / t * 100) },
          { key: 'down', label: '👎 No', count: results.down || 0, pct: Math.round((results.down || 0) / t * 100) }
        ];
      }
      const total = results.reduce((s, r) => s + r.count, 0);
      const t = total || 1;
      return results.map(r => ({ key: r.id, label: r.label, count: r.count, pct: Math.round(r.count / t * 100) }));
    },
    historyAdminRows(h) {
      return this.resultRows(h.vote_type, h.results);
    },
    formatShortDate(str) {
      if (!str) return '';
      return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    },
    async loadVote() {
      try {
        const data = await adminVote.get();
        this.voteData = data;
        const current = data.current;
        if (current) {
          this.voteForm.question = current.question || '';
          this.voteForm.vote_type = current.vote_type || 'multiple_choice';
          this.voteForm.options = current.options && current.options.length ? current.options.map(o => o.label) : ['', ''];
          this.voteForm.enabled = !!current.enabled;
          this.voteForm.results_visible = !!current.results_visible;
        }
      } catch (e) {
        console.error(e);
      }
    },
    setVoteType(type) {
      if (type === this.voteForm.vote_type) return;
      const current = this.voteData && this.voteData.current;
      if (current && current.total_responses > 0) {
        if (!confirm('Switching vote type will reset all current results. Continue?')) return;
      }
      this.voteForm.vote_type = type;
      if (type === 'multiple_choice' && this.voteForm.options.length < 2) {
        this.voteForm.options = ['', ''];
      }
    },
    addVoteOption() {
      if (this.voteForm.options.length >= 8) return;
      this.voteForm.options.push('');
    },
    removeVoteOption(i) {
      if (this.voteForm.options.length <= 2) return;
      this.voteForm.options.splice(i, 1);
    },
    async saveVote() {
      this.error = null;
      this.success = null;

      const cleanedOptions = this.voteForm.options.map(o => o.trim()).filter(Boolean);

      if (this.voteForm.vote_type === 'multiple_choice' && cleanedOptions.length < 2) {
        this.error = 'Provide at least 2 options.';
        return;
      }

      const current = this.voteData && this.voteData.current;
      const typeChanged = current && this.voteForm.vote_type !== current.vote_type;
      const optionCountChanged = !typeChanged && this.voteForm.vote_type === 'multiple_choice' &&
        current && current.vote_type === 'multiple_choice' &&
        cleanedOptions.length !== current.options.length;

      if ((typeChanged || optionCountChanged) && current && current.total_responses > 0) {
        if (!confirm('This change will reset the current vote results. Continue?')) return;
      }

      this.savingVote = true;
      try {
        await adminVote.update({
          question: this.voteForm.question,
          vote_type: this.voteForm.vote_type,
          options: this.voteForm.vote_type === 'multiple_choice' ? cleanedOptions : undefined,
          enabled: this.voteForm.enabled,
          results_visible: this.voteForm.results_visible
        });
        await this.loadVote();
        this.success = 'Vote saved!';
      } catch (e) {
        this.error = e.message;
      } finally {
        this.savingVote = false;
      }
    },
    async resetVoteResults() {
      if (!confirm('Reset all vote results? This cannot be undone.')) return;
      try {
        await adminVote.reset();
        await this.loadVote();
        this.success = 'Vote results reset.';
      } catch (e) {
        this.error = e.message;
      }
    },
    async endVote() {
      const current = this.voteData && this.voteData.current;
      if (!current || !current.question) {
        this.error = 'Set a question before ending the vote.';
        return;
      }
      if (!confirm('End this vote? It will close to new votes and move into Past Votes. A fresh question will open up for you to set up next.')) return;
      try {
        await adminVote.end();
        await this.loadVote();
        this.success = 'Vote ended and moved to Past Votes.';
      } catch (e) {
        this.error = e.message;
      }
    },
    async toggleHistoryVisibility(h) {
      try {
        await adminVote.setHistoryVisibility(h.id, !h.results_visible);
        await this.loadVote();
      } catch (e) {
        this.error = e.message;
      }
    },
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
        this.settingsForm.rules = data.rules || '';
        this.levers.off_season_mode = data.off_season_mode === true;
        this.levers.hall_of_fame_public = data.hall_of_fame_public === true;
        this.warningForm.enabled = data.site_warning_enabled === 'true';
        this.warningForm.text = data.site_warning_text || '';
        this.warningForm.style = data.site_warning_style || 'warning';
        // Load home stat visibility (default true if not set)
        for (const key of Object.keys(this.homeStats)) {
          if (data[key] !== undefined) {
            this.homeStats[key] = data[key] !== 'false';
          }
        }
        this.voteNavVisible = data.nav_show_vote !== 'false';
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
    async toggleVoteNavVisible() {
      const newVal = !this.voteNavVisible;
      try {
        await settingsApi.update({ nav_show_vote: String(newVal) });
        this.voteNavVisible = newVal;
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
    // <input type="datetime-local"> is zone-less and saveSettings() parses it as
    // the browser's local time, so it must be filled with LOCAL wall-clock parts.
    // (It used toISOString(), i.e. UTC, which pushed both dates 5-6 hours later
    // every time this form was saved — even when only the rules were edited.)
    toDatetimeLocal(isoStr) {
      if (!isoStr) return '';
      const d = new Date(isoStr);
      if (isNaN(d)) return '';
      const pad = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    },
    statusLabel(status) {
      return { active: 'Running', upcoming: 'Upcoming', ended: 'Ended', none: 'None' }[status] || status;
    },
    formatDateTime(str) {
      if (!str) return '';
      return new Date(str).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    },
    async loadSeasons() {
      try {
        const data = await adminSeasons.list();
        this.seasons = data.seasons;
        this.currentSeasonId = data.current_season_id;
        this.seasonState = data.state;
        this.levers.off_season_mode = data.state.off_season_mode;
        this.levers.hall_of_fame_public = data.state.hall_of_fame_public;
      } catch (e) {
        console.error(e);
      }
    },
    // Everything season-scoped on this page, plus the app-wide theme/nav.
    async refreshSeasonViews() {
      await Promise.all([this.loadSeasons(), this.loadStats(), this.loadUsers(), refreshSite().catch(() => {})]);
    },
    editSeason(se) {
      this.seasonForm = {
        id: se.id,
        originalName: se.name,
        name: se.name,
        starts_at: this.toDatetimeLocal(se.starts_at),
        ends_at: this.toDatetimeLocal(se.ends_at)
      };
    },
    resetSeasonForm() {
      this.seasonForm = emptySeasonForm();
    },
    async saveSeason() {
      this.error = null;
      this.success = null;
      const f = this.seasonForm;
      if (!f.name.trim() || !f.starts_at || !f.ends_at) {
        this.error = 'Season needs a name, a start and an end.';
        return;
      }
      const payload = {
        name: f.name.trim(),
        // datetime-local is local wall-clock time; send it as a real instant.
        starts_at: new Date(f.starts_at).toISOString(),
        ends_at: new Date(f.ends_at).toISOString()
      };
      this.savingSeason = true;
      try {
        if (f.id) {
          await adminSeasons.update(f.id, payload);
          this.success = `Season "${payload.name}" saved.`;
        } else {
          await adminSeasons.create(payload);
          this.success = `Season "${payload.name}" created.`;
        }
        this.resetSeasonForm();
        await this.refreshSeasonViews();
      } catch (e) {
        this.error = e.message;
      } finally {
        this.savingSeason = false;
      }
    },
    async endSeason(se) {
      const after = this.levers.off_season_mode
        ? 'The site will switch to Off-Season (exhibition logging, grey theme).'
        : 'Logging will close.';
      if (!confirm(`End the ${se.name} season right now? Its results freeze. ${after}`)) return;
      this.error = null;
      try {
        await adminSeasons.end(se.id);
        this.success = `The ${se.name} season has ended.`;
        await this.refreshSeasonViews();
      } catch (e) {
        this.error = e.message;
      }
    },
    async toggleLever(key) {
      const newVal = !this.levers[key];
      this.error = null;
      try {
        await settingsApi.update({ [key]: String(newVal) });
        this.levers[key] = newVal;
        await Promise.all([this.loadSeasons(), refreshSite().catch(() => {})]);
      } catch (e) {
        this.error = e.message;
      }
    },
    async saveSettings() {
      this.savingSettings = true;
      this.error = null;
      this.success = null;
      try {
        await settingsApi.update({ rules: this.settingsForm.rules });
        this.success = 'Rules saved!';
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
