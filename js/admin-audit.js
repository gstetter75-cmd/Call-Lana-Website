// ==========================================
// Admin: Audit Log, Activity Feed, KPI Goals, Announcements
// ==========================================

const AdminAudit = {

  // ==========================================
  // AUDIT LOG
  // ==========================================

  async logAction(action, targetType, targetId, oldValue, newValue) {
    try {
      await supabaseClient.from('audit_logs').insert([{
        user_id: (await clanaAuth.getUser())?.id,
        action,
        target_type: targetType,
        target_id: targetId,
        old_value: oldValue ? JSON.stringify(oldValue) : null,
        new_value: newValue ? JSON.stringify(newValue) : null
      }]);
    } catch (e) { /* silently fail if table doesn't exist */ }
  },

  async renderAuditLog(container) {
    if (!container) return;

    let logs = [];
    try {
      const { data } = await supabaseClient.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50);
      logs = data || [];
    } catch (e) { /* table may not exist */ }

    const actionLabels = {
      'role_change': '🔑 Rolle geändert',
      'user_toggle': '🔒 Benutzer (de)aktiviert',
      'org_create': '🏢 Organisation erstellt',
      'org_update': '🏢 Organisation bearbeitet',
      'invoice_generate': '🧾 Rechnungen generiert',
      'announcement_create': '📢 Ankündigung erstellt',
      'goal_create': '🎯 KPI-Ziel gesetzt',
      'customer_create': '👤 Kunde erstellt',
      'lead_convert': '🔄 Lead konvertiert'
    };

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="margin:0;font-size:14px;">Audit Log</h3>
        <span style="font-size:11px;color:var(--tx3);">${logs.length} Einträge</span>
      </div>
      ${logs.length ? `<div style="max-height:400px;overflow-y:auto;">
        ${logs.map(l => `
          <div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);font-size:12px;">
            <span style="white-space:nowrap;color:var(--tx3);">${new Date(l.created_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
            <span style="flex:1;">${actionLabels[l.action] || clanaUtils.sanitizeHtml(l.action)}</span>
            ${l.target_type ? `<span class="badge badge-purple" style="font-size:10px;">${clanaUtils.sanitizeHtml(l.target_type)}</span>` : ''}
          </div>
        `).join('')}
      </div>` : '<div style="color:var(--tx3);text-align:center;padding:20px;font-size:13px;">Noch keine Audit-Einträge.</div>'}
    `;
  },

  // ==========================================
  // REALTIME ACTIVITY FEED
  // ==========================================

  feedItems: [],

  initActivityFeed(container) {
    if (!container) return;
    this.feedContainer = container;
    this.renderFeed();

    // Subscribe to realtime changes
    try {
      ['leads', 'profiles'].forEach(table => {
        supabaseClient
          .channel(`admin-feed-${table}`)
          .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
            const labels = { INSERT: 'erstellt', UPDATE: 'aktualisiert', DELETE: 'gelöscht' };
            this.feedItems.unshift({
              time: new Date(),
              text: `${table === 'leads' ? '🎯 Lead' : '👤 Profil'} ${labels[payload.eventType] || payload.eventType}`,
              detail: payload.new?.company_name || payload.new?.email || payload.new?.first_name || ''
            });
            if (this.feedItems.length > 20) this.feedItems.pop();
            this.renderFeed();
          })
          .subscribe();
      });
    } catch (e) { /* Realtime may not be enabled */ }
  },

  renderFeed() {
    if (!this.feedContainer) return;
    this.feedContainer.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <h3 style="margin:0;font-size:14px;">Live Activity</h3>
        <span style="width:8px;height:8px;border-radius:50%;background:#10b981;animation:pulse 2s infinite;"></span>
      </div>
      <style>@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}</style>
      ${this.feedItems.length ? this.feedItems.slice(0, 10).map(f => `
        <div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px;">
          <span style="color:var(--tx3);white-space:nowrap;">${f.time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
          <span>${f.text}</span>
          ${f.detail ? `<span style="color:var(--tx3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${clanaUtils.sanitizeHtml(f.detail)}</span>` : ''}
        </div>
      `).join('') : '<div style="color:var(--tx3);text-align:center;padding:16px;font-size:12px;">Warte auf Aktivität…<br>Änderungen erscheinen hier in Echtzeit.</div>'}
    `;
  },

  // ==========================================
  // KPI GOAL TRACKING
  // ==========================================

  async renderGoals(container, currentMRR, customerCount) {
    if (!container) return;

    let goals = [];
    try {
      const now = new Date().toISOString().split('T')[0];
      const { data } = await supabaseClient.from('kpi_goals').select('*').lte('period_start', now).gte('period_end', now);
      goals = data || [];
    } catch (e) { /* table may not exist */ }

    // Auto-calculate current values
    const metricValues = {
      mrr: currentMRR || 0,
      customers: customerCount || 0,
      arr: (currentMRR || 0) * 12
    };

    const metricLabels = { mrr: 'MRR', customers: 'Kunden', arr: 'ARR', leads: 'Leads', revenue: 'Umsatz' };
    const metricFormats = {
      mrr: v => v.toLocaleString('de-DE') + ' €',
      arr: v => v.toLocaleString('de-DE') + ' €',
      revenue: v => v.toLocaleString('de-DE') + ' €',
      customers: v => v.toString(),
      leads: v => v.toString()
    };

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="margin:0;font-size:14px;">🎯 KPI-Ziele</h3>
        <button class="btn btn-sm btn-outline" onclick="AdminAudit.openGoalModal()">+ Ziel setzen</button>
      </div>
      ${goals.length ? goals.map(g => {
        const current = metricValues[g.metric] || g.current_value || 0;
        const pct = Math.min(Math.round((current / g.target_value) * 100), 100);
        const fmt = metricFormats[g.metric] || (v => v);
        const color = pct >= 100 ? '#10b981' : pct >= 70 ? '#7c3aed' : pct >= 40 ? '#f59e0b' : '#ef4444';

        return `<div style="margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
            <span style="font-weight:600;">${metricLabels[g.metric] || g.metric}</span>
            <span style="color:var(--tx3);">${fmt(current)} / ${fmt(g.target_value)}</span>
          </div>
          <div style="height:10px;background:var(--bg3);border-radius:5px;overflow:hidden;">
            <div style="width:${pct}%;height:100%;background:${color};border-radius:5px;transition:width .5s;"></div>
          </div>
          <div style="text-align:right;font-size:10px;color:${color};font-weight:700;margin-top:2px;">${pct}%${pct >= 100 ? ' ✅' : ''}</div>
        </div>`;
      }).join('') : '<div style="color:var(--tx3);text-align:center;padding:16px;font-size:12px;">Keine aktiven Ziele. Setze ein MRR- oder Kundenziel.</div>'}
    `;
  },

  async openGoalModal() {
    const metric = prompt('Metrik wählen (mrr / customers / arr / leads):');
    if (!metric) return;
    const target = Number(prompt('Zielwert eingeben:'));
    if (!target || target <= 0) { Components.toast('Ungültiger Zielwert', 'error'); return; }

    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    try {
      await supabaseClient.from('kpi_goals').upsert({
        metric, target_value: target, period_start: periodStart, period_end: periodEnd,
        created_by: (await clanaAuth.getUser())?.id
      }, { onConflict: 'metric,period_start' });

      this.logAction('goal_create', 'kpi_goal', null, null, { metric, target });
      Components.toast('Ziel gesetzt!', 'success');

      // Refresh
      const ov = document.getElementById('admin-goals');
      if (ov) this.renderGoals(ov);
    } catch (e) {
      Components.toast('Fehler: ' + e.message, 'error');
    }
  },

  // ==========================================
  // ANNOUNCEMENTS
  // ==========================================

  async renderAnnouncements(container) {
    if (!container) return;

    let announcements = [];
    try {
      const { data } = await supabaseClient.from('announcements').select('*').eq('is_active', true).order('created_at', { ascending: false });
      announcements = data || [];
    } catch (e) { /* table may not exist */ }

    const typeIcons = { info: 'ℹ️', warning: '⚠️', success: '✅', urgent: '🚨' };

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="margin:0;font-size:14px;">📢 Ankündigungen</h3>
        <button class="btn btn-sm btn-outline" onclick="AdminAudit.createAnnouncement()">+ Neue Ankündigung</button>
      </div>
      ${announcements.length ? announcements.map(a => `
        <div style="display:flex;gap:10px;padding:10px;background:var(--bg3);border-radius:10px;margin-bottom:8px;">
          <span style="font-size:18px;">${typeIcons[a.type] || 'ℹ️'}</span>
          <div style="flex:1;">
            <div style="font-weight:600;font-size:13px;">${clanaUtils.sanitizeHtml(a.title)}</div>
            <div style="font-size:12px;color:var(--tx3);margin-top:2px;">${clanaUtils.sanitizeHtml(a.message)}</div>
            <div style="font-size:10px;color:var(--tx3);margin-top:4px;">
              ${a.target_role ? `Zielgruppe: ${a.target_role}` : 'Alle Nutzer'} · ${new Date(a.created_at).toLocaleDateString('de-DE')}
            </div>
          </div>
          <button class="btn-icon" style="font-size:12px;" onclick="AdminAudit.deactivateAnnouncement('${a.id}')" title="Deaktivieren">×</button>
        </div>
      `).join('') : '<div style="color:var(--tx3);text-align:center;padding:16px;font-size:12px;">Keine aktiven Ankündigungen.</div>'}
    `;
  },

  async createAnnouncement() {
    const title = prompt('Titel der Ankündigung:');
    if (!title) return;
    const message = prompt('Nachricht:');
    if (!message) return;
    const type = prompt('Typ (info / warning / success / urgent):', 'info') || 'info';
    const targetRole = prompt('Zielgruppe (leer = alle, oder: customer / sales / superadmin):', '') || null;

    try {
      await supabaseClient.from('announcements').insert([{
        title, message, type, target_role: targetRole,
        created_by: (await clanaAuth.getUser())?.id,
        is_active: true
      }]);

      this.logAction('announcement_create', 'announcement', null, null, { title, type });
      Components.toast('Ankündigung erstellt!', 'success');
      this.renderAnnouncements(document.getElementById('admin-announcements'));
    } catch (e) {
      Components.toast('Fehler: ' + e.message, 'error');
    }
  },

  async deactivateAnnouncement(id) {
    if (!confirm('Ankündigung deaktivieren?')) return;
    try {
      await supabaseClient.from('announcements').update({ is_active: false }).eq('id', id);
      Components.toast('Deaktiviert', 'success');
      this.renderAnnouncements(document.getElementById('admin-announcements'));
    } catch (e) {
      Components.toast('Fehler', 'error');
    }
  }
};

window.AdminAudit = AdminAudit;
