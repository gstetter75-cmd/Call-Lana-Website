// ==========================================
// Dashboard Main — Customer Dashboard Orchestrator
// Language: German only (i18n applies to marketing pages, not dashboards)
// Split modules: dashboard-billing.js, dashboard-integrations.js, dashboard-payment.js
// ==========================================

// ==========================================
// GLOBALS
// ==========================================
let currentUser = null;
let currentProfile = null;
let allCalls = [];
let assistantsList = [];
let editingAssistantId = null;
let currentConversationId = null;

// ==========================================
// AUTH CHECK (role-based)
// ==========================================
(async () => {
  currentProfile = await AuthGuard.requireCustomer();
  if (!currentProfile) return;

  currentUser = await clanaAuth.getUser();

  // Load shared sidebar
  await Components.loadSidebar('sidebar-container', currentProfile);

  // Logout handler
  document.getElementById('sidebar-logout')?.addEventListener('click', async () => {
    await clanaAuth.signOut();
    window.location.href = 'login.html';
  });

  initMonthSelect();

  // Load only essential data upfront, rest is lazy-loaded on navigation
  await Promise.all([
    loadHomeData(),
    loadAssistants()
  ]);

  // Onboarding checklist
  if (typeof Onboarding !== 'undefined') Onboarding.init(currentUser?.id);

  // Notification center
  if (typeof NotificationCenter !== 'undefined') NotificationCenter.init(currentProfile);

  // Help tooltips + activity log
  if (typeof DashboardExtras !== 'undefined') {
    DashboardExtras.initHelpTooltips();
    DashboardExtras.loadRecentActions();
  }

  // Analytics: usage alerts, assistant performance, call heatmap
  if (typeof DashboardAnalytics !== 'undefined') {
    DashboardAnalytics.checkUsageAlerts();
    DashboardAnalytics.loadAssistantPerformance();
    DashboardAnalytics.loadCallHeatmap();
  }

  // Home widgets: metric cards, emergency banner, recent calls, appointments, top leads
  if (typeof HomeWidgets !== 'undefined') {
    HomeWidgets.init();
  }

  // Realtime subscriptions for live updates
  if (typeof RealtimeManager !== 'undefined') {
    RealtimeManager.init();
  }

  // Team management
  document.getElementById('btnInviteMember')?.addEventListener('click', inviteTeamMember);
  document.getElementById('btnNewConversation')?.addEventListener('click', startNewConversation);
  document.getElementById('btnSendMessage')?.addEventListener('click', sendMessage);
  document.getElementById('messageInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
})();

// ==========================================

// ==========================================
// ASSISTANTS
// ==========================================
async function loadAssistants() {
  const result = await clanaDB.getAssistants();
  if (result.success) {
    assistantsList = result.data;
  } else {
    assistantsList = [];
  }
  renderAssistantsList();
  renderHomeAssistants();
  renderPhonesFromAssistants();
}

function renderHomeAssistants() {
  const container = document.getElementById('homeAssistants');
  if (assistantsList.length === 0) {
    container.innerHTML = '<div class="assistant-card" onclick="createNewAssistant()" style="display:flex;align-items:center;justify-content:center;min-height:80px;border-style:dashed;"><span style="color:var(--tx3);font-size:13px;">+ Neuen Assistenten erstellen</span></div>';
    return;
  }
  container.innerHTML = assistantsList.map(a =>
    '<div class="assistant-card" onclick="editAssistant(\'' + a.id + '\')">' +
      '<div class="ac-top">' +
        '<div class="ac-name">' + escHtml(a.name) + '</div>' +
        '<span class="live-badge ' + (a.status === 'live' ? 'live' : 'offline') + '">' + (a.status === 'live' ? 'LIVE' : 'Offline') + '</span>' +
      '</div>' +
      '<div class="ac-phone">' + (a.phone_number || 'Keine Nummer') + '</div>' +
    '</div>'
  ).join('');
}

function renderAssistantsList() {
  const container = document.getElementById('assistantsListBody');
  if (assistantsList.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="icon">🤖</div><h3>Keine Assistenten</h3><p>Erstelle deinen ersten KI-Assistenten.</p></div>';
    return;
  }
  let html = '<div class="table-wrap"><table><thead><tr><th>Name</th><th>Status</th><th>Telefonnummer</th><th>Stimme</th><th>Erstellt</th><th>Aktionen</th></tr></thead><tbody>';
  assistantsList.forEach(a => {
    const statusCls = a.status === 'live' ? 'completed' : 'voicemail';
    const statusLabel = a.status === 'live' ? 'LIVE' : 'Offline';
    html += '<tr>' +
      '<td style="font-weight:600;color:var(--tx);cursor:pointer;" onclick="editAssistant(\'' + a.id + '\')">' + escHtml(a.name) + '</td>' +
      '<td><span class="status-badge ' + statusCls + '">' + statusLabel + '</span></td>' +
      '<td>' + (a.phone_number || '–') + '</td>' +
      '<td>' + escHtml(a.voice || 'Marie') + '</td>' +
      '<td>' + clanaUtils.formatDate(a.created_at) + '</td>' +
      '<td><button onclick="event.stopPropagation();deleteAssistant(\'' + a.id + '\',\'' + escHtml(a.name) + '\')" style="background:none;border:1px solid rgba(248,113,113,.3);border-radius:6px;padding:4px 10px;color:var(--red);font-size:11px;cursor:pointer;font-family:inherit;">Löschen</button></td>' +
    '</tr>';
  });
  html += '</tbody></table></div>';
  container.innerHTML = html;
}

function renderPhonesFromAssistants() {
  const container = document.getElementById('phonesListBody');
  const withPhone = assistantsList.filter(a => a.phone_number);
  document.getElementById('phonesCount').textContent = withPhone.length + ' Nummern';

  if (withPhone.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="icon">📱</div><h3>Keine Nummern</h3><p>Füge eine Telefonnummer hinzu, um Anrufe entgegenzunehmen.</p></div>';
    return;
  }

  container.innerHTML = withPhone.map(a =>
    '<div class="phone-item">' +
      '<div class="phone-number-text">' + escHtml(a.phone_number) + '</div>' +
      '<span class="status-badge ' + (a.status === 'live' ? 'completed' : 'voicemail') + '">' + (a.status === 'live' ? 'Aktiv' : 'Inaktiv') + '</span>' +
      '<div class="phone-assistant">' + escHtml(a.name) + '</div>' +
    '</div>'
  ).join('');
}

// NEW ASSISTANT
document.getElementById('btnNewAssistant').addEventListener('click', createNewAssistant);

function createNewAssistant() {
  editingAssistantId = null;
  document.getElementById('editTitle').textContent = 'Neuer Assistent';
  document.getElementById('editDesc').textContent = 'Erstelle einen neuen KI-Assistenten.';
  clearEditorForm();
  navigateToPage('assistant-edit');
}

// EDIT ASSISTANT
function editAssistant(id) {
  const a = assistantsList.find(x => x.id === id);
  if (!a) return;
  editingAssistantId = id;
  document.getElementById('editTitle').textContent = a.name;
  document.getElementById('editDesc').textContent = 'Konfiguriere deinen Assistenten.';

  document.getElementById('edName').value = a.name || '';
  document.getElementById('edVoice').value = a.voice || 'Marie';
  document.getElementById('edLang').value = a.language || 'de';
  document.getElementById('edGreeting').value = a.greeting || '';
  document.getElementById('edModel').value = a.model || 'gpt-4';
  document.getElementById('edTemp').value = a.temperature ?? 0.7;
  document.getElementById('edMaxDuration').value = a.max_duration || 300;

  const tools = a.tools || {};
  document.getElementById('edToolCalendar').checked = !!tools.calendar;
  document.getElementById('edToolCRM').checked = !!tools.crm;
  document.getElementById('edToolEmail').checked = !!tools.email;
  document.getElementById('edToolKB').checked = !!tools.knowledge_base;

  const pp = a.post_processing || {};
  document.getElementById('edPostSummary').checked = !!pp.summary;
  document.getElementById('edPostTranscript').checked = !!pp.transcript_email;
  document.getElementById('edPostSentiment').checked = !!pp.sentiment;

  const ob = a.outbound || {};
  document.getElementById('edOutboundEnabled').checked = !!ob.enabled;
  document.getElementById('edOutboundMax').value = ob.max_concurrent || 1;
  document.getElementById('edOutboundFrom').value = ob.time_from || '09:00';
  document.getElementById('edOutboundTo').value = ob.time_to || '18:00';

  navigateToPage('assistant-edit');
}

function clearEditorForm() {
  document.getElementById('edName').value = '';
  document.getElementById('edVoice').value = 'Marie';
  document.getElementById('edLang').value = 'de';
  document.getElementById('edGreeting').value = '';
  document.getElementById('edModel').value = 'gpt-4';
  document.getElementById('edTemp').value = '0.7';
  document.getElementById('edMaxDuration').value = '300';
  document.getElementById('edToolCalendar').checked = false;
  document.getElementById('edToolCRM').checked = false;
  document.getElementById('edToolEmail').checked = false;
  document.getElementById('edToolKB').checked = false;
  document.getElementById('edPostSummary').checked = false;
  document.getElementById('edPostTranscript').checked = false;
  document.getElementById('edPostSentiment').checked = false;
  document.getElementById('edOutboundEnabled').checked = false;
  document.getElementById('edOutboundMax').value = '1';
  document.getElementById('edOutboundFrom').value = '09:00';
  document.getElementById('edOutboundTo').value = '18:00';
}

// SAVE ASSISTANT
document.getElementById('btnSaveAssistant').addEventListener('click', async () => {
  const name = document.getElementById('edName').value.trim();
  if (!name) { showToast('Bitte einen Namen eingeben.', true); return; }

  const saveBtn = document.getElementById('btnSaveAssistant');
  const origText = saveBtn.textContent;
  saveBtn.disabled = true;
  saveBtn.textContent = 'Speichern…';

  const payload = {
    name,
    voice: document.getElementById('edVoice').value,
    language: document.getElementById('edLang').value,
    greeting: document.getElementById('edGreeting').value,
    model: document.getElementById('edModel').value,
    temperature: parseFloat(document.getElementById('edTemp').value),
    max_duration: parseInt(document.getElementById('edMaxDuration').value),
    tools: {
      calendar: document.getElementById('edToolCalendar').checked,
      crm: document.getElementById('edToolCRM').checked,
      email: document.getElementById('edToolEmail').checked,
      knowledge_base: document.getElementById('edToolKB').checked
    },
    post_processing: {
      summary: document.getElementById('edPostSummary').checked,
      transcript_email: document.getElementById('edPostTranscript').checked,
      sentiment: document.getElementById('edPostSentiment').checked
    },
    outbound: {
      enabled: document.getElementById('edOutboundEnabled').checked,
      max_concurrent: parseInt(document.getElementById('edOutboundMax').value),
      time_from: document.getElementById('edOutboundFrom').value,
      time_to: document.getElementById('edOutboundTo').value
    }
  };

  let result;
  if (editingAssistantId) {
    result = await clanaDB.updateAssistant(editingAssistantId, payload);
  } else {
    result = await clanaDB.createAssistant(payload);
  }

  if (result.success) {
    showToast(editingAssistantId ? 'Assistent aktualisiert!' : 'Assistent erstellt!');
    await loadAssistants();
    navigateToPage('assistants');
  } else {
    showToast('Fehler: ' + result.error, true);
  }
  saveBtn.disabled = false;
  saveBtn.textContent = origText;
});

// EDITOR TABS
document.querySelectorAll('.editor-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.editor-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.editor-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab).classList.add('active');
  });
});

