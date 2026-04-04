// Extracted from dashboard.js — Integrations, Contacts, CSV Import
// ==========================================
// INTEGRATIONS (dashboard view — connectors managed in settings.html#connectors)
// ==========================================
const INTEGRATION_ICONS = {
  sip_trunk: '📞', fritzbox: '📠', rufumleitung: '↪️', eigene_rufnummer: '🔢',
  rest_api: '🔌', pre_call_webhook: '⚡', mid_call_api: '🔄', post_call_webhook: '📤', outbound_api: '📲',
  hubspot: '💼', salesforce: '☁️', pipedrive: '🔄', zoho_crm: '📊', gohighlevel: '🚀',
  google_calendar: '📆', outlook: '📧', cal_com: '🗓️', calendly: '📅', etermin: '🕐',
  doctolib: '🏥', apaleo: '🏨', aleno: '🍽️', opentable: '🛎️',
  shopify: '🛒', jtl: '📦', woocommerce: '🛍️', sap: '🏢', xentral: '⚙️', plentymarkets: '📋', shopware: '🛒',
  lexoffice: '📒', sevdesk: '🧾',
  mailchimp: '📧', activecampaign: '🎯', klaviyo: '🎹', klicktipp: '✉️', typeform: '📝', meta_lead_ads: '📱',
  zendesk: '🎫', freshdesk: '💬', jira: '🐛', autotask: '🔧',
  slack: '💬', teams: '👥', discord: '🎮', email_gateway: '✉️', sms_gateway: '📱',
  airtable: '🗃️', google_sheets: '📊', sql_db: '🗄️', google_maps: '📍',
  notion: '📓', monday: '📋',
  zapier: '⚡', make: '🔧', n8n: '🔗',
  live_web: '🌐', woasi: '🏔️'
};

async function loadIntegrations() {
  const user = await clanaAuth.getUser();
  if (!user) return;

  try {
    const { data: connections } = await supabaseClient
      .from('integrations').select('*').eq('user_id', await auth.getEffectiveUserId());

    const connected = connections || [];
    document.getElementById('intConnectedCount').textContent = connected.length + ' verbunden';

    if (connected.length > 0) {
      document.getElementById('intEmptyState').style.display = 'none';
      const list = document.getElementById('intConnectedList');
      list.style.display = 'grid';
      list.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';
      list.style.gap = '12px';
      list.innerHTML = connected.map(c => {
        const icon = INTEGRATION_ICONS[c.provider] || '🔗';
        const cfg = c.config || {};
        const typeLabel = cfg.type === 'sip' ? 'SIP' : cfg.type === 'webhook' ? 'Webhook' : cfg.type === 'apikey' ? 'API-Key' : cfg.type === 'oauth' ? 'OAuth' : cfg.type === 'forward' ? 'Rufumleitung' : '';
        return `<div style="background:var(--bg3);border:1px solid rgba(74,222,128,.2);border-radius:12px;padding:16px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
            <span style="font-size:1.2rem;">${icon}</span>
            <div style="flex:1;">
              <div style="font-size:13px;font-weight:700;">${escHtml(c.provider_label || c.provider)}</div>
              <div style="font-size:11px;color:var(--tx3);">${escHtml(c.category || '')} · ${typeLabel}</div>
            </div>
            <span class="status-badge completed">Aktiv</span>
          </div>
          <div style="font-size:11px;color:var(--tx3);">
            Verbunden seit: ${c.connected_at ? new Date(c.connected_at).toLocaleDateString('de-DE') : '–'}
            ${c.last_sync_at ? ' · Sync: ' + new Date(c.last_sync_at).toLocaleString('de-DE') : ''}
            ${c.records_synced ? ' · ' + c.records_synced + ' Datensaetze' : ''}
          </div>
          <div style="display:flex;gap:8px;margin-top:10px;">
            <button class="btn-sm" onclick="syncIntegration('${c.id}')">Syncen</button>
            <a href="settings.html#connectors" class="btn-secondary" style="font-size:11px;padding:6px 12px;text-decoration:none;">Konfigurieren</a>
          </div>
        </div>`;
      }).join('');
    } else {
      document.getElementById('intEmptyState').style.display = '';
      document.getElementById('intConnectedList').style.display = 'none';
    }

    await loadContacts();
  } catch (err) {
    Logger.warn('loadIntegrations', 'Tables might not exist yet', err);
  }
}

