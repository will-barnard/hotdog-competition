<template>
  <div>
    <div class="page-header">
      <h1>🌭 Log a Dog</h1>
      <p>Ate a hot dog? Prove it!</p>
    </div>

    <div v-if="competitionEnded" class="card" style="text-align:center; padding:40px;">
      <p style="font-size:2rem; margin-bottom:10px;">🏁</p>
      <p style="color:var(--text-muted); font-weight:600;">The competition has ended. Logging is closed.</p>
    </div>

    <div v-else class="card" style="max-width: 600px;">
      <div v-if="isExhibition" class="alert" style="background: #fff3cd; color: #856404; border: 1px solid #ffc107; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
        🏟️ <strong>Exhibition Mode</strong> — The competition hasn't started yet. Dogs logged now won't count toward the leaderboard.
      </div>

      <div v-if="success" class="alert alert-success">Hot dog logged! 🎉</div>
      <div v-if="error" class="alert alert-error">{{ error }}</div>

      <form @submit.prevent="submit">
        <div class="form-group">
          <label>Photo Proof 📸</label>
          <div class="image-upload" :class="{ 'has-image': imagePreview }" @click="$refs.fileInput.click()">
            <img v-if="imagePreview" :src="imagePreview" class="image-preview" />
            <div v-else>
              <p style="font-size: 2rem; margin-bottom: 8px;">📷</p>
              <p style="color: var(--text-muted);">Click to upload your hot dog photo</p>
            </div>
          </div>
          <input ref="fileInput" type="file" accept="image/*" @change="onFileChange" style="display:none" />
        </div>

        <div class="form-group">
          <label>Title</label>
          <input v-model="title" type="text" required placeholder="e.g. Chicago-style at Wrigley" maxlength="200" />
        </div>

        <div class="form-group">
          <label>How many hot dogs? 🌭</label>
          <input v-model.number="quantity" type="number" required min="1" max="100" placeholder="1" />
        </div>

        <div class="form-group">
          <label>Date Eaten 📅</label>
          <input v-model="dateEaten" type="date" required :min="minDate" :max="maxDate" />
          <small style="color: var(--text-muted);">Within the last 3 days</small>
        </div>

        <div class="form-group">
          <label>Description (optional)</label>
          <textarea v-model="description" placeholder="Tell us about these dogs..."></textarea>
        </div>

        <button type="submit" class="btn btn-primary" style="width: 100%;" :disabled="loading">
          {{ loading ? 'Logging...' : '🌭 Log This Dog!' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script>
import { hotdogs, settings } from '../api';

export default {
  data() {
    const today = new Date();
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    return {
      title: '',
      quantity: 1,
      description: '',
      dateEaten: today.toISOString().split('T')[0],
      minDate: threeDaysAgo.toISOString().split('T')[0],
      maxDate: today.toISOString().split('T')[0],
      imageFile: null,
      imagePreview: null,
      loading: false,
      error: null,
      success: false,
      competitionEnded: false,
      isExhibition: false
    };
  },
  async created() {
    try {
      const s = await settings.get();
      const now = new Date();
      if (s.competition_end && new Date(s.competition_end) < now) {
        this.competitionEnded = true;
      }
      if (s.competition_start && new Date(s.competition_start) > now) {
        this.isExhibition = true;
      }
    } catch (e) {
      // ignore
    }
  },
  methods: {
    onFileChange(e) {
      const file = e.target.files[0];
      if (file) {
        this.imageFile = file;
        const reader = new FileReader();
        reader.onload = (ev) => { this.imagePreview = ev.target.result; };
        reader.readAsDataURL(file);
      }
    },
    compressImage(file) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const img = new Image();
          img.onload = () => {
            const MAX = 1600;
            let { width, height } = img;
            if (width > MAX || height > MAX) {
              if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
              else { width = Math.round(width * MAX / height); height = MAX; }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.82);
          };
          img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
      });
    },
    async submit() {
      this.error = null;
      this.success = false;

      if (!this.imageFile) {
        this.error = 'Please upload a photo of your hot dog!';
        return;
      }

      this.loading = true;
      try {
        const compressed = await this.compressImage(this.imageFile);
        const formData = new FormData();
        formData.append('image', compressed, 'photo.jpg');
        formData.append('title', this.title);
        formData.append('quantity', this.quantity);
        formData.append('date_eaten', this.dateEaten);
        if (this.description) formData.append('description', this.description);

        await hotdogs.create(formData);
        this.success = true;
        this.title = '';
        this.quantity = 1;
        this.description = '';
        this.dateEaten = new Date().toISOString().split('T')[0];
        this.imageFile = null;
        this.imagePreview = null;
      } catch (e) {
        this.error = e.message;
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>