// ==========================================
// ALL CALLS (TRANSACTIONS)
// ==========================================
async function loadAllCalls() {
  const result = await clanaDB.getCalls(200);
  if (result.success && result.data.length > 0) {
    allCalls = result.data;
    renderFilteredCalls();
    initCallFilters();
  } else {
    allCalls = [];
    document.getElementById('allCallsBody').innerHTML = emptyCallsHTML();
  }
}

function renderFilteredCalls() {
  const search = (document.getElementById('callSearchInput')?.value || '').toLowerCase();
  const statusFilter = document.getElementById('callStatusFilter')?.value || '';
  const outcomeFilter = document.getElementById('callOutcomeFilter')?.value || '';
  const dateFrom = document.getElementById('callDateFrom')?.value || '';
  const dateTo = document.getElementById('callDateTo')?.value || '';

  const filtered = allCalls.filter(c => {
    if (search && !(c.phone_number || '').toLowerCase().includes(search) && !(c.caller_name || '').toLowerCase().includes(search)) return false;
    if (statusFilter && c.status !== statusFilter) return false;
    if (outcomeFilter && c.outcome !== outcomeFilter) return false;
    if (dateFrom && c.created_at < dateFrom) return false;
    if (dateTo && c.created_at > dateTo + 'T23:59:59') return false;
    return true;
  });

  document.getElementById('allCallsCount').textContent = filtered.length + ' Anrufe';
  if (filtered.length > 0) {
    document.getElementById('allCallsBody').innerHTML = buildCallTable(filtered);
  } else {
    document.getElementById('allCallsBody').innerHTML = '<div class="empty-state"><h3>Keine Ergebnisse</h3><p>Versuche andere Filterkriterien.</p></div>';
  }
}

