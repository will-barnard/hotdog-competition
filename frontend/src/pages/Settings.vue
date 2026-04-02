<template>
  <div>
    <div class="page-header">
      <h1>⚙️ Settings</h1>
      <p>Manage your profile</p>
    </div>

    <div class="card" style="max-width: 500px; margin-bottom: 20px;">
      <h3 style="margin-top:0;">Username</h3>
      <p style="color: var(--text-muted); margin-bottom: 12px;">Current: <strong>{{ currentUsername }}</strong></p>

      <div class="form-group">
        <label for="username-input" class="form-label">New username</label>
        <input
          id="username-input"
          v-model="newUsername"
          type="text"
          placeholder="Enter new username"
          maxlength="50"
          class="form-input"
        />
      </div>

      <button class="btn" @click="changeUsername" :disabled="!newUsername.trim() || savingUsername">
        {{ savingUsername ? 'Saving...' : 'Save Username' }}
      </button>

      <div v-if="usernameSuccess" class="success-msg">{{ usernameSuccess }}</div>
      <div v-if="usernameError" class="error-msg">{{ usernameError }}</div>
    </div>

    <div class="card" style="max-width: 500px; margin-bottom: 20px;">
      <h3 style="margin-top:0;">Change Password</h3>

      <div class="form-group">
        <label for="current-password" class="form-label">Current password</label>
        <input
          id="current-password"
          v-model="currentPassword"
          type="password"
          placeholder="Enter current password"
          class="form-input"
        />
      </div>

      <div class="form-group">
        <label for="new-password" class="form-label">New password</label>
        <input
          id="new-password"
          v-model="newPassword"
          type="password"
          placeholder="Enter new password (min 6 characters)"
          class="form-input"
        />
      </div>

      <div class="form-group">
        <label for="confirm-password" class="form-label">Confirm new password</label>
        <input
          id="confirm-password"
          v-model="confirmPassword"
          type="password"
          placeholder="Confirm new password"
          class="form-input"
        />
      </div>

      <button class="btn" @click="changePassword" :disabled="!currentPassword || !newPassword || !confirmPassword || savingPassword">
        {{ savingPassword ? 'Saving...' : 'Change Password' }}
      </button>

      <div v-if="passwordSuccess" class="success-msg">{{ passwordSuccess }}</div>
      <div v-if="passwordError" class="error-msg">{{ passwordError }}</div>
    </div>

    <div class="card" style="max-width: 500px;">
      <h3 style="margin-top:0;">Profile Picture</h3>

      <div class="settings-avatar">
        <div class="profile-avatar">
          <img v-if="profilePicture" :src="profilePicture" alt="Profile picture" />
          <div v-else class="profile-avatar-placeholder">🌭</div>
        </div>
      </div>

      <div class="form-group" style="margin-top: 16px;">
        <label for="pfp-upload" class="form-label">Upload new photo</label>
        <input type="file" id="pfp-upload" accept="image/*" @change="onFileSelect" class="form-input" />
      </div>

      <div v-if="preview" style="margin: 12px 0;">
        <img :src="preview" alt="Preview" style="width: 120px; height: 120px; object-fit: cover; border-radius: 50%; border: 3px solid var(--primary);" />
      </div>

      <button class="btn" @click="uploadPhoto" :disabled="!selectedFile || uploading">
        {{ uploading ? 'Uploading...' : 'Save Profile Picture' }}
      </button>

      <div v-if="successMsg" class="success-msg">{{ successMsg }}</div>
      <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>
    </div>
  </div>
</template>

<script>
import { auth, profile } from '../api';

export default {
  data() {
    return {
      currentUsername: auth.getUser()?.username || '',
      newUsername: '',
      savingUsername: false,
      usernameSuccess: '',
      usernameError: '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
      savingPassword: false,
      passwordSuccess: '',
      passwordError: '',
      profilePicture: null,
      selectedFile: null,
      preview: null,
      uploading: false,
      successMsg: '',
      errorMsg: ''
    };
  },
  async created() {
    try {
      const user = await auth.me();
      this.currentUsername = user.username;
      this.profilePicture = user.profile_picture;
    } catch (e) {
      // ignore
    }
  },
  methods: {
    async changeUsername() {
      this.usernameSuccess = '';
      this.usernameError = '';
      this.savingUsername = true;
      try {
        const updatedUser = await auth.updateMe({ username: this.newUsername.trim() });
        this.currentUsername = updatedUser.username;
        this.newUsername = '';
        this.usernameSuccess = 'Username updated!';
        const storedUser = auth.getUser();
        if (storedUser) {
          storedUser.username = updatedUser.username;
          localStorage.setItem('user', JSON.stringify(storedUser));
          window.dispatchEvent(new Event('auth-change'));
        }
      } catch (e) {
        this.usernameError = e.message || 'Failed to update username';
      } finally {
        this.savingUsername = false;
      }
    },
    async changePassword() {
      this.passwordSuccess = '';
      this.passwordError = '';
      if (this.newPassword !== this.confirmPassword) {
        this.passwordError = 'New passwords do not match';
        return;
      }
      if (this.newPassword.length < 6) {
        this.passwordError = 'New password must be at least 6 characters';
        return;
      }
      this.savingPassword = true;
      try {
        await auth.changePassword(this.currentPassword, this.newPassword);
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
        this.passwordSuccess = 'Password changed successfully!';
      } catch (e) {
        this.passwordError = e.message || 'Failed to change password';
      } finally {
        this.savingPassword = false;
      }
    },
    onFileSelect(e) {
      const file = e.target.files[0];
      if (!file) return;
      this.selectedFile = file;
      this.preview = URL.createObjectURL(file);
      this.successMsg = '';
      this.errorMsg = '';
    },
    async uploadPhoto() {
      if (!this.selectedFile) return;
      this.uploading = true;
      this.successMsg = '';
      this.errorMsg = '';

      try {
        // Client-side compression
        const compressed = await this.compressImage(this.selectedFile);
        const formData = new FormData();
        formData.append('image', compressed, 'profile.jpg');

        const updatedUser = await profile.uploadPicture(formData);
        this.profilePicture = updatedUser.profile_picture;
        this.selectedFile = null;
        this.preview = null;
        this.successMsg = 'Profile picture updated!';

        // Update stored user data
        const storedUser = auth.getUser();
        if (storedUser) {
          storedUser.profile_picture = updatedUser.profile_picture;
          localStorage.setItem('user', JSON.stringify(storedUser));
          window.dispatchEvent(new Event('auth-change'));
        }
      } catch (e) {
        this.errorMsg = e.message || 'Upload failed';
      } finally {
        this.uploading = false;
      }
    },
    compressImage(file) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX = 800;
          let w = img.width, h = img.height;
          if (w > MAX || h > MAX) {
            if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
            else { w = Math.round(w * MAX / h); h = MAX; }
          }
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          canvas.toBlob(resolve, 'image/jpeg', 0.82);
        };
        img.src = URL.createObjectURL(file);
      });
    }
  }
};
</script>

<style scoped>
.settings-avatar {
  display: flex;
  justify-content: center;
}

.profile-avatar img,
.profile-avatar-placeholder {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  object-fit: cover;
  border: 4px solid var(--primary);
}

.profile-avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3rem;
  background: var(--primary-light);
}

.success-msg {
  margin-top: 12px;
  padding: 10px;
  background: #d4edda;
  color: #155724;
  border-radius: 8px;
  font-weight: 600;
}

.error-msg {
  margin-top: 12px;
  padding: 10px;
  background: #f8d7da;
  color: #721c24;
  border-radius: 8px;
  font-weight: 600;
}
</style>
