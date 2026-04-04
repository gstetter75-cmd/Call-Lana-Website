// ==========================================
// CRM: Customer Management Module
// Depends on: db.js (clanaDB), config.js (CONFIG), dashboard-components.js (Components)
// ==========================================

let allCustomers = [];
let allCustomerTags = [];
let currentCustomerDetailId = null;
let customersLoaded = false;

// ==========================================
// LOAD & RENDER
// ==========================================

async function loadCustomers() {
  try {
    const result = await clanaDB.getCustomers({ assigned_to: currentProfile.id });
    if (!result.success) throw new Error(result.error);
    allCustomers = result.data || [];
  } catch (e) {
    allCustomers = [];
    // Silently fail if table doesn't exist yet (404)
  }
  renderCustomersTable();
  updateCustomerStats();
  customersLoaded = true;
}

async function loadCustomerTags() {
  try {
    const result = await clanaDB.getCustomerTags();
    if (result.success) allCustomerTags = result.data || [];
  } catch (e) {
    allCustomerTags = [];
  }
}

function updateCustomerStats() {
  const active = allCustomers.filter(c => c.status === 'active');
  const avgHealth = active.length ? Math.round(active.reduce((s, c) => s + (c.health_score || 50), 0) / active.length) : 0;
  const monthlyRev = active.reduce((s, c) => s + CONFIG.getPlanPrice(c.plan), 0);

  document.getElementById('cust-stat-total').textContent = allCustomers.length;
  document.getElementById('cust-stat-active').textContent = active.length;
  document.getElementById('cust-stat-health').textContent = avgHealth + '%';
  document.getElementById('cust-stat-revenue').textContent = monthlyRev.toLocaleString('de-DE') + ' €';
}

function renderCustomersTable() {
  const tbody = document.getElementById('customers-tbody');
  if (!tbody) return;

  const search = (document.getElementById('cust-search')?.value || '').toLowerCase();
  const statusFilter = document.getElementById('cust-status-filter')?.value || '';

  let filtered = allCustomers;
  if (search) {
    filtered = filtered.filter(c =>
      (c.company_name || '').toLowerCase().includes(search) ||
      (c.contact_name || '').toLowerCase().includes(search) ||
      (c.email || '').toLowerCase().includes(search)
    );
  }
  if (statusFilter) filtered = filtered.filter(c => c.status === statusFilter);

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--tx3);padding:40px;">Keine Kunden gefunden. Konvertiere Leads oder erstelle einen neuen Kunden.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(c => {
    const statusCfg = CONFIG.CUSTOMER_STATUSES[c.status] || CONFIG.CUSTOMER_STATUSES.active;
    const healthColor = CONFIG.getHealthColor(c.health_score || 0);
    const tags = (c.customer_tag_assignments || []).map(a => a.customer_tags).filter(Boolean);
    const tagHtml = tags.map(t => `<span class="tag-chip" style="background:${t.color}22;color:${t.color}">${clanaUtils.sanitizeHtml(t.name)}</span>`).join(' ');
    const lastContact = c.last_contact_at ? new Date(c.last_contact_at).toLocaleDateString('de-DE') : '—';

    return `<tr onclick="viewCustomer('${c.id}')" style="cursor:pointer;">
      <td><strong>${clanaUtils.sanitizeHtml(c.company_name)}</strong><br><span style="font-size:11px;color:var(--tx3);">${clanaUtils.sanitizeHtml(c.contact_name || '')}</span></td>
      <td>${c.email ? `<a href="${clanaUtils.safeMailHref(c.email)}" onclick="event.stopPropagation()" style="color:var(--cyan);text-decoration:none;font-size:12px;">${clanaUtils.sanitizeHtml(c.email)}</a>` : '—'}</td>
      <td><span class="badge badge-purple">${CONFIG.getPlanLabel(c.plan)}</span></td>
      <td><span class="badge" style="background:${statusCfg.color}22;color:${statusCfg.color}">${statusCfg.label}</span></td>
      <td><span style="display:inline-flex;align-items:center;gap:6px;"><span style="width:8px;height:8px;border-radius:50%;background:${healthColor};"></span>${c.health_score || 0}%</span></td>
      <td style="font-size:12px;">${lastContact}</td>
      <td>${tagHtml || '—'}</td>
      <td><button class="btn-icon" onclick="event.stopPropagation();viewCustomer('${c.id}')">→</button></td>
    </tr>`;
  }).join('');
}

