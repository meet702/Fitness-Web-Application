// ===== CONFIG =====
const API_BASE = '';
const KEYCLOAK_TOKEN_URL = 'http://localhost:8181/realms/master/protocol/openid-connect/token';
const CLIENT_ID = 'fitness-pkce-client';
const CLIENT_SECRET = null;

// Keycloak Admin credentials (for user registration)
// Change these to match your Keycloak admin account
const KEYCLOAK_ADMIN_USER = 'admin';
const KEYCLOAK_ADMIN_PASS = 'admin';

// ===== AUTH =====
function setToken(t) { localStorage.setItem('ft_token', t); }
function getToken() { return localStorage.getItem('ft_token'); }
function clearToken() { localStorage.removeItem('ft_token'); localStorage.removeItem('ft_user'); }
function setUser(u) { localStorage.setItem('ft_user', JSON.stringify(u)); }
function getUser() { try { return JSON.parse(localStorage.getItem('ft_user')); } catch { return null; } }

function parseJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(atob(payload).split('').map(c =>
      '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join(''));
    return JSON.parse(json);
  } catch { return null; }
}

function getUserId() {
  const token = getToken();
  if (!token) return null;
  const p = parseJwt(token);
  return p ? (p.sub || p.preferred_username || '') : '';
}

function getUserDisplayName() {
  const user = getUser();
  if (user && user.firstName) return user.firstName;
  const token = getToken();
  if (!token) return 'Guest';
  const p = parseJwt(token);
  return p ? (p.preferred_username || p.email || p.sub || 'User') : 'User';
}

function getUserInitials() {
  const name = getUserDisplayName();
  return name.charAt(0).toUpperCase();
}

function isLoggedIn() { return !!getToken(); }

function requireAuth() {
  if (!isLoggedIn()) { window.location.href = '/index.html'; return false; }
  return true;
}

function logout() {
  clearToken();
  window.location.href = '/index.html';
}

// ===== KEYCLOAK LOGIN (proxied through gateway) =====
async function keycloakLogin(username, password) {
  const body = new URLSearchParams();
  body.set('grant_type', 'password');
  body.set('client_id', CLIENT_ID);
  if (CLIENT_SECRET) body.set('client_secret', CLIENT_SECRET);
  body.set('username', username);
  body.set('password', password);

  const res = await fetch('/keycloak/realms/master/protocol/openid-connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error('Authentication failed. Check your credentials.');
  }
  return res.json();
}

// ===== API FETCH =====
async function apiFetch(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  const token = getToken();
  if (token && token !== 'guest') headers['Authorization'] = 'Bearer ' + token;
  if (!headers['Content-Type'] && opts.body) headers['Content-Type'] = 'application/json';

  const res = await fetch(API_BASE + path, { ...opts, headers });
  if (res.status === 401) {
    // Token expired or invalid — re-login
    showToast('Session expired. Please login again.', 'error');
    clearToken();
    setTimeout(() => { window.location.href = '/index.html'; }, 1500);
    throw new Error('Session expired');
  }
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(res.status + ' ' + res.statusText);
    err.status = res.status;
    err.body = text;
    throw err;
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}

// ===== TOAST NOTIFICATIONS =====
function ensureToastContainer() {
  let c = document.querySelector('.toast-container');
  if (!c) { c = document.createElement('div'); c.className = 'toast-container'; document.body.appendChild(c); }
  return c;
}

function showToast(message, type = 'info', duration = 4000) {
  const container = ensureToastContainer();
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ===== NAVBAR =====
function renderNavbar(activePage) {
  const nav = document.getElementById('navbar');
  if (!nav) return;
  const name = getUserDisplayName();
  const initials = getUserInitials();

  nav.innerHTML = `
    <a href="/dashboard.html" class="nav-brand">
      <svg viewBox="0 0 24 24" fill="none" stroke="url(#g)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#6366f1"/><stop offset="100%" stop-color="#a855f7"/></linearGradient></defs>
        <path d="M18 20V10M12 20V4M6 20v-6"/>
      </svg>
      FitPulse
    </a>
    <div class="nav-links">
      <a href="/dashboard.html" class="${activePage === 'dashboard' ? 'active' : ''}">Dashboard</a>
      <a href="/activity.html" class="${activePage === 'activity' ? 'active' : ''}">Log Activity</a>
    </div>
    <div class="nav-user">
      <span>${name}</span>
      <div class="avatar">${initials}</div>
      <button class="btn btn-ghost btn-sm" onclick="logout()">Logout</button>
    </div>
  `;
}

// ===== ACTIVITY HELPERS =====
const ACTIVITY_TYPES = [
  { value: 'RUNNING', label: 'Running', emoji: '🏃' },
  { value: 'WALKING', label: 'Walking', emoji: '🚶' },
  { value: 'CYCLING', label: 'Cycling', emoji: '🚴' },
  { value: 'SWIMMING', label: 'Swimming', emoji: '🏊' },
  { value: 'WEIGHT_TRAINING', label: 'Weights', emoji: '🏋️' },
  { value: 'YOGA', label: 'Yoga', emoji: '🧘' },
  { value: 'CARDIO', label: 'Cardio', emoji: '❤️' },
  { value: 'STRETCHING', label: 'Stretch', emoji: '🤸' },
  { value: 'OTHER', label: 'Other', emoji: '⚡' }
];

function getActivityEmoji(type) {
  const t = ACTIVITY_TYPES.find(a => a.value === type);
  return t ? t.emoji : '⚡';
}

function getActivityLabel(type) {
  const t = ACTIVITY_TYPES.find(a => a.value === type);
  return t ? t.label : type;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return formatDate(dateStr) + ' ' + formatTime(dateStr);
}
