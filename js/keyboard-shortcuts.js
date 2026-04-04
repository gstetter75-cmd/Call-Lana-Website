// ==========================================
// Keyboard Shortcuts for all Dashboards
// Depends on: global-search.js (GlobalSearch)
// ==========================================

const KeyboardShortcuts = {
  shortcuts: {},
  helpVisible: false,

  init(shortcuts) {
    this.shortcuts = shortcuts || {};

    document.addEventListener('keydown', (e) => {
      // Skip if typing in an input/textarea
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') {
        if (e.key === 'Escape') e.target.blur();
        return;
      }

      // Global shortcuts
      if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        if (typeof GlobalSearch !== 'undefined') GlobalSearch.open();
        return;
      }

      if (e.key === 'Escape') {
        // Close any open modal
        document.querySelectorAll('.modal-overlay').forEach(m => {
          if (m.style.display !== 'none' && m.id) {
            if (typeof closeModal === 'function') closeModal(m.id);
          }
        });
        if (typeof GlobalSearch !== 'undefined') GlobalSearch.close();
        if (this.helpVisible) this.hideHelp();
        return;
      }

      if (e.key === '?') {
        e.preventDefault();
        this.helpVisible ? this.hideHelp() : this.showHelp();
        return;
      }

      // Custom shortcuts
      const handler = this.shortcuts[e.key.toLowerCase()];
      if (handler && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        handler();
      }
    });
  },

  showHelp() {
    let overlay = document.getElementById('shortcuts-help-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'shortcuts-help-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:260;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;';
      overlay.addEventListener('click', (e) => { if (e.target === overlay) this.hideHelp(); });
      document.body.appendChild(overlay);
    }

    const entries = Object.entries(this.shortcuts);
    const globalShortcuts = [
      { key: '/', desc: 'Suche öffnen' },
      { key: '?', desc: 'Shortcuts anzeigen' },
      { key: 'ESC', desc: 'Modal schließen' },
    ];

    overlay.innerHTML = `
      <div style="background:var(--bg2);border-radius:16px;border:1px solid var(--border);padding:24px;max-width:400px;width:90%;">
        <h3 style="margin:0 0 16px;font-size:16px;">Keyboard Shortcuts</h3>
        <div style="display:flex;flex-direction:column;gap:6px;">
          ${globalShortcuts.map(s => this.renderShortcutRow(s.key, s.desc)).join('')}
          ${entries.length ? '<div style="border-top:1px solid var(--border);margin:8px 0;"></div>' : ''}
          ${entries.map(([key, fn]) => {
            const desc = fn._description || key;
            return this.renderShortcutRow(key.toUpperCase(), desc);
          }).join('')}
        </div>
        <div style="text-align:center;margin-top:16px;"><button class="btn btn-outline btn-sm" onclick="KeyboardShortcuts.hideHelp()">Schließen</button></div>
      </div>
    `;
    overlay.style.display = 'flex';
    this.helpVisible = true;
  },

  hideHelp() {
    const overlay = document.getElementById('shortcuts-help-overlay');
    if (overlay) overlay.style.display = 'none';
    this.helpVisible = false;
  },

  renderShortcutRow(key, desc) {
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;">
      <span style="font-size:13px;color:var(--tx);">${desc}</span>
      <kbd style="background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:2px 8px;font-size:12px;color:var(--tx3);font-family:'Manrope',monospace;">${key}</kbd>
    </div>`;
  }
};

window.KeyboardShortcuts = KeyboardShortcuts;