// ==========================================
// CUSTOMER DETAIL
// ==========================================

async function viewCustomer(id) {
  currentCustomerDetailId = id;
  const result = await clanaDB.getCustomer(id);
  if (!result.success) { Components.toast('Kunde nicht gefunden', 'error'); return; }
  const c = result.data;

  const statusCfg = CONFIG.CUSTOMER_STATUSES[c.status] || CONFIG.CUSTOMER_STATUSES.active;
  const healthColor = CONFIG.getHealthColor(c.health_score || 0);

  document.getElementById('cust-detail-content').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
      <div>
        <h3 style="margin:0;font-size:20px;">${clanaUtils.sanitizeHtml(c.company_name)}</h3>
        <span style="font-size:13px;color:var(--tx3);">${clanaUtils.sanitizeHtml(c.contact_name || '')}</span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <span class="badge" style="background:${statusCfg.color}22;color:${statusCfg.color}">${statusCfg.label}</span>
        <span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:8px;background:${healthColor}15;color:${healthColor};font-weight:700;font-size:13px;">
          <span style="width:8px;height:8px;border-radius:50%;background:${healthColor};"></span>${c.health_score || 0}%
        </span>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px;">
      <div style="font-size:12px;"><span style="color:var(--tx3);display:block;">E-Mail</span>${c.email ? `<a href="${clanaUtils.safeMailHref(c.email)}" style="color:var(--cyan);">${clanaUtils.sanitizeHtml(c.email)}</a>` : '—'}</div>
      <div style="font-size:12px;"><span style="color:var(--tx3);display:block;">Telefon</span>${c.phone ? `<a href="${clanaUtils.safeTelHref(c.phone)}" style="color:var(--cyan);">${clanaUtils.sanitizeHtml(c.phone)}</a>` : '—'}</div>
      <div style="font-size:12px;"><span style="color:var(--tx3);display:block;">Branche</span>${CONFIG.getIndustryLabel(c.industry)}</div>
      <div style="font-size:12px;"><span style="color:var(--tx3);display:block;">Plan</span><span class="badge badge-purple">${CONFIG.getPlanLabel(c.plan)}</span></div>
      <div style="font-size:12px;"><span style="color:var(--tx3);display:block;">Kunde seit</span>${c.customer_since ? new Date(c.customer_since).toLocaleDateString('de-DE') : '—'}</div>
      <div style="font-size:12px;"><span style="color:var(--tx3);display:block;">Letzter Kontakt</span>${c.last_contact_at ? new Date(c.last_contact_at).toLocaleDateString('de-DE') : '—'}</div>
    </div>

    <div style="display:flex;gap:8px;margin-bottom:20px;">
      ${c.phone ? `<a href="${clanaUtils.safeTelHref(c.phone)}" class="btn btn-outline" style="font-size:12px;padding:6px 14px;">📞 Anrufen</a>` : ''}
      ${c.email ? `<a href="${clanaUtils.safeMailHref(c.email)}" class="btn btn-outline" style="font-size:12px;padding:6px 14px;">✉️ E-Mail</a>` : ''}
      <button class="btn btn-outline" style="font-size:12px;padding:6px 14px;" onclick="openCallProtocolModal('${c.id}')">📝 Anruf protokollieren</button>
      <button class="btn btn-outline" style="font-size:12px;padding:6px 14px;" onclick="editCustomer('${c.id}')">✏️ Bearbeiten</button>
    </div>

    <div style="border-top:1px solid var(--border);padding-top:16px;">
      <div style="display:flex;gap:8px;margin-bottom:12px;">
        <button class="tab-btn active" onclick="switchCustDetailTab('protocols', this)">Anrufprotokolle</button>
        <button class="tab-btn" onclick="switchCustDetailTab('activities', this)">Aktivitäten</button>
        <button class="tab-btn" onclick="switchCustDetailTab('notes', this)">Notizen</button>
      </div>
      <div id="cust-detail-tab-content"></div>
    </div>
  `;

  openModal('modal-customer-detail');
  loadCallProtocols(id);
}

function switchCustDetailTab(tab, btn) {
  if (btn) {
    btn.closest('div').querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
  const id = currentCustomerDetailId;
  if (tab === 'protocols') loadCallProtocols(id);
  else if (tab === 'activities') loadCustomerActivities(id);
  else if (tab === 'notes') loadCustomerNotes(id);
}

async function loadCallProtocols(customerId) {
  const container = document.getElementById('cust-detail-tab-content');
  container.innerHTML = '<div style="color:var(--tx3);padding:20px;text-align:center;">Laden...</div>';

  const result = await clanaDB.getCallProtocols(customerId);
  const protocols = result.success ? result.data : [];

  if (!protocols.length) {
    container.innerHTML = '<div style="color:var(--tx3);padding:20px;text-align:center;">Noch keine Anrufprotokolle. <a href="#" onclick="openCallProtocolModal(\'' + customerId + '\');return false;" style="color:var(--cyan);">Erstes Protokoll erstellen</a></div>';
    return;
  }

  container.innerHTML = `<table class="data-table" style="margin:0;">
    <thead><tr><th>Datum</th><th>Richtung</th><th>Ergebnis</th><th>Dauer</th><th>Betreff</th><th>Notizen</th></tr></thead>
    <tbody>${protocols.map(p => {
      const dir = CONFIG.CALL_DIRECTIONS[p.direction] || CONFIG.CALL_DIRECTIONS.outbound;
      const outcome = CONFIG.CALL_OUTCOMES[p.outcome] || { label: p.outcome };
      const dur = p.duration_seconds ? Math.round(p.duration_seconds / 60) + ' Min.' : '—';
      return `<tr>
        <td style="font-size:12px;">${new Date(p.called_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
        <td>${dir.icon} ${dir.label}</td>
        <td>${outcome.label}</td>
        <td>${dur}</td>
        <td>${clanaUtils.sanitizeHtml(p.subject || '—')}</td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${clanaUtils.sanitizeHtml(p.notes || '—')}</td>
      </tr>`;
    }).join('')}</tbody>
  </table>`;
}

async function loadCustomerActivities(customerId) {
  const container = document.getElementById('cust-detail-tab-content');
  container.innerHTML = '<div style="color:var(--tx3);padding:20px;text-align:center;">Laden...</div>';

  const result = await clanaDB.getCustomerActivities(customerId);
  const activities = result.success ? result.data : [];

  if (!activities.length) {
    container.innerHTML = '<div style="color:var(--tx3);padding:20px;text-align:center;">Keine Aktivitäten vorhanden.</div>';
    return;
  }

  const typeIcons = { call: '📞', note: '📝', created: '🆕', status_change: '🔄', plan_change: '💎', tag_added: '🏷️', tag_removed: '🏷️' };

  container.innerHTML = '<div style="display:flex;flex-direction:column;gap:8px;">' + activities.map(a => `
    <div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);">
      <span style="font-size:16px;">${typeIcons[a.type] || '📌'}</span>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:600;">${clanaUtils.sanitizeHtml(a.title)}</div>
        ${a.details ? `<div style="font-size:12px;color:var(--tx3);margin-top:2px;">${clanaUtils.sanitizeHtml(a.details)}</div>` : ''}
      </div>
      <span style="font-size:11px;color:var(--tx3);white-space:nowrap;">${new Date(a.created_at).toLocaleDateString('de-DE')}</span>
    </div>
  `).join('') + '</div>';
}

async function loadCustomerNotes(customerId) {
  const container = document.getElementById('cust-detail-tab-content');
  container.innerHTML = `
    <div style="margin-bottom:12px;">
      <textarea id="cust-note-input" class="form-input" rows="3" placeholder="Notiz hinzufügen..."></textarea>
      <button class="btn" style="margin-top:8px;font-size:12px;" onclick="saveCustomerNote('${customerId}')">Notiz speichern</button>
    </div>
    <div id="cust-notes-list" style="color:var(--tx3);text-align:center;padding:10px;">Laden...</div>
  `;

  const result = await clanaDB.getCustomerActivities(customerId);
  const notes = (result.success ? result.data : []).filter(a => a.type === 'note');
  const list = document.getElementById('cust-notes-list');

  if (!notes.length) {
    list.innerHTML = 'Keine Notizen vorhanden.';
    return;
  }

  list.innerHTML = notes.map(n => `
    <div style="padding:10px 0;border-bottom:1px solid var(--border);text-align:left;">
      <div style="font-size:13px;">${clanaUtils.sanitizeHtml(n.details || '')}</div>
      <span style="font-size:11px;color:var(--tx3);">${new Date(n.created_at).toLocaleString('de-DE')}</span>
    </div>
  `).join('');
}

async function saveCustomerNote(customerId) {
  const input = document.getElementById('cust-note-input');
  const text = input.value.trim();
  if (!text) { Components.toast('Bitte eine Notiz eingeben', 'error'); return; }

  await clanaDB.logCustomerActivity(customerId, 'note', 'Notiz hinzugefügt', text);
  Components.toast('Notiz gespeichert', 'success');
  input.value = '';
  loadCustomerNotes(customerId);
}

// ==========================================
// CALL PROTOCOL MODAL
// ==========================================

function openCallProtocolModal(customerId) {
  document.getElementById('cp-customer-id').value = customerId;
  document.getElementById('cp-called-at').value = new Date().toISOString().slice(0, 16);
  openModal('modal-call-protocol');
}

async function saveCallProtocol() {
  const customerId = document.getElementById('cp-customer-id').value;
  if (!customerId) return;

  const data = {
    customer_id: customerId,
    direction: document.getElementById('cp-direction').value,
    outcome: document.getElementById('cp-outcome').value,
    called_at: document.getElementById('cp-called-at').value || new Date().toISOString(),
    duration_seconds: (Number(document.getElementById('cp-duration').value) || 0) * 60,
    subject: document.getElementById('cp-subject').value.trim(),
    notes: document.getElementById('cp-notes').value.trim()
  };

  const result = await clanaDB.createCallProtocol(data);
  if (!result.success) { Components.toast('Fehler: ' + result.error, 'error'); return; }

  // Follow-up task
  const followUpDate = document.getElementById('cp-followup-date').value;
  if (followUpDate && document.getElementById('cp-create-task').checked) {
    await clanaDB.createTask({
      title: 'Follow-up: ' + (data.subject || 'Anruf'),
      due_date: followUpDate,
      assigned_to: currentProfile.id,
      customer_id: customerId,
      status: 'open',
      priority: 'medium'
    });
  }

  Components.toast('Anrufprotokoll gespeichert', 'success');
  closeModal('modal-call-protocol');

  // Clear form
  ['cp-subject', 'cp-notes', 'cp-duration', 'cp-followup-date'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  // Refresh detail view
  if (currentCustomerDetailId === customerId) loadCallProtocols(customerId);
  loadCustomers();
}

// ==========================================
// CREATE / EDIT CUSTOMER
// ==========================================

function openNewCustomerModal() {
  document.getElementById('cust-modal-title').textContent = 'Neuer Kunde';
  document.getElementById('btn-save-customer').textContent = 'Kunde erstellen';
  delete document.getElementById('btn-save-customer').dataset.editId;
  ['cust-company', 'cust-contact', 'cust-email', 'cust-phone', 'cust-industry', 'cust-plan', 'cust-website', 'cust-address', 'cust-notes-field'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  openModal('modal-add-customer');
}

async function editCustomer(id) {
  const result = await clanaDB.getCustomer(id);
  if (!result.success) return;
  const c = result.data;

  document.getElementById('cust-modal-title').textContent = 'Kunde bearbeiten';
  document.getElementById('btn-save-customer').textContent = 'Speichern';
  document.getElementById('btn-save-customer').dataset.editId = id;

  document.getElementById('cust-company').value = c.company_name || '';
  document.getElementById('cust-contact').value = c.contact_name || '';
  document.getElementById('cust-email').value = c.email || '';
  document.getElementById('cust-phone').value = c.phone || '';
  document.getElementById('cust-industry').value = c.industry || '';
  document.getElementById('cust-plan').value = c.plan || 'starter';
  document.getElementById('cust-website').value = c.website || '';
  document.getElementById('cust-address').value = c.address || '';
  document.getElementById('cust-notes-field').value = c.notes || '';

  closeModal('modal-customer-detail');
  openModal('modal-add-customer');
}

async function saveCustomer() {
  const company = document.getElementById('cust-company').value.trim();
  if (!company) { Components.toast('Firmenname ist erforderlich', 'error'); return; }

  const btn = document.getElementById('btn-save-customer');
  const editId = btn.dataset.editId;
  btn.disabled = true;
  btn.textContent = '…';

  const payload = { company_name: company };
  const contact = document.getElementById('cust-contact').value.trim();
  const email = document.getElementById('cust-email').value.trim();
  const phone = document.getElementById('cust-phone').value.trim();
  const industry = document.getElementById('cust-industry').value;
  const plan = document.getElementById('cust-plan').value;
  const website = document.getElementById('cust-website').value.trim();
  const address = document.getElementById('cust-address').value.trim();
  const notes = document.getElementById('cust-notes-field').value.trim();

  if (contact) payload.contact_name = contact;
  if (email) payload.email = email;
  if (phone) payload.phone = phone;
  if (industry) payload.industry = industry;
  if (plan) payload.plan = plan;
  if (website) payload.website = website;
  if (address) payload.address = address;
  if (notes) payload.notes = notes;

  let result;
  if (editId) {
    result = await clanaDB.updateCustomer(editId, payload);
  } else {
    payload.assigned_to = currentProfile.id;
    payload.status = 'active';
    result = await clanaDB.createCustomer(payload);
  }

  if (result.success) {
    Components.toast(editId ? 'Kunde aktualisiert' : 'Kunde erstellt', 'success');
    closeModal('modal-add-customer');
    loadCustomers();
  } else {
    Components.toast('Fehler: ' + result.error, 'error');
  }

  btn.disabled = false;
  btn.textContent = editId ? 'Speichern' : 'Kunde erstellen';
}

// ==========================================
// CSV IMPORT / EXPORT
// ==========================================

function exportCustomersCSV() {
  if (!allCustomers.length) { Components.toast('Keine Kunden zum Exportieren', 'error'); return; }

  const BOM = '\uFEFF';
  const header = 'Firma,Kontakt,E-Mail,Telefon,Branche,Plan,Status,Health Score,Kunde seit,Letzter Kontakt\n';
  const rows = allCustomers.map(c => {
    const esc = v => '"' + (v || '').replace(/"/g, '""') + '"';
    return [
      esc(c.company_name), esc(c.contact_name), esc(c.email), esc(c.phone),
      esc(CONFIG.getIndustryLabel(c.industry)), esc(CONFIG.getPlanLabel(c.plan)),
      esc((CONFIG.CUSTOMER_STATUSES[c.status] || {}).label || c.status),
      c.health_score || 0,
      c.customer_since ? new Date(c.customer_since).toLocaleDateString('de-DE') : '',
      c.last_contact_at ? new Date(c.last_contact_at).toLocaleDateString('de-DE') : ''
    ].join(',');
  }).join('\n');

  const blob = new Blob([BOM + header + rows], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `kunden_export_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  Components.toast('CSV exportiert', 'success');
}

