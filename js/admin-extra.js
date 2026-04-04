// ==========================================
// Admin Extra: Onboarding Queue, Minutes Alert, Error Log
// Depends on: supabase-init.js, admin.js
// ==========================================

const AdminExtra = {

  // ==========================================
  // ONBOARDING QUEUE (Spec §7)
  // ==========================================

  async loadOnboarding() {
    try {
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('id,email,first_name,last_name,company,plan,created_at,onboarding_status')
        .in('onboarding_status', ['pending', 'setup', 'review'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      const customers = data || [];

      const pending = customers.filter(c => c.onboarding_status === 'pending').length;
      const setup = customers.filter(c => c.onboarding_status === 'setup').length;

      // Count this week's live customers
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const { data: liveData } = await supabaseClient
        .from('profiles')
        .select('id')
        .eq('onboarding_status', 'live')
        .gte('created_at', weekAgo.toISOString());
      const liveThisWeek = (liveData || []).length;

      this._updateEl('onb-pending', pending);
      this._updateEl('onb-setup', setup);
      this._updateEl('onb-live', liveThisWeek);
      this._updateEl('onb-total-badge', customers.length + ' Kunden');

      const tbody = document.getElementById('onb-tbody');
      if (!tbody) return;

      if (!customers.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--tx3);padding:40px;">Alle Kunden sind live!</td></tr>';
        return;
      }

      const sanitize = typeof clanaUtils !== 'undefined' ? clanaUtils.sanitizeHtml : (s) => s;
      const statusMap = {
        pending: { label: 'Ausstehend', cls: 'badge-orange' },
        setup: { label: 'In Einrichtung', cls: 'badge-cyan' },
        review: { label: 'Review', cls: 'badge-purple' }
      };
      const nextStepMap = {
        pending: 'Willkommens-E-Mail senden',
        setup: 'Assistent konfigurieren',
        review: 'Testanruf durchführen'
      };

      tbody.innerHTML = customers.map(c => {
        const name = sanitize((c.first_name || '') + ' ' + (c.last_name || '')).trim() || sanitize(c.email || '–');
        const email = sanitize(c.email || '–');
        const plan = c.plan || 'free';
        const date = c.created_at ? new Date(c.created_at).toLocaleDateString('de-DE') : '–';
        const st = statusMap[c.onboarding_status] || { label: sanitize(c.onboarding_status || '–'), cls: 'badge-purple' };
        const next = nextStepMap[c.onboarding_status] || '–';
        const safeId = sanitize(c.id || '');
        const safeStatus = sanitize(c.onboarding_status || '');

        return '<tr>' +
          '<td><strong>' + name + '</strong></td>' +
          '<td>' + email + '</td>' +
          '<td><span class="badge badge-purple">' + sanitize(plan) + '</span></td>' +
          '<td>' + date + '</td>' +
          '<td><span class="badge ' + st.cls + '">' + st.label + '</span></td>' +
          '<td style="font-size:12px;color:var(--tx3);">' + next + '</td>' +
          '<td><button class="btn btn-sm btn-outline" data-id="' + safeId + '" data-status="' + safeStatus + '" onclick="AdminExtra.advanceOnboarding(this.dataset.id,this.dataset.status)">Weiter</button></td>' +
        '</tr>';
      }).join('');
    } catch (e) {
      if (typeof Logger !== 'undefined') Logger.warn('AdminExtra.loadOnboarding', e);
    }
  },

  async advanceOnboarding(id, currentStatus) {
    const nextMap = { pending: 'setup', setup: 'review', review: 'live' };
    const next = nextMap[currentStatus] || 'live';
    try {
      await supabaseClient.from('profiles').update({ onboarding_status: next }).eq('id', id);
      if (typeof showToast !== 'undefined') showToast('Status aktualisiert auf: ' + next);
      await this.loadOnboarding();
    } catch (e) {
      if (typeof showToast !== 'undefined') showToast('Fehler beim Aktualisieren.', true);
    }
  },

  // ==========================================
  // MINUTES ALERT (Spec §7)
  // ==========================================

  async loadMinutesAlert() {
    try {
      const { data: customers, error } = await supabaseClient
        .from('profiles')
        .select('id,email,first_name,last_name,plan,monthly_minutes_limit,minutes_used')
        .order('minutes_used', { ascending: false })
        .limit(500);

      if (error) throw error;
      const all = (customers || []).map(c => {
        const limit = c.monthly_minutes_limit || this._getPlanLimit(c.plan);
        const used = c.minutes_used || 0;
        const pct = limit > 0 ? Math.round((used / limit) * 100) : 0;
        return Object.assign({}, c, { limit, used, pct });
      });

      const critical = all.filter(c => c.pct >= 90);
      const warning = all.filter(c => c.pct >= 80 && c.pct < 90);
      const normal = all.filter(c => c.pct < 80);

      this._updateEl('min-critical', critical.length);
      this._updateEl('min-warning', warning.length);
      this._updateEl('min-normal', normal.length);

      const tbody = document.getElementById('min-tbody');
      if (!tbody) return;

      // Show critical + warning first, then normal
      const sorted = [...critical, ...warning, ...normal.slice(0, 20)];

      if (!sorted.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--tx3);padding:40px;">Keine Kunden-Daten vorhanden.</td></tr>';
        return;
      }

      const sanitize = typeof clanaUtils !== 'undefined' ? clanaUtils.sanitizeHtml : (s) => s;

      tbody.innerHTML = sorted.map(c => {
        const name = sanitize(((c.first_name || '') + ' ' + (c.last_name || '')).trim() || c.email || '–');
        const plan = c.plan || 'free';
        let statusHtml = '<span class="badge badge-green">Normal</span>';
        let barColor = 'var(--green)';
        if (c.pct >= 90) { statusHtml = '<span class="badge badge-red">Kritisch</span>'; barColor = 'var(--red)'; }
        else if (c.pct >= 80) { statusHtml = '<span class="badge badge-orange">Warnung</span>'; barColor = 'var(--orange)'; }

        return '<tr>' +
          '<td><strong>' + name + '</strong></td>' +
          '<td><span class="badge badge-purple">' + plan + '</span></td>' +
          '<td>' + c.used + ' min</td>' +
          '<td>' + c.limit + ' min</td>' +
          '<td>' +
            '<div style="display:flex;align-items:center;gap:8px;">' +
              '<div style="flex:1;height:8px;background:var(--bg3);border-radius:4px;overflow:hidden;min-width:60px;">' +
                '<div style="width:' + Math.min(c.pct, 100) + '%;height:100%;background:' + barColor + ';border-radius:4px;"></div>' +
              '</div>' +
              '<span style="font-size:12px;font-weight:700;min-width:36px;text-align:right;">' + c.pct + '%</span>' +
            '</div>' +
          '</td>' +
          '<td>' + statusHtml + '</td>' +
        '</tr>';
      }).join('');
    } catch (e) {
      if (typeof Logger !== 'undefined') Logger.warn('AdminExtra.loadMinutesAlert', e);
    }
  },

  _getPlanLimit(plan) {
    const limits = { free: 100, solo: 1000, team: 3000, business: 10000 };
    return limits[plan] || 500;
  },

  // ==========================================
  // ERROR LOG (Spec §7)
  // ==========================================

  async loadErrorLog() {
    try {
      const { data, error } = await supabaseClient
        .from('error_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        // Table may not exist — show demo data
        this._renderErrorLogEmpty();
        return;
      }

      const logs = data || [];
      const today = new Date().toISOString().slice(0, 10);
      const todayErrors = logs.filter(l => l.severity === 'error' && l.created_at?.startsWith(today)).length;
      const warnings = logs.filter(l => l.severity === 'warning').length;
      const resolved = logs.filter(l => l.resolved).length;

      this._updateEl('err-today', todayErrors);
      this._updateEl('err-warnings', warnings);
      this._updateEl('err-resolved', resolved);

      const tbody = document.getElementById('err-tbody');
      if (!tbody) return;

      if (!logs.length) {
        this._renderErrorLogEmpty();
        return;
      }

      const sanitize = typeof clanaUtils !== 'undefined' ? clanaUtils.sanitizeHtml : (s) => s;
      const severityMap = {
        error: { label: 'Fehler', cls: 'badge-red' },
        warning: { label: 'Warnung', cls: 'badge-orange' },
        info: { label: 'Info', cls: 'badge-cyan' }
      };

      tbody.innerHTML = logs.slice(0, 50).map(l => {
        const time = l.created_at ? new Date(l.created_at).toLocaleString('de-DE') : '–';
        const service = sanitize(l.service || '–');
        const sev = severityMap[l.severity] || { label: l.severity, cls: 'badge-purple' };
        const msg = sanitize((l.message || '').slice(0, 100));
        const hasStack = l.stack_trace && l.stack_trace.length > 0;

        return '<tr>' +
          '<td style="font-size:12px;white-space:nowrap;">' + time + '</td>' +
          '<td><strong>' + service + '</strong></td>' +
          '<td><span class="badge ' + sev.cls + '">' + sev.label + '</span></td>' +
          '<td style="font-size:12px;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + msg + '</td>' +
          '<td>' + (hasStack ? '<button class="btn btn-sm btn-outline" onclick="AdminExtra.showStackTrace(\'' + l.id + '\')">Stack</button>' : '–') + '</td>' +
        '</tr>';
      }).join('');
    } catch (e) {
      this._renderErrorLogEmpty();
    }
  },

  _renderErrorLogEmpty() {
    const tbody = document.getElementById('err-tbody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--tx3);padding:40px;">Keine Fehler vorhanden. Gut so!</td></tr>';
    }
  },

  async showStackTrace(id) {
    try {
      const { data } = await supabaseClient.from('error_logs').select('stack_trace,message,service,created_at').eq('id', id).single();
      if (!data) return;

      const sanitize = typeof clanaUtils !== 'undefined' ? clanaUtils.sanitizeHtml : (s) => s;
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);z-index:100;display:flex;align-items:center;justify-content:center;';
      overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

      overlay.innerHTML = '<div style="background:var(--card);border:1px solid var(--border);border-radius:16px;padding:32px;max-width:700px;width:90%;max-height:80vh;overflow-y:auto;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
          '<h3 style="font-family:Syne,sans-serif;font-size:1rem;font-weight:700;">Stack Trace</h3>' +
          '<button onclick="this.closest(\'div[style*=fixed]\').remove()" style="background:none;border:none;color:var(--tx3);font-size:1.4rem;cursor:pointer;">✕</button>' +
        '</div>' +
        '<div style="font-size:12px;color:var(--tx3);margin-bottom:12px;">' + sanitize(data.service || '') + ' — ' + (data.created_at ? new Date(data.created_at).toLocaleString('de-DE') : '') + '</div>' +
        '<div style="font-size:13px;font-weight:600;color:var(--red);margin-bottom:12px;">' + sanitize(data.message || '') + '</div>' +
        '<pre style="background:var(--bg3);border-radius:10px;padding:16px;font-size:11px;color:var(--tx2);overflow-x:auto;white-space:pre-wrap;font-family:monospace;max-height:400px;overflow-y:auto;">' + sanitize(data.stack_trace || 'Kein Stack Trace') + '</pre>' +
      '</div>';
      document.body.appendChild(overlay);
    } catch (e) {
      if (typeof Logger !== 'undefined') Logger.warn('AdminExtra.showStackTrace', e);
      if (typeof showToast !== 'undefined') showToast('Stack Trace konnte nicht geladen werden.', true);
    }
  },

  // ==========================================
  // HELPERS
  // ==========================================

  _updateEl(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  },

  // ==========================================
  // TAB INIT
  // ==========================================

  async initTab(tab) {
    switch (tab) {
      case 'onboarding': await this.loadOnboarding(); break;
      case 'minutes-alert': await this.loadMinutesAlert(); break;
      case 'error-log': await this.loadErrorLog(); break;
    }
  }
};

window.AdminExtra = AdminExtra;
