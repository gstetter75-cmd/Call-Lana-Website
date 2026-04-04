// PWA Install Prompt — Smart banner for app installation
const InstallPrompt = {
  _deferredPrompt: null,

  init() {
    // Capture the install prompt event
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this._deferredPrompt = e;
      // Only show banner if not dismissed before
      if (!localStorage.getItem('clana_install_dismissed')) {
        this._showBanner();
      }
    });

    // Track successful install
    window.addEventListener('appinstalled', () => {
      this._deferredPrompt = null;
      this._hideBanner();
      if (typeof showToast !== 'undefined') {
        showToast('Call Lana wurde installiert!');
      }
    });
  },

  _showBanner() {
    if (document.getElementById('install-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'install-banner';
    banner.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--pu,#7c3aed);color:#fff;padding:12px 20px;border-radius:12px;display:flex;align-items:center;gap:12px;z-index:9998;box-shadow:0 4px 20px rgba(0,0,0,0.15);max-width:90vw;font-size:14px;';
    banner.innerHTML = `
      <span>📱 Call Lana als App installieren?</span>
      <button onclick="InstallPrompt.install()" style="background:#fff;color:var(--pu,#7c3aed);border:none;padding:6px 14px;border-radius:8px;font-weight:600;cursor:pointer;white-space:nowrap;">Installieren</button>
      <button onclick="InstallPrompt.dismiss()" style="background:none;border:none;color:rgba(255,255,255,0.7);cursor:pointer;font-size:18px;padding:0 4px;">&times;</button>
    `;
    document.body.appendChild(banner);
  },

  _hideBanner() {
    const banner = document.getElementById('install-banner');
    if (banner) banner.remove();
  },

  async install() {
    if (!this._deferredPrompt) return;
    this._deferredPrompt.prompt();
    const result = await this._deferredPrompt.userChoice;
    if (result.outcome === 'accepted') {
      this._deferredPrompt = null;
    }
    this._hideBanner();
  },

  dismiss() {
    localStorage.setItem('clana_install_dismissed', '1');
    this._hideBanner();
  }
};

window.InstallPrompt = InstallPrompt;