function initCallFilters() {
  document.getElementById('callSearchInput')?.addEventListener('input', renderFilteredCalls);
  document.getElementById('callStatusFilter')?.addEventListener('change', renderFilteredCalls);
  document.getElementById('callOutcomeFilter')?.addEventListener('change', renderFilteredCalls);
  document.getElementById('callDateFrom')?.addEventListener('change', renderFilteredCalls);
  document.getElementById('callDateTo')?.addEventListener('change', renderFilteredCalls);
}

// ==========================================
// BILLING
// ==========================================
async function loadBilling() {
  const settingsResult = await clanaDB.getSettings();
  const settings = settingsResult.success ? settingsResult.data : {};
  const balance = settings.balance || 0;

  document.getElementById('balanceValue').textContent = formatCurrency(balance);
  document.getElementById('balanceSub').textContent = balance > 0 ? 'Verfügbar' : 'Kein Guthaben vorhanden';

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = now.toISOString();
  const statsResult = await clanaDB.getStats(monthStart, monthEnd);

  if (statsResult.success) {
    const s = statsResult.stats;
    document.getElementById('usageCalls').textContent = s.totalCalls.toLocaleString('de-DE');
    document.getElementById('usageMinutes').textContent = Math.round(s.totalDuration / 60).toLocaleString('de-DE');
    const cost = (s.totalDuration / 60) * 0.15;
    document.getElementById('usageCost').textContent = formatCurrency(cost);
  } else {
    document.getElementById('usageCalls').textContent = '0';
    document.getElementById('usageMinutes').textContent = '0';
    document.getElementById('usageCost').textContent = '0,00 €';
  }
}