async function loadContacts() {
  const user = await clanaAuth.getUser();
  if (!user) return;

  try {
    const { data, error } = await supabaseClient
      .from('customer_contacts').select('*').eq('user_id', await auth.getEffectiveUserId()).order('created_at', { ascending: false }).limit(50);

    if (error) throw error;

    document.getElementById('contactsCount').textContent = (data || []).length;

    const tbody = document.getElementById('contactsTableBody');
    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--tx3);padding:30px;">Keine Kontakte vorhanden. Importiere per CSV oder verbinde ein CRM.</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(c => `<tr>
      <td style="font-weight:600;">${escHtml(c.first_name || '')} ${escHtml(c.last_name || '')}</td>
      <td>${escHtml(c.company || '–')}</td>
      <td style="font-family:monospace;font-size:12px;">${escHtml(c.phone || '–')}</td>
      <td>${escHtml(c.email || '–')}</td>
      <td><span class="status-badge active">${escHtml(c.source)}</span></td>
      <td>${c.vip ? '⭐' : '–'}</td>
    </tr>`).join('');
  } catch (err) {
    Logger.warn('loadContacts', 'Table might not exist yet', err);
  }
}

async function syncIntegration(integrationId) {
  showToast('Sync gestartet... Daten werden synchronisiert.');
}

async function disconnectIntegration(integrationId) {
  if (!confirm('Integration wirklich trennen? Alle synchronisierten Daten bleiben erhalten.')) return;
  const user = await clanaAuth.getUser();
  if (!user) return;

  try {
    await supabaseClient.from('integrations').delete().eq('id', integrationId).eq('user_id', await auth.getEffectiveUserId());
    showToast('Integration getrennt.');
    await loadIntegrations();
  } catch (err) {
    Logger.error('disconnectIntegration', err);
    showToast('Integration konnte nicht getrennt werden. Bitte versuchen Sie es erneut.', true);
  }
}

// CSV Import
let csvParsedData = [];

function openContactImport() {
  document.getElementById('csvImportModal').style.display = 'flex';
  csvParsedData = [];
  document.getElementById('csvPreview').style.display = 'none';
  document.getElementById('csvImportBtn').disabled = true;
  document.getElementById('csvFileInput').value = '';
}

function closeCsvImportModal() {
  document.getElementById('csvImportModal').style.display = 'none';
}

function handleCsvFile(input) {
  const file = input.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    showToast('CSV-Datei darf maximal 5 MB gross sein.', true);
    input.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result;
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length < 2) { showToast('CSV-Datei ist leer oder hat nur Header.', true); return; }

    const headers = lines[0].split(/[,;]/).map(h => h.trim().replace(/"/g, ''));
    csvParsedData = lines.slice(1).map(line => {
      const values = line.split(/[,;]/).map(v => v.trim().replace(/"/g, ''));
      const obj = {};
      headers.forEach((h, i) => { obj[h.toLowerCase()] = values[i] || ''; });
      return obj;
    }).filter(row => Object.values(row).some(v => v));

    if (csvParsedData.length > 5000) {
      showToast('Maximal 5.000 Zeilen erlaubt. Die Datei enthält ' + csvParsedData.length + ' Zeilen.', true);
      csvParsedData = [];
      return;
    }

    document.getElementById('csvRowCount').textContent = csvParsedData.length;
    document.getElementById('csvPreview').style.display = 'block';

    const previewHtml = '<table style="width:100%;font-size:12px;"><thead><tr>' +
      headers.map(h => '<th style="padding:6px 8px;text-align:left;">' + escHtml(h) + '</th>').join('') +
      '</tr></thead><tbody>' +
      csvParsedData.slice(0, 5).map(row =>
        '<tr>' + headers.map(h => '<td style="padding:4px 8px;">' + escHtml(row[h.toLowerCase()] || '') + '</td>').join('') + '</tr>'
      ).join('') +
      (csvParsedData.length > 5 ? '<tr><td colspan="' + headers.length + '" style="padding:6px 8px;color:var(--tx3);">... und ' + (csvParsedData.length - 5) + ' weitere</td></tr>' : '') +
      '</tbody></table>';

    document.getElementById('csvPreviewTable').innerHTML = previewHtml;
    document.getElementById('csvImportBtn').disabled = false;
  };
  reader.readAsText(file);
}

function stripHtml(str) {
  if (!str) return str;
  const div = document.createElement('div');
  div.innerHTML = str;
  return (div.textContent || '').trim();
}

async function importCsvContacts() {
  if (csvParsedData.length === 0) return;

  const btn = document.getElementById('csvImportBtn');
  btn.disabled = true;
  btn.textContent = 'Importiere...';

  const user = await clanaAuth.getUser();
  if (!user) { showToast('Nicht angemeldet.', true); return; }
  const effectiveId = await auth.getEffectiveUserId();

  try {
    const contacts = csvParsedData.map(row => ({
      user_id: effectiveId,
      first_name: stripHtml(row.vorname || row.first_name || row.firstname || ''),
      last_name: stripHtml(row.nachname || row.last_name || row.lastname || ''),
      company: stripHtml(row.firma || row.company || row.unternehmen || ''),
      phone: stripHtml(row.telefon || row.phone || row.tel || row.nummer || ''),
      email: stripHtml(row.email || row['e-mail'] || ''),
      source: 'csv_import',
      notes: stripHtml(row.notizen || row.notes || '')
    }));

    const { error } = await supabaseClient.from('customer_contacts').insert(contacts);
    if (error) throw error;

    showToast(contacts.length + ' Kontakte importiert!');
    closeCsvImportModal();
    await loadContacts();
  } catch (err) {
    Logger.error('importCsvContacts', err);
    showToast('Import fehlgeschlagen. Bitte versuchen Sie es erneut.', true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Importieren';
  }
}

// Drag & drop for CSV
document.getElementById('csvDropZone')?.addEventListener('dragover', function(e) {
  e.preventDefault();
  this.style.borderColor = 'var(--pu)';
  this.style.background = 'rgba(124,58,237,.04)';
});
document.getElementById('csvDropZone')?.addEventListener('dragleave', function() {
  this.style.borderColor = 'var(--border)';
  this.style.background = '';
});
document.getElementById('csvDropZone')?.addEventListener('drop', function(e) {
  e.preventDefault();
  this.style.borderColor = 'var(--border)';
  this.style.background = '';
  const file = e.dataTransfer.files[0];
  if (file && file.name.endsWith('.csv')) {
    document.getElementById('csvFileInput').files = e.dataTransfer.files;
    handleCsvFile(document.getElementById('csvFileInput'));
  } else {
    showToast('Bitte eine CSV-Datei verwenden.', true);
  }
});
