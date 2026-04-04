// ==========================================
// Idle Timeout: Auto-logout after inactivity
// 30 min warning, 35 min auto-logout
// Depends on: auth.js (clanaAuth)
// ==========================================

const IdleTimeout = {

  WARN_AFTER_MS: 30 * 60 * 1000,    // 30 minutes
  LOGOUT_AFTER_MS: 35 * 60 * 1000,  // 35 minutes
  _warnTimer: null,
  _logoutTimer: null,
  _warningEl: null,

  init() {
    // Only on protected pages
    const protectedPages = ['dashboard.html', 'admin.html', 'sales.html', 'settings.html'];
    const currentPage = window.location.pathname.split('/').pop();
    if (!protectedPages.includes(currentPage)) return;

    this._resetTimers();

    // Reset on user activity
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    const handler = () => this._onActivity();
    events.forEach(e => document.addEventListener(e, handler, { passive: true }));
  },

  _onActivity() {
    this._hideWarning();
    this._resetTimers();
  },

  _resetTimers() {
    clearTimeout(this._warnTimer);
    clearTimeout(this._logoutTimer);

    this._warnTimer = setTimeout(() => this._showWarning(), this.WARN_AFTER_MS);
    this._logoutTimer = setTimeout(() => this._doLogout(), this.LOGOUT_AFTER_MS);
  },

  _showWarning() {
    if (this._warningEl) return;
    const el = document.createElement('div');
    el.id = 'idle-warning';
    el.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;' +
      'background:var(--card,#fff);border:1px solid rgba(251,146,60,.4);border-radius:12px;' +
      'padding:16px 20px;box-shadow:0 8px 24px rgba(0,0,0,.15);max-width:320px;' +
      'font-family:Manrope,sans-serif;animation:fadeIn .3s ease;';
    el.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">' +
        '<span style="font-size:20px;">⏰</span>' +
        '<strong style="font-size:14px;color:var(--tx,#111);">Inaktivität erkannt</strong>' +
      '</div>' +
      '<p style="font-size:13px;color:var(--tx3,#666);margin-bottom:12px;line-height:1.5;">' +
        'Du wirst in 5 Minuten automatisch abgemeldet. Klicke hier um aktiv zu bleiben.' +
      '</p>' +
      '<button onclick="IdleTimeout._onActivity()" style="background:var(--pu,#7c3aed);color:white;' +
        'border:none;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;' +
        'font-family:inherit;width:100%;">Aktiv bleiben</button>';
    document.body.appendChild(el);
    this._warningEl = el;
  },

  _hideWarning() {
    if (this._warningEl) {
      this._warningEl.remove();
      this._warningEl = null;
    }
  },

  async _doLogout() {
    this._hideWarning();
    if (typeof clanaAuth !== 'undefined') {
      await clanaAuth.signOut();
    }
    window.location.href = 'login.html?reason=idle';
  }
};

// Auto-init when script loads
IdleTimeout.init();
window.IdleTimeout = IdleTimeout;
