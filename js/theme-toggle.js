// ==========================================
// Dark/Light Theme Toggle
// Stores preference in localStorage, respects system preference
// ==========================================

const ThemeToggle = {
  STORAGE_KEY: 'calllana_theme',

  init() {
    // Determine initial theme
    const stored = localStorage.getItem(this.STORAGE_KEY);
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored ? stored === 'dark' : systemDark;

    this.apply(isDark ? 'dark' : 'light');

    // Listen for system changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem(this.STORAGE_KEY)) {
        this.apply(e.matches ? 'dark' : 'light');
      }
    });

    // Add toggle button to sidebar bottom (if sidebar exists)
    this.injectButton();
  },

  apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(this.STORAGE_KEY, theme);
  },

  toggle() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    this.apply(current === 'dark' ? 'light' : 'dark');
    this.updateButton();
  },

  injectButton() {
    // Wait for sidebar to be loaded
    const check = () => {
      const sbBottom = document.querySelector('.sb-bottom');
      if (!sbBottom) { setTimeout(check, 500); return; }
      if (document.getElementById('theme-toggle-btn')) return;

      const btn = document.createElement('button');
      btn.id = 'theme-toggle-btn';
      btn.style.cssText = 'background:none;border:1px solid var(--border);border-radius:8px;padding:6px 10px;cursor:pointer;color:var(--tx3);font-size:12px;display:flex;align-items:center;gap:6px;margin:8px 16px;width:calc(100% - 32px);transition:all .2s;';
      btn.onmouseenter = () => btn.style.borderColor = 'var(--pu)';
      btn.onmouseleave = () => btn.style.borderColor = 'var(--border)';
      btn.onclick = () => ThemeToggle.toggle();
      sbBottom.insertBefore(btn, sbBottom.firstChild);
      this.updateButton();
    };
    check();
  },

  updateButton() {
    const btn = document.getElementById('theme-toggle-btn');
    if (!btn) return;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    btn.innerHTML = isDark
      ? '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="7" cy="7" r="4"/><path d="M7 1v1M7 12v1M1 7h1M12 7h1M2.8 2.8l.7.7M10.5 10.5l.7.7M2.8 11.2l.7-.7M10.5 3.5l.7-.7"/></svg> Light Mode'
      : '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12.3 8.5A5.5 5.5 0 015.5 1.7 7 7 0 1012.3 8.5z"/></svg> Dark Mode';
  }
};

// Auto-init
document.addEventListener('DOMContentLoaded', () => ThemeToggle.init());
// Also init if DOM already loaded (scripts at bottom)
if (document.readyState !== 'loading') ThemeToggle.init();

window.ThemeToggle = ThemeToggle;