function openCSVImportModal() {
  document.getElementById('csv-preview-content').innerHTML = '';
  document.getElementById('csv-file-input').value = '';
  document.getElementById('csv-import-count').textContent = '';
  openModal('modal-csv-import');
}

function handleCSVFile(input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result;
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) { Components.toast('CSV-Datei ist leer', 'error'); return; }

    const headers = lines[0].split(/[,;]/).map(h => h.replace(/"/g, '').trim().toLowerCase());
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].match(/(".*?"|[^,;]+)/g) || [];
      const row = {};
      headers.forEach((h, idx) => { row[h] = (values[idx] || '').replace(/^"|"$/g, '').trim(); });
      if (row.firma || row.company || row.company_name || row.firmenname) rows.push(row);
    }

    // Map columns
    window._csvImportRows = rows.map(r => ({
      company_name: r.firma || r.company || r.company_name || r.firmenname || '',
      contact_name: r.kontakt || r.contact || r.contact_name || r.ansprechpartner || r.kontaktperson || '',
      email: r.email || r['e-mail'] || r.mail || '',
      phone: r.telefon || r.phone || r.tel || '',
      industry: r.branche || r.industry || '',
      plan: r.plan || r.paket || 'starter',
      website: r.website || r.webseite || r.url || '',
      address: r.adresse || r.address || '',
      notes: r.notizen || r.notes || r.bemerkung || ''
    })).filter(r => r.company_name);

    document.getElementById('csv-import-count').textContent = window._csvImportRows.length + ' Kunden erkannt';

    // Preview first 5
    const preview = window._csvImportRows.slice(0, 5);
    document.getElementById('csv-preview-content').innerHTML = `
      <table class="data-table" style="margin:0;font-size:12px;">
        <thead><tr><th>Firma</th><th>Kontakt</th><th>E-Mail</th><th>Branche</th><th>Plan</th></tr></thead>
        <tbody>${preview.map(r => `<tr>
          <td>${clanaUtils.sanitizeHtml(r.company_name)}</td>
          <td>${clanaUtils.sanitizeHtml(r.contact_name)}</td>
          <td>${clanaUtils.sanitizeHtml(r.email)}</td>
          <td>${clanaUtils.sanitizeHtml(r.industry)}</td>
          <td>${clanaUtils.sanitizeHtml(r.plan)}</td>
        </tr>`).join('')}</tbody>
      </table>
      ${window._csvImportRows.length > 5 ? `<div style="text-align:center;color:var(--tx3);font-size:12px;margin-top:8px;">… und ${window._csvImportRows.length - 5} weitere</div>` : ''}
    `;
  };
  reader.readAsText(file, 'UTF-8');
}