// ==========================================
// PLAN
// ==========================================
async function loadPlan() {
  const meta = currentUser?.user_metadata || {};
  const plan = meta.plan || 'free';
  const plans = {
    free: { name: 'Free-Plan', desc: 'Du nutzt den kostenlosen Plan.', features: ['100 Testminuten', '1 Benutzer', 'E-Mail-Support'] },
    solo: { name: 'Solo-Plan', desc: 'Ideal für Einzelunternehmer.', features: ['1.000 Minuten/Monat', '1 Benutzer', '1 KI-Stimme', 'Eigene Telefonnummer', 'Basis-Reporting'] },
    team: { name: 'Team-Plan', desc: 'Perfekt für wachsende Teams.', features: ['3.000 Minuten/Monat', 'Unbegrenzte Benutzer', '5 gleichzeitige Gespräche', 'Alle Stimmen', 'CRM-Integration'] },
    business: { name: 'Business-Plan', desc: 'Für große Unternehmen.', features: ['Unbegrenzte Minuten', 'Eigene KI-Stimme', 'SLA-Garantie 99,9%', 'API-Zugang', 'Dedizierter Account Manager'] }
  };

  const p = plans[plan] || plans.free;
  document.getElementById('planBadge').textContent = plan.charAt(0).toUpperCase() + plan.slice(1);
  document.getElementById('planName').textContent = p.name;
  document.getElementById('planDesc').textContent = p.desc;
  document.getElementById('planFeatures').innerHTML = p.features.map(f => '<li>' + escHtml(f) + '</li>').join('');
  // Reveal populated content, hide skeleton
  const skeleton = document.getElementById('planSkeleton');
  const content = document.getElementById('planContent');
  if (skeleton) skeleton.style.display = 'none';
  if (content) content.style.display = 'block';
}

