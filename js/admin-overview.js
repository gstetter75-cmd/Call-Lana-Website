// ==========================================
// Admin Overview Enhancements:
// KPI Comparisons, Quick Actions, Health Scores, Leaderboard, Funnel, Export
// ==========================================

const AdminOverview = {

  // ==========================================
  // 1. KPI COMPARISON (vs. last month)
  // ==========================================

  renderKpiComparison(currentMRR, customers, allUsers) {
    const now = new Date();
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Last month's customers (registered before last month end, still active)
    const lastMonthCustomers = allUsers.filter(u =>
      u.role === 'customer' && u.is_active !== false &&
      new Date(u.created_at) <= lastMonthEnd
    );

    const lastMonthMRR = lastMonthCustomers.reduce((s, c) => {
      const plan = c.organizations?.plan || 'starter';
      return s + CONFIG.getPlanPrice(plan);
    }, 0);

    const lastMonthCount = lastMonthCustomers.length;
    const currentCount = customers.length;

    this.setDelta('ov-mrr', currentMRR, lastMonthMRR);
    this.setDelta('ov-active-customers', currentCount, lastMonthCount);
    this.setDelta('ov-arr', currentMRR * 12, lastMonthMRR * 12);

    const currentARPU = currentCount ? Math.round(currentMRR / currentCount) : 0;
    const lastARPU = lastMonthCount ? Math.round(lastMonthMRR / lastMonthCount) : 0;
    this.setDelta('ov-arpu', currentARPU, lastARPU);
  },

  setDelta(elementId, current, previous) {
    const el = document.getElementById(elementId);
    if (!el) return;

    // Remove existing delta
    const existingDelta = el.parentElement.querySelector('.kpi-delta');
    if (existingDelta) existingDelta.remove();

    if (previous === 0 && current === 0) return;

    const delta = previous > 0 ? Math.round(((current - previous) / previous) * 100) : (current > 0 ? 100 : 0);
    const isUp = delta >= 0;
    const color = isUp ? '#10b981' : '#ef4444';
    const arrow = isUp ? '↑' : '↓';

    const badge = document.createElement('div');
    badge.className = 'kpi-delta';
    badge.style.cssText = `font-size:11px;font-weight:600;color:${color};margin-top:4px;`;
    badge.textContent = `${arrow} ${Math.abs(delta)}% vs. Vormonat`;
    el.parentElement.appendChild(badge);
  },

  // ==========================================
  // 2. QUICK ACTIONS BAR
  // ==========================================

  renderQuickActions(container) {
    if (!container) return;
    container.innerHTML = `
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px;padding:12px 16px;background:var(--bg3);border-radius:12px;">
        <span style="font-size:12px;font-weight:600;color:var(--tx3);line-height:32px;margin-right:8px;">Schnellaktionen:</span>
        <button class="btn btn-sm btn-outline" onclick="switchTab('users');setTimeout(()=>openModal('modal-add-user'),300)">👤 Benutzer einladen</button>
        <button class="btn btn-sm btn-outline" onclick="switchTab('orgs');setTimeout(()=>openModal('modal-add-org'),300)">🏢 Organisation erstellen</button>
        <button class="btn btn-sm btn-outline" onclick="AdminOverview.exportAllData()">📥 Daten exportieren</button>
        <button class="btn btn-sm btn-outline" onclick="AdminAnalytics.generateMonthlyInvoices()">🧾 Rechnungen generieren</button>
        <button class="btn btn-sm btn-outline" onclick="switchTab('analytics')">📊 Analytics öffnen</button>
        <button class="btn btn-sm btn-outline" onclick="AdminPdfExport.generateMonthlyReport()">📄 PDF-Report</button>
      </div>
    `;
  },

  // ==========================================
  // 3. CUSTOMER HEALTH SCORES (aggregate)
  // ==========================================

  calculateHealthScore(user, calls) {
    let score = 0;

    // Last login (40 points)
    if (user.last_sign_in_at) {
      const days = (Date.now() - new Date(user.last_sign_in_at).getTime()) / 86400000;
      if (days < 3) score += 40;
      else if (days < 7) score += 35;
      else if (days < 14) score += 25;
      else if (days < 30) score += 15;
      else if (days < 60) score += 5;
    }

    // Call activity (30 points)
    const userCalls = calls.filter(c => c.user_id === user.id);
    const recentCalls = userCalls.filter(c => {
      const d = (Date.now() - new Date(c.created_at).getTime()) / 86400000;
      return d < 30;
    });
    if (recentCalls.length >= 20) score += 30;
    else if (recentCalls.length >= 10) score += 25;
    else if (recentCalls.length >= 5) score += 15;
    else if (recentCalls.length >= 1) score += 5;

    // Plan value (30 points)
    const plan = (user.organizations?.plan || 'starter').toLowerCase();
    if (plan === 'business') score += 30;
    else if (plan === 'professional' || plan === 'team') score += 20;
    else score += 10;

    return Math.min(score, 100);
  },

  renderHealthOverview(container, customers, calls) {
    if (!container) return;

    const scored = customers.map(c => ({
      ...c,
      healthScore: this.calculateHealthScore(c, calls),
      name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email
    }));

    const avg = scored.length ? Math.round(scored.reduce((s, c) => s + c.healthScore, 0) / scored.length) : 0;
    const healthy = scored.filter(c => c.healthScore >= 70).length;
    const warning = scored.filter(c => c.healthScore >= 40 && c.healthScore < 70).length;
    const critical = scored.filter(c => c.healthScore < 40).length;

    const atRisk = scored.filter(c => c.healthScore < 40).sort((a, b) => a.healthScore - b.healthScore).slice(0, 5);

    container.innerHTML = `
      <h3 style="margin:0 0 12px;font-size:14px;">Kunden-Gesundheit</h3>
      <div style="display:flex;gap:16px;margin-bottom:14px;">
        <div style="text-align:center;flex:1;padding:10px;background:var(--bg3);border-radius:10px;">
          <div style="font-size:24px;font-weight:700;color:${CONFIG.getHealthColor(avg)};">${avg}%</div>
          <div style="font-size:10px;color:var(--tx3);">Ø Score</div>
        </div>
        <div style="text-align:center;flex:1;padding:10px;background:#10b98112;border-radius:10px;">
          <div style="font-size:20px;font-weight:700;color:#10b981;">${healthy}</div>
          <div style="font-size:10px;color:var(--tx3);">Gesund</div>
        </div>
        <div style="text-align:center;flex:1;padding:10px;background:#f59e0b12;border-radius:10px;">
          <div style="font-size:20px;font-weight:700;color:#f59e0b;">${warning}</div>
          <div style="font-size:10px;color:var(--tx3);">Warnung</div>
        </div>
        <div style="text-align:center;flex:1;padding:10px;background:#ef444412;border-radius:10px;">
          <div style="font-size:20px;font-weight:700;color:#ef4444;">${critical}</div>
          <div style="font-size:10px;color:var(--tx3);">Kritisch</div>
        </div>
      </div>
      ${atRisk.length ? `
        <div style="font-size:12px;font-weight:600;margin-bottom:6px;color:var(--tx3);">Kritische Kunden:</div>
        ${atRisk.map(c => `
          <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px;">
            <span style="width:8px;height:8px;border-radius:50%;background:${CONFIG.getHealthColor(c.healthScore)};"></span>
            <span style="flex:1;">${clanaUtils.sanitizeHtml(c.name)}</span>
            <span style="font-weight:700;color:${CONFIG.getHealthColor(c.healthScore)};">${c.healthScore}%</span>
          </div>
        `).join('')}
      ` : '<div style="text-align:center;color:var(--tx3);font-size:12px;padding:10px;">Alle Kunden gesund!</div>'}
    `;
  },

  // ==========================================
  // 4. SALES LEADERBOARD WITH PERIOD FILTER
  // ==========================================

  renderLeaderboard(container, allUsers, allLeads) {
    if (!container) return;

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="margin:0;font-size:14px;">🏆 Sales Leaderboard</h3>
        <select class="form-input form-select" id="lb-period" style="width:140px;font-size:11px;" onchange="AdminOverview.updateLeaderboard()">
          <option value="30">Dieser Monat</option>
          <option value="90">Letzte 3 Monate</option>
          <option value="365">Dieses Jahr</option>
          <option value="0">Alle Zeit</option>
        </select>
      </div>
      <div id="lb-content"></div>
    `;

    this._lbUsers = allUsers;
    this._lbLeads = allLeads;
    this.updateLeaderboard();
  },

  updateLeaderboard() {
    const days = Number(document.getElementById('lb-period')?.value || 30);
    const cutoff = days > 0 ? new Date(Date.now() - days * 86400000) : new Date(0);

    const salesUsers = (this._lbUsers || []).filter(u => u.role === 'sales' || u.role === 'superadmin');
    const recentLeads = (this._lbLeads || []).filter(l => new Date(l.created_at) >= cutoff);

    const rankings = salesUsers.map(u => {
      const assigned = recentLeads.filter(l => l.assigned_to === u.id);
      const won = assigned.filter(l => l.status === 'won');
      const revenue = won.reduce((s, l) => s + (Number(l.value) || CONFIG.getPlanPrice('starter')), 0);
      return {
        name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
        leads: assigned.length,
        won: won.length,
        revenue
      };
    }).sort((a, b) => b.revenue - a.revenue);

    const medals = ['🥇', '🥈', '🥉'];
    const maxRev = Math.max(...rankings.map(r => r.revenue), 1);

    const content = document.getElementById('lb-content');
    if (!content) return;

    content.innerHTML = rankings.length ? rankings.map((r, i) => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;${i < rankings.length - 1 ? 'border-bottom:1px solid var(--border);' : ''}">
        <span style="font-size:${i < 3 ? '20px' : '14px'};width:28px;text-align:center;">${medals[i] || (i + 1) + '.'}</span>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:600;">${clanaUtils.sanitizeHtml(r.name)}</div>
          <div style="font-size:11px;color:var(--tx3);">${r.leads} Leads · ${r.won} Won · ${r.revenue.toLocaleString('de-DE')} €</div>
        </div>
        <div style="width:80px;height:6px;background:var(--bg3);border-radius:3px;overflow:hidden;">
          <div style="width:${Math.round((r.revenue / maxRev) * 100)}%;height:100%;background:${i === 0 ? '#10b981' : 'var(--pu)'};border-radius:3px;"></div>
        </div>
      </div>
    `).join('') : '<div style="text-align:center;color:var(--tx3);font-size:12px;padding:20px;">Keine Sales-Daten.</div>';
  },

  // ==========================================
  // 5. CUSTOMER JOURNEY FUNNEL
  // ==========================================

  renderCustomerFunnel(container, leads, customers) {
    if (!container) return;

    const stages = [
      { key: 'total_leads', label: 'Leads gesamt', count: leads.length, color: '#7c3aed' },
      { key: 'qualified', label: 'Qualifiziert', count: leads.filter(l => ['qualified', 'proposal', 'won'].includes(l.status)).length, color: '#8b5cf6' },
      { key: 'proposal', label: 'Angebot', count: leads.filter(l => ['proposal', 'won'].includes(l.status)).length, color: '#a78bfa' },
      { key: 'won', label: 'Gewonnen', count: leads.filter(l => l.status === 'won').length, color: '#10b981' },
      { key: 'active', label: 'Aktive Kunden', count: customers.filter(c => c.status === 'active').length, color: '#06b6d4' },
      { key: 'churned', label: 'Abgewandert', count: customers.filter(c => c.status === 'churned').length, color: '#ef4444' }
    ];

    const maxCount = Math.max(...stages.map(s => s.count), 1);

    container.innerHTML = `
      <h3 style="margin:0 0 14px;font-size:14px;">Customer Journey</h3>
      <div style="display:flex;flex-direction:column;gap:6px;">
        ${stages.map((s, i) => {
          const widthPct = Math.max(Math.round((s.count / maxCount) * 100), 8);
          return `<div style="display:flex;align-items:center;gap:10px;">
            <span style="width:100px;font-size:11px;color:var(--tx3);text-align:right;">${s.label}</span>
            <div style="flex:1;height:28px;position:relative;">
              <div style="width:${widthPct}%;height:100%;background:${s.color}22;border-radius:6px;border-left:3px solid ${s.color};display:flex;align-items:center;padding-left:8px;">
                <span style="font-size:12px;font-weight:700;color:${s.color};">${s.count}</span>
              </div>
            </div>
            ${i < stages.length - 1 && stages[i + 1].count > 0 ? `<span style="font-size:10px;color:var(--tx3);">${Math.round((stages[i + 1].count / Math.max(s.count, 1)) * 100)}%</span>` : '<span style="width:30px;"></span>'}
          </div>`;
        }).join('')}
      </div>
    `;
  },

  // ==========================================
  // 7. GENERALIZED CSV EXPORT
  // ==========================================

  exportAllData() {
    const sections = ['Kunden', 'Benutzer', 'Organisationen'];
    const choice = prompt(`Was exportieren?\n1 = Kunden\n2 = Benutzer\n3 = Organisationen\n\nNummer eingeben:`);

    if (choice === '1') { if (typeof exportCustomersCSV === 'function') exportCustomersCSV(); else Components.toast('Kunden-Tab zuerst öffnen', 'info'); }
    else if (choice === '2') this.exportUsersCSV();
    else if (choice === '3') this.exportOrgsCSV();
  },

  exportUsersCSV() {
    const tbody = document.getElementById('users-tbody');
    if (!tbody || !tbody.rows.length) { Components.toast('Keine Benutzer-Daten', 'info'); return; }

    const BOM = '\uFEFF';
    let csv = 'Name,E-Mail,Rolle,Organisation,Status,Erstellt\n';
    Array.from(tbody.rows).forEach(row => {
      const cells = Array.from(row.cells).slice(0, 6);
      csv += cells.map(td => '"' + (td.textContent || '').replace(/"/g, '""').trim() + '"').join(',') + '\n';
    });

    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `benutzer_export_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    Components.toast('Benutzer exportiert', 'success');
  },

  exportOrgsCSV() {
    const tbody = document.getElementById('orgs-tbody');
    if (!tbody || !tbody.rows.length) { Components.toast('Keine Org-Daten', 'info'); return; }

    const BOM = '\uFEFF';
    let csv = 'Name,Plan,Inhaber,Mitglieder,Status,Erstellt\n';
    Array.from(tbody.rows).forEach(row => {
      const cells = Array.from(row.cells).slice(0, 6);
      csv += cells.map(td => '"' + (td.textContent || '').replace(/"/g, '""').trim() + '"').join(',') + '\n';
    });

    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `organisationen_export_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    Components.toast('Organisationen exportiert', 'success');
  }
};

window.AdminOverview = AdminOverview;
