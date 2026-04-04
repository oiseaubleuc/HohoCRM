import './styles/app.css';

/** Netlify: zet in Netlify → Environment (ook bij build) + zelfde secret in function env */
window.__NEBULA_FOLLOWUP_URL__ = import.meta.env.VITE_FOLLOWUP_URL || '';
window.__NEBULA_FOLLOWUP_SECRET__ = import.meta.env.VITE_FOLLOWUP_SECRET || '';
window.__HOHOH_FOLLOWUP_URL__ = window.__NEBULA_FOLLOWUP_URL__;
window.__HOHOH_FOLLOWUP_SECRET__ = window.__NEBULA_FOLLOWUP_SECRET__;

const THEME_STORAGE_KEY = 'nebula-theme';
const THEME_LEGACY_KEY = 'hohoh-theme';

function getStoredTheme() {
  try {
    let v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v === 'light' || v === 'dark') return v;
    v = localStorage.getItem(THEME_LEGACY_KEY);
    if (v === 'light' || v === 'dark') {
      localStorage.setItem(THEME_STORAGE_KEY, v);
      return v;
    }
  } catch { /* ignore */ }
  return null;
}

function getInitialTheme() {
  const stored = getStoredTheme();
  if (stored) return stored;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light') root.setAttribute('data-theme', 'light');
  else root.removeAttribute('data-theme');

  const meta = document.getElementById('theme-color-meta');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#f4f5f9' : '#06060a');

  const status = document.getElementById('apple-status-style');
  if (status) status.setAttribute('content', theme === 'light' ? 'default' : 'black-translucent');
}

function initTheme() {
  applyTheme(getInitialTheme());

  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch { /* ignore */ }
    applyTheme(next);
  });

  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
    if (getStoredTheme() != null) return;
    applyTheme(e.matches ? 'light' : 'dark');
  });
}

initTheme();
