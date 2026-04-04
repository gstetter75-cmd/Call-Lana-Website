// ==========================================
// Admin Analytics: Revenue Forecast, Cohorts, Churn Warning, Webhooks
// Depends on: db.js, config.js, dashboard-components.js
// ==========================================

const AdminAnalytics = {

  // ==========================================
  // REVENUE FORECASTING
  // ==========================================

  async renderRevenueForecast(container) {
    if (!container) return;

    const [custRes, leadsRes] = await Promise.all([
      clanaDB.getCustomers ? clanaDB.getCustomers({}) : { success: false },
      clanaDB.getLeads ? clanaDB.getLeads({}) : { success: false }
    ]);

    const customers = (custRes.data || []).filter(c => c.status === 'active');
    const leads = leadsRes.data || [];

    // Current MRR from active customers
    const currentMRR = customers.reduce((s, c) => s + CONFIG.getPlanPrice(c.plan), 0);

    // Pipeline value and conversion rate
    const wonLeads = leads.filter(l => l.status === 'won');
    const totalLeads = leads.filter(l => l.status !== 'lost').length;
    const convRate = totalLeads > 0 ? wonLeads.length / totalLeads : 0.15;

    const activeLeads = leads.filter(l => !['won', 'lost'].includes(l.status));
    const pipelineValue = activeLeads.reduce((s, l) => s + (Number(l.value) || 0), 0);
    const avgDealValue = wonLeads.length ? wonLeads.reduce((s, l) => s + (Number(l.value) || CONFIG.getPlanPrice('starter')), 0) / wonLeads.length : CONFIG.getPlanPrice('starter');

    // Forecast: expected new MRR per month from pipeline
    const expectedNewDeals = Math.round(activeLeads.length * convRate);
    const expectedNewMRR = Math.round(expectedNewDeals * avgDealValue / 12);

    // 6-month forecast
    const months = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const m = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const projected = currentMRR + (expectedNewMRR * (i + 1));
      months.push({ label: m.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' }), value: projected, isForecast: i > 0 });
    }

    const maxVal = Math.max(...months.map(m => m.value), 1);

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="margin:0;font-size:14px;">MRR-Prognose</h3>
        <div style="font-size:12px;color:var(--tx3);">Conversion-Rate: ${Math.round(convRate * 100)}% | Pipeline: ${activeLeads.length} Leads</div>
      </div>
      <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px;">
        <div class="stat-card"><div class="stat-label">AKTUELL MRR</div><div class="stat-value">${currentMRR.toLocaleString('de-DE')} €</div></div>
        <div class="stat-card"><div class="stat-label">PROGNOSE +3M</div><div class="stat-value" style="color:#10b981;">${months[3]?.value.toLocaleString('de-DE')} €</div></div>
        <div class="stat-card"><div class="stat-label">ERW. NEUE DEALS</div><div class="stat-value">${expectedNewDeals}</div></div>
      </div>
      <div style="display:flex;align-items:end;gap:8px;height:140px;padding:0 4px;">
        ${months.map(m => {
          const h = Math.round((m.value / maxVal) * 120);
          return `<div style="flex:1;text-align:center;">
            <div style="font-size:10px;font-weight:700;color:var(--tx);margin-bottom:4px;">${m.value.toLocaleString('de-DE')}€</div>
            <div style="height:${h}px;background:${m.isForecast ? 'rgba(124,58,237,0.3)' : 'var(--pu)'};border-radius:6px 6px 0 0;${m.isForecast ? 'border:1px dashed var(--pu);' : ''}"></div>
            <div style="font-size:10px;color:var(--tx3);margin-top:4px;">${m.label}</div>
          </div>`;
        }).join('')}
      </div>
      <div style="display:flex;gap:12px;margin-top:8px;font-size:10px;color:var(--tx3);">
        <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--pu);vertical-align:middle;margin-right:3px;"></span>Aktuell</span>
        <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:rgba(124,58,237,0.3);border:1px dashed var(--pu);vertical-align:middle;margin-right:3px;"></span>Prognose</span>
      </div>
    `;
  },

  // ==========================================
  // CUSTOMER COHORT ANALYSIS
  // ==========================================

  async renderCohortAnalysis(container) {
    if (!container) return;

    const result = await clanaDB.getAllProfiles();
    const users = (result.data || []).filter(u => u.role === 'customer');

    if (users.length < 3) {
      container.innerHTML = '<div style="color:var(--tx3);text-align:center;padding:30px;font-size:13px;">Mindestens 3 Kunden nötig für Kohortenanalyse.</div>';
      return;
    }

    // Group by registration month
    const cohorts = {};
    const now = new Date();
    const monthsBack = 6;

    users.forEach(u => {
      if (!u.created_at) return;
      const d = new Date(u.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!cohorts[key]) cohorts[key] = [];
      cohorts[key].push(u);
    });

    const sortedKeys = Object.keys(cohorts).sort().slice(-monthsBack);

    container.innerHTML = `
      <div style="margin-bottom:12px;"><h3 style="margin:0;font-size:14px;">Kunden-Kohortenanalyse</h3></div>
      <div style="overflow-x:auto;">
        <table class="data-table" style="margin:0;font-size:11px;">
          <thead><tr>
            <th>Kohorte</th>
            <th>Registriert</th>
            ${Array.from({ length: 6 }, (_, i) => `<th style="text-align:center;">Monat ${i}</th>`).join('')}
          </tr></thead>
          <tbody>${sortedKeys.map(key => {
            const cohort = cohorts[key];
            const cohortDate = new Date(key + '-01');
            const total = cohort.length;

            const retention = Array.from({ length: 6 }, (_, monthIdx) => {
              const checkDate = new Date(cohortDate.getFullYear(), cohortDate.getMonth() + monthIdx + 1, 0);
              if (checkDate > now) return null;
              const active = cohort.filter(u => u.is_active !== false).length;
              const pct = Math.round((active / total) * 100);
              return pct;
            });

            return `<tr>
              <td style="font-weight:600;">${cohortDate.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' })}</td>
              <td>${total}</td>
              ${retention.map(pct => {
                if (pct === null) return '<td style="text-align:center;color:var(--tx3);">—</td>';
                const intensity = pct / 100;
                const bg = `rgba(16,185,129,${0.1 + intensity * 0.4})`;
                return `<td style="text-align:center;background:${bg};font-weight:600;color:${pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444'}">${pct}%</td>`;
              }).join('')}
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>
    `;
  },

  // ==========================================
  // CHURN WARNING
  // ==========================================

  async renderChurnWarnings(container) {
    if (!container) return;

    const result = await clanaDB.getAllProfiles();
    const users = (result.data || []).filter(u => u.role === 'customer' && u.is_active !== false);

    const now = Date.now();
    const thirtyDays = 30 * 86400000;
    const fourteenDays = 14 * 86400000;

    const atRisk = users.filter(u => {
      const lastLogin = u.last_sign_in_at ? new Date(u.last_sign_in_at).getTime() : 0;
      const daysSinceLogin = (now - lastLogin) / 86400000;
      return daysSinceLogin > 30;
    }).map(u => ({
      ...u,
      daysSinceLogin: u.last_sign_in_at ? Math.round((now - new Date(u.last_sign_in_at).getTime()) / 86400000) : 999,
      name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email
    })).sort((a, b) => b.daysSinceLogin - a.daysSinceLogin);

    if (!atRisk.length) {
      container.innerHTML = `<div style="text-align:center;padding:20px;">
        <span style="font-size:28px;">✅</span>
        <div style="font-size:13px;color:var(--tx3);margin-top:8px;">Keine gefährdeten Kunden. Alle waren in den letzten 30 Tagen aktiv.</div>
      </div>`;
      return;
    }

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="margin:0;font-size:14px;">⚠️ Churn-Risiko (${atRisk.length})</h3>
        <span style="font-size:11px;color:var(--tx3);">Kunden ohne Login seit >30 Tagen</span>
      </div>
      <table class="data-table" style="margin:0;">
        <thead><tr><th>Kunde</th><th>E-Mail</th><th>Letzter Login</th><th>Tage inaktiv</th><th>Risiko</th></tr></thead>
        <tbody>${atRisk.slice(0, 10).map(u => {
          const risk = u.daysSinceLogin > 60 ? 'Hoch' : 'Mittel';
          const riskColor = u.daysSinceLogin > 60 ? '#ef4444' : '#f59e0b';
          return `<tr>
            <td><strong>${clanaUtils.sanitizeHtml(u.name)}</strong></td>
            <td style="font-size:12px;">${clanaUtils.sanitizeHtml(u.email || '—')}</td>
            <td style="font-size:12px;">${u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString('de-DE') : 'Nie'}</td>
            <td style="font-weight:700;color:${riskColor};">${u.daysSinceLogin === 999 ? '—' : u.daysSinceLogin + 'd'}</td>
            <td><span class="badge" style="background:${riskColor}22;color:${riskColor}">${risk}</span></td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    `;
  },

  // ==========================================
  // WEBHOOK MANAGEMENT
  // ==========================================

  async renderWebhookConfig(container) {
    if (!container) return;

    let webhooks = [];
    try {
      const { data } = await supabaseClient.from('webhook_configs').select('*').order('created_at');
      webhooks = data || [];
    } catch (e) { /* table may not exist */ }

    const eventTypes = [
      { key: 'lead.created', label: 'Neuer Lead' },
      { key: 'deal.won', label: 'Deal gewonnen' },
      { key: 'customer.created', label: 'Neuer Kunde' },
      { key: 'customer.churned', label: 'Kunde abgewandert' },
      { key: 'invoice.created', label: 'Rechnung erstellt' }
    ];

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="margin:0;font-size:14px;">Webhooks & Benachrichtigungen</h3>
        <button class="btn btn-sm" onclick="AdminAnalytics.addWebhook()">+ Webhook</button>
      </div>
      <p style="font-size:12px;color:var(--tx3);margin-bottom:12px;">Erhalte Benachrichtigungen bei wichtigen Ereignissen via Slack, Teams oder eigene Endpoints.</p>
      ${webhooks.length ? `<table class="data-table" style="margin:0;">
        <thead><tr><th>Event</th><th>URL</th><th>Aktiv</th><th></th></tr></thead>
        <tbody>${webhooks.map(w => `<tr>
          <td>${(eventTypes.find(e => e.key === w.event_type) || {}).label || clanaUtils.sanitizeHtml(w.event_type)}</td>
          <td style="font-size:11px;max-width:250px;overflow:hidden;text-overflow:ellipsis;">${clanaUtils.sanitizeHtml(w.url)}</td>
          <td><span class="badge ${w.is_active ? 'badge-green' : 'badge-red'}">${w.is_active ? 'Aktiv' : 'Inaktiv'}</span></td>
          <td><button class="btn btn-sm btn-danger" onclick="AdminAnalytics.deleteWebhook('${w.id}')">×</button></td>
        </tr>`).join('')}</tbody>
      </table>` : '<div style="color:var(--tx3);text-align:center;padding:20px;font-size:13px;">Keine Webhooks konfiguriert.</div>'}
    `;
  },

  async addWebhook() {
    const url = prompt('Webhook URL (z.B. Slack Incoming Webhook):');
    if (!url) return;
    const event = prompt('Event-Typ (lead.created, deal.won, customer.created, customer.churned, invoice.created):');
    if (!event) return;

    try {
      await supabaseClient.from('webhook_configs').insert([{ event_type: event, url, is_active: true }]);
      Components.toast('Webhook erstellt', 'success');
      this.renderWebhookConfig(document.getElementById('admin-webhooks'));
    } catch (e) {
      Components.toast('Fehler: ' + e.message, 'error');
    }
  },

  async deleteWebhook(id) {
    if (!confirm('Webhook löschen?')) return;
    try {
      await supabaseClient.from('webhook_configs').delete().eq('id', id);
      Components.toast('Webhook gelöscht', 'success');
      this.renderWebhookConfig(document.getElementById('admin-webhooks'));
    } catch (e) {
      Components.toast('Fehler: ' + e.message, 'error');
    }
  },

  // ==========================================
  // AUTO INVOICE GENERATION (client-side trigger)
  // ==========================================

  async generateMonthlyInvoices() {
    if (!confirm('Monatliche Rechnungen für alle aktiven Kunden generieren?')) return;

    const custRes = await clanaDB.getCustomers ? await clanaDB.getCustomers({}) : { success: false, data: [] };
    const customers = (custRes.data || []).filter(c => c.status === 'active');

    if (!customers.length) { Components.toast('Keine aktiven Kunden gefunden', 'info'); return; }

    const now = new Date();
    const monthStr = now.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    let created = 0;

    for (const c of customers) {
      const price = CONFIG.getPlanPrice(c.plan);
      const netPrice = price;
      const tax = Math.round(price * 0.19 * 100) / 100;
      const gross = netPrice + tax;

      try {
        await supabaseClient.from('invoices').insert([{
          organization_id: c.organization_id,
          invoice_number: `CL-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(created + 1).padStart(4, '0')}`,
          invoice_date: now.toISOString().split('T')[0],
          period_start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
          period_end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0],
          net_amount: netPrice * 100,
          tax_amount: Math.round(tax * 100),
          gross_amount: Math.round(gross * 100),
          status: 'issued'
        }]);
        created++;
      } catch (e) {
        Logger.error('generateInvoice', e);
      }
    }

    Components.toast(`${created} Rechnungen für ${monthStr} erstellt`, 'success');
  }
};

window.AdminAnalytics = AdminAnalytics;
