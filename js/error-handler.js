// ==========================================
// Global Error Handler: Offline detection, retry banner, error boundaries
// Depends on: nothing (standalone, loads early)
// ==========================================

const ErrorHandler = {

  _bannerEl: null,
  _isOffline: false,
  _retryCallbacks: [],

  init() {
    // Listen for online/offline events
    window.addEventListener('online', () => this._setOnline());
    window.addEventListener('offline', () => this._setOffline());

    // Check initial state
    if (!navigator.onLine) this._setOffline();

    // Intercept fetch errors globally for Supabase detection
    this._patchFetch();
  },

  _setOffline() {
    if (this._isOffline) return;
    this._isOffline = true;
    this._showBanner('Keine Internetverbindung. Daten können nicht geladen werden.', 'error');
  },

  _setOnline() {
    if (!this._isOffline) return;
    this._isOffline = false;
    this._hideBanner();
    // Auto-retry registered callbacks
    this._retryCallbacks.forEach(fn => {
      try { fn(); } catch (e) { /* ignore retry errors */ }
    });
  },

  // Show a non-blocking banner at the top of the page
  _showBanner(message, type) {
    this._hideBanner();
    const banner = document.createElement('div');
    banner.id = 'error-banner';
    const bgColor = type === 'error' ? 'rgba(248,113,113,.12)' : 'rgba(251,146,60,.12)';
    const borderColor = type === 'error' ? 'rgba(248,113,113,.4)' : 'rgba(251,146,60,.4)';
    const textColor = type === 'error' ? '#dc2626' : '#d97706';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;padding:10px 20px;' +
      'background:' + bgColor + ';border-bottom:1px solid ' + borderColor + ';' +
      'display:flex;align-items:center;justify-content:center;gap:12px;' +
      'font-size:13px;font-weight:600;color:' + textColor + ';font-family:Manrope,sans-serif;' +
      'backdrop-filter:blur(8px);';
    banner.innerHTML = '<span>' + message + '</span>' +
      '<button onclick="ErrorHandler.retry()" style="background:' + textColor + ';color:white;border:none;' +
      'border-radius:6px;padding:4px 12px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">Erneut versuchen</button>' +
      '<button onclick="ErrorHandler._hideBanner()" style="background:none;border:none;color:' + textColor + ';' +
      'font-size:18px;cursor:pointer;padding:0 4px;">×</button>';
    document.body.prepend(banner);
    this._bannerEl = banner;
  },

  _hideBanner() {
    const el = document.getElementById('error-banner');
    if (el) el.remove();
    this._bannerEl = null;
  },

  // Register a callback to be retried when connection restores
  onRetry(fn) {
    this._retryCallbacks.push(fn);
  },

  // Manual retry
  retry() {
    this._hideBanner();
    this._retryCallbacks.forEach(fn => {
      try { fn(); } catch (e) { /* ignore */ }
    });
  },

  // Detect Supabase errors in fetch responses
  _patchFetch() {
    const originalFetch = window.fetch;
    let consecutiveErrors = 0;

    window.fetch = async function(...args) {
      try {
        const response = await originalFetch.apply(this, args);
        // Reset counter on any successful response
        if (response.ok || response.status < 500) {
          consecutiveErrors = 0;
        } else if (response.status >= 500) {
          consecutiveErrors++;
          if (consecutiveErrors >= 3) {
            ErrorHandler._showBanner('Server-Probleme erkannt. Einige Funktionen sind eingeschränkt.', 'warning');
          }
        }
        return response;
      } catch (err) {
        consecutiveErrors++;
        if (consecutiveErrors >= 2 && !ErrorHandler._isOffline) {
          ErrorHandler._showBanner('Verbindungsproblem. Daten können nicht geladen werden.', 'error');
        }
        throw err;
      }
    };
  },

  // Show a specific error for a component (non-blocking)
  showComponentError(containerId, message) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--tx3);font-size:13px;">' +
      '<div style="font-size:20px;margin-bottom:8px;">⚠️</div>' +
      '<div>' + (message || 'Daten konnten nicht geladen werden.') + '</div>' +
      '<button onclick="location.reload()" style="margin-top:12px;background:var(--pu);color:white;border:none;' +
      'border-radius:8px;padding:8px 16px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">Seite neu laden</button>' +
    '</div>';
  }
};

window.ErrorHandler = ErrorHandler;
