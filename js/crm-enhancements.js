// ==========================================
// CRM Enhancements: Deal Forecast, Mass Actions, Follow-up Reminders
// Depends on: db.js, config.js, sales-customers.js
// ==========================================

const CRMEnhancements = {

  // ==========================================
  // DEAL FORECAST (weighted pipeline value)
  // ==========================================

  STAGE_PROBABILITIES: {
    new: 0.10,
    contacted: 0.25,
    qualified: 0.50,
    proposal: 0.75,
    won: 1.0,
    lost: 0
  },

  calculateWeightedPipeline(leads) {
    let totalWeighted = 0;
    let totalUnweighted = 0;

    leads.forEach(l => {
      if (l.status === 'won' || l.status === 'lost') return;
      const value = Number(l.value) || 0;
      const prob = this.STAGE_PROBABILITIES[l.status] || 0.1;
      totalWeighted += value * prob;
      totalUnweighted += value;
    });

    return { weighted: Math.round(totalWeighted), unweighted: Math.round(totalUnweighted) };
  },

  renderForecastWidget(container, leads) {
    if (!container) return;
    const { weighted, unweighted } = this.calculateWeightedPipeline(leads);
    const active = leads.filter(l => !['won', 'lost'].includes(l.status));

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <h3 style="margin:0;font-size:13px;">Deal-Forecast</h3>
        <span style="font-size:10px;color:var(--tx3);">${active.length} aktive Deals</span>
      </div>
      <div style="display:flex;gap:12px;">
        <div style="flex:1;padding:10px;background:var(--bg3);border-radius:8px;text-align:center;">
          <div style="font-size:18px;font-weight:700;color:var(--pu);">${weighted.toLocaleString('de-DE')} €</div>
          <div style="font-size:10px;color:var(--tx3);">Gewichtet</div>
        </div>
        <div style="flex:1;padding:10px;background:var(--bg3);border-radius:8px;text-align:center;">
          <div style="font-size:18px;font-weight:700;color:var(--tx2);">${unweighted.toLocaleString('de-DE')} €</div>
          <div style="font-size:10px;color:var(--tx3);">Ungewichtet</div>
        </div>
      </div>
      <div style="margin-top:8px;font-size:10px;color:var(--tx3);">
        ${Object.entries(this.STAGE_PROBABILITIES).filter(([k]) => k !== 'won' && k !== 'lost').map(([k, v]) =>
          `<span style="margin-right:8px;">${k}: ${Math.round(v * 100)}%</span>`
        ).join('')}
      </div>
    `;
  },

  // ==========================================
  // MASS ACTIONS (multi-select leads)
  // ==========================================

  selectedLeadIds: new Set(),

  initMassActions() {
    // Add select-all checkbox to leads table header
    const th = document.querySelector('#leads-tbody')?.closest('table')?.querySelector('thead tr');
    if (th && !th.querySelector('.mass-select-all')) {
      const checkTh = document.createElement('th');
      checkTh.style.width = '30px';
      checkTh.innerHTML = '<input type="checkbox" class="mass-select-all" onchange="CRMEnhancements.toggleSelectAll(this.checked)">';
      th.insertBefore(checkTh, th.firstChild);
    }
  },

  addCheckboxToRow(row, leadId) {
    if (row.querySelector('.mass-select-cb')) return;
    const td = document.createElement('td');
    td.innerHTML = `<input type="checkbox" class="mass-select-cb" data-lead-id="${leadId}" onchange="CRMEnhancements.toggleSelect('${leadId}', this.checked)" onclick="event.stopPropagation()">`;
    row.insertBefore(td, row.firstChild);
  },

  toggleSelectAll(checked) {
    document.querySelectorAll('.mass-select-cb').forEach(cb => {
      cb.checked = checked;
      const id = cb.dataset.leadId;
      if (checked) this.selectedLeadIds.add(id);
      else this.selectedLeadIds.delete(id);
    });
    this.updateMassActionBar();
  },

  toggleSelect(id, checked) {
    if (checked) this.selectedLeadIds.add(id);
    else this.selectedLeadIds.delete(id);
    this.updateMassActionBar();
  },

  updateMassActionBar() {
    let bar = document.getElementById('mass-action-bar');
    const count = this.selectedLeadIds.size;

    if (count === 0) {
      if (bar) bar.style.display = 'none';
      return;
    }

    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'mass-action-bar';
      bar.style.cssText = 'position:fixed;bottom:0;left:var(--sidebar-w,240px);right:0;background:var(--bg2);border-top:2px solid var(--pu);padding:12px 24px;display:flex;align-items:center;justify-content:space-between;z-index:100;box-shadow:0 -4px 12px rgba(0,0,0,.2);';
      document.body.appendChild(bar);
    }

    bar.style.display = 'flex';
    bar.innerHTML = `
      <span style="font-weight:700;font-size:13px;">${count} Lead${count > 1 ? 's' : ''} ausgewählt</span>
      <div style="display:flex;gap:8px;">
        <select id="mass-status-select" class="form-input form-select" style="width:150px;font-size:12px;">
          <option value="">Status ändern…</option>
          <option value="contacted">Kontaktiert</option>
          <option value="qualified">Qualifiziert</option>
          <option value="proposal">Angebot</option>
          <option value="won">Gewonnen</option>
          <option value="lost">Verloren</option>
        </select>
        <button class="btn btn-sm" onclick="CRMEnhancements.applyMassStatus()">Anwenden</button>
        <button class="btn btn-sm btn-outline" onclick="CRMEnhancements.clearSelection()">Abbrechen</button>
      </div>
    `;
  },

  async applyMassStatus() {
    const status = document.getElementById('mass-status-select')?.value;
    if (!status) { Components.toast('Bitte Status wählen', 'error'); return; }

    const results = await Promise.all(
      [...this.selectedLeadIds].map(id => clanaDB.updateLead(id, { status }))
    );
    const updated = results.filter(r => r.success).length;

    Components.toast(`${updated} Lead(s) auf "${status}" gesetzt`, 'success');
    this.clearSelection();
    if (typeof loadLeads === 'function') loadLeads();
  },

  clearSelection() {
    this.selectedLeadIds.clear();
    document.querySelectorAll('.mass-select-cb, .mass-select-all').forEach(cb => cb.checked = false);
    this.updateMassActionBar();
  },

  // ==========================================
  // FOLLOW-UP REMINDER BANNER
  // ==========================================

  renderFollowUpBanner(container, leads) {
    if (!container) return;
    const now = Date.now();
    const stale = leads.filter(l => {
      if (['won', 'lost'].includes(l.status)) return false;
      const days = (now - new Date(l.updated_at || l.created_at).getTime()) / 86400000;
      return days >= 7;
    }).sort((a, b) => new Date(a.updated_at || a.created_at) - new Date(b.updated_at || b.created_at));

    if (!stale.length) { container.innerHTML = ''; return; }

    container.innerHTML = `
      <div style="background:#f59e0b15;border:1px solid #f59e0b33;border-radius:10px;padding:12px 16px;margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <span style="font-size:16px;">⏰</span>
          <span style="font-size:13px;font-weight:700;color:#f59e0b;">Follow-up fällig (${stale.length})</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${stale.slice(0, 5).map(l => {
            const days = Math.floor((now - new Date(l.updated_at || l.created_at).getTime()) / 86400000);
            return `<span style="padding:4px 10px;background:var(--bg2);border-radius:6px;font-size:11px;cursor:pointer;" onclick="viewLead('${l.id}')">${clanaUtils.sanitizeHtml(l.company_name)} <strong style="color:#f59e0b;">(${days}d)</strong></span>`;
          }).join('')}
          ${stale.length > 5 ? `<span style="padding:4px 10px;font-size:11px;color:var(--tx3);">+${stale.length - 5} weitere</span>` : ''}
        </div>
      </div>
    `;
  }
};

window.CRMEnhancements = CRMEnhancements;
