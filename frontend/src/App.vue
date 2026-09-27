<template>
  <div id="app">
    <nav class="navbar">
      <div class="nav-container">
        <router-link to="/" class="nav-brand">🌭 {{ brand }}</router-link>
        <div class="nav-links">
          <router-link to="/feed">Feed</router-link>
          <router-link to="/leaderboards">Leaderboards</router-link>
          <router-link v-if="showVote" to="/vote">Vote</router-link>
          <router-link v-if="showHallOfFame" to="/hall-of-fame">Hall of Fame</router-link>
          <template v-if="user">
            <router-link to="/my-feed">My Dogs</router-link>
            <router-link to="/settings">Settings</router-link>
            <router-link v-if="user.is_admin" to="/admin">Admin</router-link>
            <router-link v-if="site.loggingOpen" to="/log" class="btn-nav">Log a Dog</router-link>
            <button @click="logout" class="btn-logout">Logout</button>
          </template>
          <template v-else>
            <router-link to="/login">Login</router-link>
            <router-link to="/register" class="btn-nav">Sign Up</router-link>
          </template>
        </div>
        <button class="mobile-toggle" @click="mobileOpen = !mobileOpen">☰</button>
      </div>
      <div v-if="mobileOpen" class="mobile-menu">
        <router-link to="/feed" @click="mobileOpen = false">Feed</router-link>
        <router-link to="/leaderboards" @click="mobileOpen = false">Leaderboards</router-link>
        <router-link v-if="showVote" to="/vote" @click="mobileOpen = false">Vote</router-link>
        <router-link v-if="showHallOfFame" to="/hall-of-fame" @click="mobileOpen = false">Hall of Fame</router-link>
        <router-link to="/rules" @click="mobileOpen = false">Rules</router-link>
        <template v-if="user">
          <router-link v-if="site.loggingOpen" to="/log" @click="mobileOpen = false">Log a Dog</router-link>
          <router-link to="/my-feed" @click="mobileOpen = false">My Dogs</router-link>
          <router-link to="/settings" @click="mobileOpen = false">Settings</router-link>
          <router-link v-if="user.is_admin" to="/admin" @click="mobileOpen = false">Admin</router-link>
          <a href="#" @click.prevent="logout(); mobileOpen = false">Logout</a>
        </template>
        <template v-else>
          <router-link to="/login" @click="mobileOpen = false">Login</router-link>
          <router-link to="/register" @click="mobileOpen = false">Sign Up</router-link>
        </template>
      </div>
    </nav>
    <main class="main-content">
      <router-view :key="$route.fullPath" />
    </main>
    <footer class="footer">
      <p>🌭 {{ brand }}</p>
    </footer>
  </div>
</template>

<script>
import { auth } from './api';
import { site, refreshSite, brandName } from './siteState';

export default {
  data() {
    return {
      user: auth.getUser(),
      mobileOpen: false,
      site
    };
  },
  computed: {
    brand() {
      return brandName();
    },
    showVote() {
      return site.loaded && site.settings.nav_show_vote !== 'false';
    },
    // Admins always see it so they can preview before flipping it public.
    showHallOfFame() {
      return site.hallOfFamePublic || !!(this.user && this.user.is_admin);
    }
  },
  async created() {
    window.addEventListener('auth-change', () => {
      this.user = auth.getUser();
    });
    try {
      await refreshSite();
    } catch (e) {
      // ignore — pages fall back to their own defaults
    }
  },
  methods: {
    logout() {
      auth.logout();
      this.user = null;
      window.dispatchEvent(new Event('auth-change'));
      this.$router.push('/');
    }
  }
};
</script>