// ==========================================
// KNOWLEDGE BASE (placeholder)
// ==========================================
document.getElementById('btnUploadDoc').addEventListener('click', () => {
  showToast('Dokument-Upload wird bald verfügbar sein.');
});

document.getElementById('kbSearch').addEventListener('input', (e) => {
  // Placeholder search - no documents yet
});

// ==========================================
// HELPERS
// ==========================================
function buildCallTable(calls) {
  let html = '<div class="table-wrap"><table><thead><tr><th>Datum</th><th>Anrufer</th><th>Dauer</th><th>Status</th><th>Ergebnis</th><th>Sentiment</th><th>Details</th></tr></thead><tbody>';
  calls.forEach((c, i) => {
    const date = clanaUtils.formatDate(c.created_at);
    const phone = c.phone_number || '–';
    const callerName = c.caller_name ? escHtml(c.caller_name) : '';
    const dur = c.duration ? clanaUtils.formatDuration(c.duration) : '–';
    const statusMap = {
      completed: { label: 'Abgeschlossen', cls: 'completed' },
      missed: { label: 'Verpasst', cls: 'missed' },
      voicemail: { label: 'Mailbox', cls: 'voicemail' },
      active: { label: 'Aktiv', cls: 'active' }
    };
    const st = statusMap[c.status] || { label: c.status || '–', cls: 'completed' };

    // Outcome badge
    const outcomeMap = {
      termin: { label: 'Termin', cls: 'termin' },
      notfall: { label: 'Notfall', cls: 'notfall' },
      frage: { label: 'Frage', cls: 'frage' },
      abbruch: { label: 'Abbruch', cls: 'abbruch' }
    };
    const oc = outcomeMap[c.outcome] || null;
    const outcomeHtml = oc ? '<span class="outcome-badge ' + oc.cls + '">' + oc.label + '</span>' : '<span style="color:var(--tx3);font-size:11px;">–</span>';

    // Sentiment
    let sentimentHtml = '<span style="color:var(--tx3);font-size:11px;">–</span>';
    if (c.sentiment_score != null) {
      const score = parseFloat(c.sentiment_score);
      const color = score >= 7 ? 'var(--green)' : score >= 4 ? 'var(--orange)' : 'var(--red)';
      sentimentHtml = '<span class="sentiment-dot" style="background:' + color + ';"></span><span style="font-size:12px;font-weight:600;">' + score.toFixed(1) + '</span>';
    }

    const hasTranscript = c.transcript && c.transcript.trim().length > 0;
    const callerDisplay = callerName ? callerName + '<br><span style="font-size:11px;color:var(--tx3);">' + escHtml(phone) + '</span>' : escHtml(phone);

    html += '<tr style="cursor:pointer;" onclick="showCallDetail(' + i + ')">' +
      '<td>' + date + '</td>' +
      '<td>' + callerDisplay + '</td>' +
      '<td>' + dur + '</td>' +
      '<td><span class="status-badge ' + st.cls + '">' + st.label + '</span></td>' +
      '<td>' + outcomeHtml + '</td>' +
      '<td>' + sentimentHtml + '</td>' +
      '<td>' + (hasTranscript ? '<button onclick="event.stopPropagation();showCallDetail(' + i + ')" style="background:none;border:1px solid var(--border2);border-radius:6px;padding:4px 10px;color:var(--pu3);font-size:11px;cursor:pointer;font-family:inherit;">Ansehen</button>' : '<span style="color:var(--tx3);font-size:11px;">—</span>') + '</td>' +
    '</tr>';
  });
  html += '</tbody></table></div>';
  return html;
}