async function importCSVCustomers() {
  const rows = window._csvImportRows;
  if (!rows || !rows.length) { Components.toast('Keine Daten zum Importieren', 'error'); return; }

  const btn = document.getElementById('btn-csv-import');
  btn.disabled = true;
  btn.textContent = 'Importiere…';

  // Add assigned_to and status
  const data = rows.map(r => ({
    ...r,
    assigned_to: currentProfile.id,
    status: 'active'
  }));

  const result = await clanaDB.bulkCreateCustomers(data);

  if (result.success) {
    Components.toast(`${result.count} Kunden importiert!`, 'success');
    closeModal('modal-csv-import');
    loadCustomers();
  } else {
    Components.toast('Import-Fehler: ' + result.error, 'error');
  }

  btn.disabled = false;
  btn.textContent = 'Importieren';
  window._csvImportRows = null;
}

// ==========================================
// LEAD CONVERSION
// ==========================================

async function convertCurrentLeadToCustomer(leadId) {
  if (!confirm('Lead als Kunde übernehmen?')) return;

  const result = await clanaDB.convertLeadToCustomer(leadId);
  if (result.success) {
    if (result.alreadyExists) {
      Components.toast('Kunde existiert bereits', 'info');
    } else {
      Components.toast('Lead wurde als Kunde übernommen!', 'success');
    }
    if (typeof loadLeads === 'function') loadLeads();
    loadCustomers();
  } else {
    Components.toast('Fehler: ' + result.error, 'error');
  }
}
