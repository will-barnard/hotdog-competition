import { createRouter, createWebHistory } from 'vue-router';
import Home from './pages/Home.vue';
import Login from './pages/Login.vue';
import Register from './pages/Register.vue';
import LogDog from './pages/LogDog.vue';
import Feed from './pages/Feed.vue';
import MyFeed from './pages/MyFeed.vue';
import Leaderboards from './pages/Leaderboards.vue';
import Rules from './pages/Rules.vue';
import Admin from './pages/Admin.vue';
import Profile from './pages/Profile.vue';
import Settings from './pages/Settings.vue';
import Competitors from './pages/Competitors.vue';
import TempReset from './pages/TempReset.vue'; // TEMPORARY
import { auth } from './api';

const routes = [
  { path: '/', component: Home },
  { path: '/login', component: Login },
  { path: '/register', component: Register },
  { path: '/log', component: LogDog, meta: { requiresAuth: true } },
  { path: '/feed', component: Feed },
  { path: '/my-feed', component: MyFeed, meta: { requiresAuth: true } },
  { path: '/leaderboards', component: Leaderboards },
  { path: '/competitors', component: Competitors },
  { path: '/rules', component: Rules },
  { path: '/admin', component: Admin, meta: { requiresAuth: true, requiresAdmin: true } },
  { path: '/profile/:username', component: Profile },
  { path: '/settings', component: Settings, meta: { requiresAuth: true } },
  { path: '/temp-reset', component: TempReset }, // TEMPORARY
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  if (to.meta.requiresAuth && !auth.isLoggedIn()) {
    next('/login');
  } else if (to.meta.requiresAdmin) {
    const user = auth.getUser();
    if (!user || !user.is_admin) {
      next('/');
    } else {
      next();
    }
  } else {
    next();
  }
});

export default router;