function showCallDetail(callIndex) {
  const call = allCalls[callIndex];
  if (!call) return;

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);z-index:100;display:flex;align-items:center;justify-content:center;';
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  const phone = escHtml(call.phone_number || 'Unbekannt');
  const callerName = call.caller_name ? escHtml(call.caller_name) : '';
  const date = clanaUtils.formatDate(call.created_at);
  const dur = call.duration ? clanaUtils.formatDuration(call.duration) : '–';

  // Outcome
  const outcomeMap = { termin: 'Termin', notfall: 'Notfall', frage: 'Frage', abbruch: 'Abbruch' };
  const outcomeLabel = outcomeMap[call.outcome] || '–';

  // Sentiment
  let sentimentDisplay = '–';
  if (call.sentiment_score != null) {
    const score = parseFloat(call.sentiment_score);
    const color = score >= 7 ? 'var(--green)' : score >= 4 ? 'var(--orange)' : 'var(--red)';
    sentimentDisplay = '<span style="color:' + color + ';font-weight:700;">' + score.toFixed(1) + '/10</span>';
  }

  // Parse transcript into lines (format: "Speaker: text" or "[timestamp] Speaker: text")
  let transcriptHtml = '';
  if (call.transcript && call.transcript.trim()) {
    const lines = call.transcript.trim().split('\n').filter(l => l.trim());
    transcriptHtml = '<div style="margin-top:20px;">' +
      '<h4 style="font-size:13px;font-weight:700;margin-bottom:12px;">Transkript</h4>' +
      '<div style="background:var(--bg2);border-radius:12px;padding:16px;">';

    lines.forEach(line => {
      const trimmed = line.trim();
      // Try to parse "[HH:MM:SS] Speaker: text" or "Speaker: text"
      const tsMatch = trimmed.match(/^\[?([\d:]+)\]?\s*(.+)/);
      let timestamp = '';
      let rest = trimmed;
      if (tsMatch && tsMatch[1].includes(':') && tsMatch[1].length <= 8) {
        timestamp = tsMatch[1];
        rest = tsMatch[2];
      }

      const speakerMatch = rest.match(/^(Lana|Anrufer|Caller|Agent|Kunde|Customer)\s*:\s*(.*)/i);
      if (speakerMatch) {
        const speaker = speakerMatch[1];
        const text = escHtml(speakerMatch[2]);
        const isLana = /lana|agent/i.test(speaker);
        const speakerCls = isLana ? 'lana' : 'caller';
        const speakerLabel = isLana ? 'Lana' : 'Anrufer';
        transcriptHtml += '<div class="transcript-line">' +
          '<span class="transcript-speaker ' + speakerCls + '">' + speakerLabel + '</span>' +
          '<span class="transcript-text">' + text + '</span>' +
          (timestamp ? '<span class="transcript-timestamp">' + timestamp + '</span>' : '') +
        '</div>';
      } else {
        transcriptHtml += '<div class="transcript-line">' +
          '<span class="transcript-speaker" style="color:var(--tx3);">…</span>' +
          '<span class="transcript-text">' + escHtml(trimmed) + '</span>' +
        '</div>';
      }
    });

    transcriptHtml += '</div></div>';
  }

  overlay.innerHTML = '<div class="transcript-modal">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">' +
      '<div><h3 style="font-family:Syne,sans-serif;font-size:1.1rem;font-weight:700;">Anruf-Details</h3>' +
      '<div style="font-size:12px;color:var(--tx3);margin-top:4px;">' + (callerName ? callerName + ' · ' : '') + phone + '</div></div>' +
      '<button onclick="this.closest(\'div[style*=fixed]\').remove()" style="background:none;border:none;color:var(--tx3);font-size:1.4rem;cursor:pointer;">✕</button>' +
    '</div>' +
    '<div class="transcript-meta">' +
      '<div class="transcript-meta-item"><div class="transcript-meta-label">Datum</div><div class="transcript-meta-value">' + date + '</div></div>' +
      '<div class="transcript-meta-item"><div class="transcript-meta-label">Dauer</div><div class="transcript-meta-value">' + dur + '</div></div>' +
      '<div class="transcript-meta-item"><div class="transcript-meta-label">Ergebnis</div><div class="transcript-meta-value">' + outcomeLabel + '</div></div>' +
      '<div class="transcript-meta-item"><div class="transcript-meta-label">Sentiment</div><div class="transcript-meta-value">' + sentimentDisplay + '</div></div>' +
    '</div>' +
    transcriptHtml +
  '</div>';

  document.body.appendChild(overlay);
}

