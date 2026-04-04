// ==========================================
// In-App Notification Center
// ==========================================

const NotificationCenter = {
  notifications: [],
  isOpen: false,
  _clickHandler: null,

  init(profile) {
    this.profile = profile;
    this.injectBell();
    this.loadNotifications();
  },

  injectBell() {
    // Clean up previous listener
    if (this._clickHandler) document.removeEventListener('click', this._clickHandler);

    const topbar = document.querySelector('.topbar');
    if (!topbar || document.getElementById('notif-bell')) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'notif-bell';
    wrapper.style.cssText = 'position:relative;margin-left:auto;margin-right:12px;';
    wrapper.innerHTML = `
      <button onclick="NotificationCenter.toggle()" style="background:none;border:none;cursor:pointer;position:relative;padding:6px;">
        <svg width="20" height="20" fill="none" stroke="var(--tx2)" stroke-width="2"><path d="M10 18c1.1 0 2-.9 2-2H8c0 1.1.9 2 2 2zm6-5V9c0-3.07-1.63-5.64-4.5-6.32V2c0-.83-.67-1.5-1.5-1.5S8.5 1.17 8.5 2v.68C5.64 3.36 4 5.92 4 9v4l-1 1v1h14v-1l-1-1z"/></svg>
        <span id="notif-badge" style="display:none;position:absolute;top:2px;right:2px;width:16px;height:16px;border-radius:50%;background:#ef4444;color:white;font-size:9px;font-weight:700;line-height:16px;text-align:center;">0</span>
      </button>
      <div id="notif-dropdown" style="display:none;position:fixed;right:16px;top:52px;width:340px;max-height:400px;overflow-y:auto;background:var(--bg2);border:1px solid var(--border);border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.3);z-index:300;">
        <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
          <span style="font-weight:700;font-size:13px;">Benachrichtigungen</span>
          <button onclick="NotificationCenter.markAllRead()" style="background:none;border:none;color:var(--pu);cursor:pointer;font-size:11px;">Alle gelesen</button>
        </div>
        <div id="notif-list"></div>
      </div>
    `;

    const breadcrumb = topbar.querySelector('.topbar-breadcrumb');
    if (breadcrumb) breadcrumb.parentElement.insertBefore(wrapper, breadcrumb.nextSibling);
    else topbar.appendChild(wrapper);

    this._clickHandler = (e) => {
      if (this.isOpen && !wrapper.contains(e.target)) this.close();
    };
    document.addEventListener('click', this._clickHandler);
  },

  toggle() {
    this.isOpen ? this.close() : this.open();
  },

  open() {
    document.getElementById('notif-dropdown').style.display = 'block';
    this.isOpen = true;
    this.renderList();
  },

  close() {
    document.getElementById('notif-dropdown').style.display = 'none';
    this.isOpen = false;
  },

  updateBadge() {
    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    const count = this.notifications.filter(n => !n.read).length;
    badge.textContent = count;
    badge.style.display = count > 0 ? 'block' : 'none';
  },

  addNotification(title, message, type = 'info', action = null) {
    this.notifications = [{
      id: Date.now(),
      title,
      message,
      type,
      action,
      read: false,
      time: new Date()
    }, ...this.notifications].slice(0, 50);
    this.updateBadge();
    if (this.isOpen) this.renderList();
  },

  markAllRead() {
    this.notifications = this.notifications.map(n => ({ ...n, read: true }));
    this.updateBadge();
    this.renderList();
  },

  renderList() {
    const list = document.getElementById('notif-list');
    if (!list) return;

    if (!this.notifications.length) {
      list.innerHTML = '<div style="padding:30px;text-align:center;color:var(--tx3);font-size:12px;">Keine Benachrichtigungen</div>';
      return;
    }

    const typeIcons = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '🚨', lead: '🎯', call: '📞', task: '✅', reminder: '⏰' };
    const sanitize = typeof clanaUtils !== 'undefined' ? clanaUtils.sanitizeHtml : (s => s);

    list.innerHTML = this.notifications.slice(0, 20).map(n => `
      <div style="padding:10px 16px;border-bottom:1px solid var(--border);cursor:pointer;background:${n.read ? 'transparent' : 'var(--bg3)'};transition:background .15s;" onmouseenter="this.style.background='var(--bg3)'" onmouseleave="this.style.background='${n.read ? 'transparent' : 'var(--bg3)'}';" onclick="NotificationCenter.handleClick(${n.id})">
        <div style="display:flex;gap:8px;align-items:flex-start;">
          <span style="font-size:16px;margin-top:1px;">${typeIcons[n.type] || 'ℹ️'}</span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:12px;font-weight:${n.read ? '400' : '700'};">${sanitize(n.title)}</div>
            <div style="font-size:11px;color:var(--tx3);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${sanitize(n.message)}</div>
          </div>
          <span style="font-size:10px;color:var(--tx3);white-space:nowrap;">${this.timeAgo(n.time)}</span>
        </div>
      </div>
    `).join('');
  },

  handleClick(id) {
    const n = this.notifications.find(x => x.id === id);
    if (!n) return;
    this.notifications = this.notifications.map(x => x.id === id ? { ...x, read: true } : x);
    this.updateBadge();
    if (n.action && typeof n.action === 'function') n.action();
    this.renderList();
  },

  timeAgo(date) {
    const secs = Math.floor((Date.now() - date.getTime()) / 1000);
    if (secs < 60) return 'gerade';
    if (secs < 3600) return Math.floor(secs / 60) + ' Min.';
    if (secs < 86400) return Math.floor(secs / 3600) + ' Std.';
    return Math.floor(secs / 86400) + ' Tage';
  },

  // Accept leads from caller instead of making own DB call
  checkFollowUpReminders(leads) {
    if (!leads) return;
    const now = Date.now();

    leads.forEach(l => {
      if (['won', 'lost'].includes(l.status)) return;
      const lastUpdate = new Date(l.updated_at || l.created_at).getTime();
      const daysSince = Math.floor((now - lastUpdate) / 86400000);

      if (daysSince >= 14) {
        this.addNotification('Lead vergessen?', `${l.company_name} — seit ${daysSince} Tagen kein Kontakt`, 'warning');
      } else if (daysSince >= 7) {
        this.addNotification('Follow-up fällig', `${l.company_name} — seit ${daysSince} Tagen kein Update`, 'reminder');
      }
    });
  },

  async loadNotifications() {
    try {
      const { data } = await supabaseClient.from('announcements').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(5);
      const sanitize = typeof clanaUtils !== 'undefined' ? clanaUtils.sanitizeHtml : (s => s);
      (data || []).forEach(a => {
        const role = this.profile?.role;
        if (!a.target_role || a.target_role === role) {
          this.addNotification(sanitize(a.title), sanitize(a.message), a.type || 'info');
        }
      });
    } catch (e) { /* table may not exist */ }
  }
};

window.NotificationCenter = NotificationCenter;
