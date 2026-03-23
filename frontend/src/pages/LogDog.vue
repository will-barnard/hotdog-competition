<template>
  <div>
    <div class="page-header">
      <h1>🌭 Log a Dog</h1>
      <p>Ate a hot dog? Prove it!</p>
    </div>

    <div class="card" style="max-width: 600px;">
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
import { hotdogs } from '../api';

export default {
  data() {
    return {
      title: '',
      quantity: 1,
      description: '',
      imageFile: null,
      imagePreview: null,
      loading: false,
      error: null,
      success: false
    };
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
    async submit() {
      this.error = null;
      this.success = false;

      if (!this.imageFile) {
        this.error = 'Please upload a photo of your hot dog!';
        return;
      }

      this.loading = true;
      try {
        const formData = new FormData();
        formData.append('image', this.imageFile);
        formData.append('title', this.title);
        formData.append('quantity', this.quantity);
        if (this.description) formData.append('description', this.description);

        await hotdogs.create(formData);
        this.success = true;
        this.title = '';
        this.quantity = 1;
        this.description = '';
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
