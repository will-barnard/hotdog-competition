// Site-wide season state (current season, Off-Season mode, Hall of Fame
// visibility). Shared reactively so an admin flipping a lever re-themes the
// whole app immediately, without a reload.
import { reactive } from 'vue';
import { settings } from './api';

export const site = reactive({
  loaded: false,
  season: null,          // { id, name, starts_at, ends_at, status }
  status: 'none',        // 'active' | 'upcoming' | 'ended' | 'none'
  offSeason: false,      // Off-Season mode in effect (lever on and no season running)
  loggingOpen: true,
  hallOfFamePublic: false,
  settings: {}
});

export function applySettings(data) {
  site.settings = data;
  site.season = data.season || null;
  site.status = data.status || 'none';
  site.offSeason = !!data.off_season;
  site.loggingOpen = data.logging_open !== false;
  site.hallOfFamePublic = !!data.hall_of_fame_public;
  site.loaded = true;
  // "Away game grey" — style.css re-maps the palette under this attribute.
  if (site.offSeason) document.documentElement.dataset.theme = 'offseason';
  else delete document.documentElement.dataset.theme;
}

export async function refreshSite() {
  const data = await settings.get();
  applySettings(data);
  return data;
}

// "2026 Hotdog Showdown" — the season's name leads the brand.
export function brandName() {
  return site.season && site.season.name ? `${site.season.name} Hotdog Showdown` : 'Hotdog Showdown';
}