// Legacy alias
function showTranscript(callIndex) { showCallDetail(callIndex); }

// ==========================================
// CSV EXPORT
// ==========================================
const CallsPage = {
  exportCSV() {
    if (!allCalls.length) {
      showToast('Keine Anrufe zum Exportieren.', true);
      return;
    }

    const headers = ['Datum', 'Telefonnummer', 'Anrufer', 'Dauer (Sek)', 'Status', 'Ergebnis', 'Sentiment'];
    const rows = allCalls.map(c => [
      c.created_at ? new Date(c.created_at).toLocaleString('de-DE') : '',
      c.phone_number || '',
      c.caller_name || '',
      c.duration || 0,
      c.status || '',
      c.outcome || '',
      c.sentiment_score != null ? c.sentiment_score : ''
    ]);

    let csv = '\uFEFF'; // BOM for Excel UTF-8
    csv += headers.join(';') + '\n';
    rows.forEach(row => {
      csv += row.map(val => '"' + String(val).replace(/"/g, '""') + '"').join(';') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'anrufe_' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV exportiert.');
  }
};
window.CallsPage = CallsPage;

function emptyCallsHTML() {
  return '<div class="empty-state"><div class="icon">📞</div><h3>Noch keine Anrufe</h3><p>Sobald Lana Anrufe entgegennimmt, erscheinen sie hier.</p></div>';
}

function formatMinutes(seconds) {
  if (!seconds || seconds === 0) return '0 min';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m === 0) return s + ' sek';
  return m + ':' + String(s).padStart(2, '0') + ' min';
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
}

async function deleteAssistant(id, name) {
  if (!confirm('Assistent "' + name + '" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) return;
  const result = await clanaDB.deleteAssistant(id);
  if (result.success) {
    showToast('Assistent gelöscht.');
    await loadAssistants();
  } else {
    showToast('Fehler: ' + result.error, true);
  }
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function showToast(msg, isError) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' error' : '');
  setTimeout(() => t.className = 'toast', 3000);
}

// ==========================================
// NAVIGATION

const breadcrumbNames = {
  home: 'Home',
  assistants: 'Assistenten',
  'assistant-edit': 'Assistent bearbeiten',
  knowledge: 'Wissensdatenbank',
  phones: 'Telefonnummern',
  transactions: 'Anrufverlauf',
  appointments: 'Termine',
  analytics: 'Analytics',
  billing: 'Guthaben',
  payment: 'Zahlungsmethoden',
  plans: 'Paket',
  team: 'Team',
  messages: 'Nachrichten',
  integrations: 'Integrationen'
};

// Valid dashboard pages whitelist
const VALID_PAGES = Object.keys(breadcrumbNames);

function navigateToPage(page, updateHash = true) {
  // Validate page against whitelist — fallback to 'home' for unknown routes
  if (!VALID_PAGES.includes(page) && page !== 'assistant-edit') {
    page = 'home';
  }
  document.querySelectorAll('.page-section').forEach(p => p.classList.remove('active'));
  const el = document.getElementById('page-' + page);
  if (el) el.classList.add('active');

  document.querySelectorAll('.sb-item').forEach(item => item.classList.remove('active'));
  document.querySelector('[data-page="' + page + '"]')?.classList.add('active');

  document.getElementById('breadcrumb').textContent = breadcrumbNames[page] || page;
  if (updateHash) window.location.hash = page;

  // Close sidebar on mobile
  document.querySelector('.sidebar')?.classList.remove('open');
  document.getElementById('sidebarOverlay')?.classList.remove('open');

  // Reset editor tabs on enter
  if (page === 'assistant-edit') {
    document.querySelectorAll('.editor-tab').forEach((t, i) => t.classList.toggle('active', i === 0));
    document.querySelectorAll('.editor-panel').forEach((p, i) => p.classList.toggle('active', i === 0));
  }
}

// Sidebar click handlers — use event delegation since sidebar is loaded async
document.addEventListener('click', (e) => {
  const item = e.target.closest('.sb-item[data-page]');
  if (item) {
    e.preventDefault();
    navigateToPage(item.dataset.page);
  }
});

window.addEventListener('hashchange', () => {
  const page = window.location.hash.slice(1) || 'home';
  navigateToPage(page, false);
});

const initialPage = window.location.hash.slice(1) || 'home';
if (initialPage !== 'home') navigateToPage(initialPage, false);

// ==========================================
// MOBILE SIDEBAR (handled by Components.loadSidebar, hamburger is extra)
// ==========================================
document.getElementById('hamburgerBtn')?.addEventListener('click', () => {
  document.querySelector('.sidebar')?.classList.add('open');
  document.getElementById('sidebarOverlay')?.classList.add('open');
});
document.getElementById('sidebarOverlay')?.addEventListener('click', () => {
  document.querySelector('.sidebar')?.classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
});

// Logout is handled via sidebar-logout in init()

// Billing & Balance → extracted to js/dashboard-billing.js
// Integrations & CSV Import → extracted to js/dashboard-integrations.js
// Payment Methods → extracted to js/dashboard-payment.js

// ==========================================
// LAZY LOADING (navigation-triggered data loading)

// Load data when navigating to billing/payment pages
// Lazy loading: load data only when page is visited
const _loadedPages = new Set(['home']);
const origNavigate = navigateToPage;
navigateToPage = function(page, updateHash) {
  origNavigate(page, updateHash);
  // Sync mobile bottom nav active state
  document.querySelectorAll('.mob-nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });
  if (_loadedPages.has(page)) return;
  _loadedPages.add(page);
  switch (page) {
    case 'transactions':
      loadAllCalls();
      if (typeof DashboardExtras !== 'undefined') DashboardExtras.renderTranscriptSearch(document.getElementById('transcript-search-section'));
      break;
    case 'appointments': if (typeof AppointmentsPage !== 'undefined') AppointmentsPage.init(); break;
    case 'analytics': if (typeof AnalyticsPage !== 'undefined') AnalyticsPage.init(); break;
    case 'billing': loadBilling(); loadBillingData(); break;
    case 'plan': loadPlan(); break;
    case 'team': loadTeam(); break;
    case 'messages': loadConversations(); break;
    case 'payment': loadPaymentMethods(); break;
    case 'integrations': loadIntegrations(); break;
    case 'invoices': loadInvoices(); break;
  }
};
// Also load on initial hash
if (window.location.hash === '#payment') loadPaymentMethods();
if (window.location.hash === '#billing') loadBillingData();
if (window.location.hash === '#integrations') loadIntegrations();
