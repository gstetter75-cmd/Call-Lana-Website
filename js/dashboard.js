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

  // Handle Stripe Checkout return
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('payment') === 'success') {
    showToast('Zahlung erfolgreich! Dein Guthaben wird in Kürze aktualisiert.');
    window.history.replaceState({}, '', window.location.pathname);
  } else if (urlParams.get('payment') === 'cancelled') {
    showToast('Zahlung abgebrochen.', true);
    window.history.replaceState({}, '', window.location.pathname);
  }

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

  // Direct deep-link to #business: load AFTER currentProfile is ready so
  // contact_name / contact_phone / company fall back correctly for first-time
  // customers. Mark the page loaded so the lazy-route wrapper does not refetch.
  if (window.location.hash === '#business') {
    await loadBusinessProfile();
    if (typeof _loadedPages !== 'undefined') _loadedPages.add('business');
  }
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
        '<span class="live-badge ' + (a.status === 'active' ? 'live' : 'offline') + '">' + (a.status === 'active' ? 'Aktiv' : 'Inaktiv') + '</span>' +
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
    const statusCls = a.status === 'active' ? 'completed' : 'voicemail';
    const statusLabel = a.status === 'active' ? 'Aktiv' : 'Inaktiv';
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
      '<span class="status-badge ' + (a.status === 'active' ? 'completed' : 'voicemail') + '">' + (a.status === 'active' ? 'Aktiv' : 'Inaktiv') + '</span>' +
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
  document.getElementById('edPhoneNumber').value = a.phone_number || '';
  // Stimme/Sprache sind aktuell auf einen Wert festgenagelt (Marie / de).
  // Legacy-Werte aus a.voice / a.language werden bewusst ignoriert, damit
  // ein Save den Datensatz auf den einzig unterstützten Wert normalisiert.
  document.getElementById('edVoice').value = 'Marie';
  document.getElementById('edLang').value = 'de';
  document.getElementById('edMaxDuration').value = a.max_duration || 300;
  document.getElementById('edGreeting').value = a.greeting || '';
  document.getElementById('edSystemPrompt').value = a.system_prompt || '';
  const statusEl = document.getElementById('edStatusDisplay');
  if (statusEl) {
    const isActive = a.status === 'active';
    statusEl.textContent = isActive ? 'Aktiv' : 'Inaktiv';
    statusEl.className = 'status-badge ' + (isActive ? 'completed' : 'voicemail');
  }

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
  document.getElementById('edPhoneNumber').value = '';
  document.getElementById('edVoice').value = 'Marie';
  document.getElementById('edLang').value = 'de';
  document.getElementById('edMaxDuration').value = '300';
  document.getElementById('edGreeting').value = '';
  document.getElementById('edSystemPrompt').value = '';
  const statusEl = document.getElementById('edStatusDisplay');
  if (statusEl) {
    statusEl.textContent = 'Inaktiv';
    statusEl.className = 'status-badge voicemail';
  }
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

  // Customer-facing save path deliberately omits phone_number and status.
  // Both are support-owned: phone numbers are assigned by us, and live status
  // reflects the real runtime hookup — neither is something the customer sets
  // from the dashboard. Existing DB values are left untouched on update.
  const payload = {
    name,
    voice: 'Marie',
    language: 'de',
    max_duration: parseInt(document.getElementById('edMaxDuration').value),
    greeting: document.getElementById('edGreeting').value,
    system_prompt: document.getElementById('edSystemPrompt').value.trim() || null,
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
// PLAN
// ==========================================
async function loadPlan() {
  const planLabels = {
    trial:        { name: 'Testzeitraum',     desc: 'Du nutzt den kostenlosen Testzeitraum.' },
    starter:      { name: 'Starter-Plan',      desc: 'Ideal für Einzelunternehmer.' },
    solo:         { name: 'Solo-Plan',         desc: 'Ideal für Einzelunternehmer.' },
    professional: { name: 'Professional-Plan', desc: 'Für wachsende Teams.' },
    team:         { name: 'Team-Plan',         desc: 'Perfekt für wachsende Teams.' },
    business:     { name: 'Business-Plan',     desc: 'Für große Unternehmen.' },
    enterprise:   { name: 'Enterprise-Plan',   desc: 'Individuelle Lösung.' }
  };
  const statusLabels = {
    trialing: 'Testzeitraum', active: 'Aktiv', past_due: 'Zahlung ausstehend',
    cancelled: 'Gekündigt', paused: 'Pausiert'
  };

  try {
    const { data: sub, error } = await supabaseClient
      .from('subscriptions')
      .select('plan, status, included_minutes')
      .eq('user_id', await auth.getEffectiveUserId())
      .single();

    const plan   = sub && !error ? sub.plan   : 'trial';
    const status = sub && !error ? sub.status : 'trialing';
    const mins   = sub && !error ? (sub.included_minutes || 60) : 60;

    const p = planLabels[plan] || planLabels.trial;
    document.getElementById('planBadge').textContent = statusLabels[status] || status;
    document.getElementById('planName').textContent  = p.name;
    document.getElementById('planDesc').textContent  = p.desc;
    document.getElementById('planFeatures').innerHTML =
      '<li>' + escHtml(mins + ' Minuten inklusive') + '</li>';
  } catch (err) {
    Logger.warn('loadPlan', err);
    document.getElementById('planBadge').textContent = 'Testzeitraum';
    document.getElementById('planName').textContent  = 'Testzeitraum';
    document.getElementById('planDesc').textContent  = 'Plan konnte nicht geladen werden.';
    document.getElementById('planFeatures').innerHTML = '';
  }

  const skeleton = document.getElementById('planSkeleton');
  const content  = document.getElementById('planContent');
  if (skeleton) skeleton.style.display = 'none';
  if (content)  content.style.display  = 'block';
}

// ==========================================
// BUSINESS PROFILE (Betriebsprofil)
// Loads/saves business_profiles row for the current customer.
// Firmenname stays in profiles.company — not duplicated here.
// Emergency settings live in user_settings (jsonb), opening hours in
// working_hours — neither is duplicated into business_profiles.
// ==========================================
let businessProfile = null;
let businessSettings = null;     // raw user_settings jsonb (for merge on save)
let businessWorkingHours = [];   // raw working_hours rows (preserves break_* on save)

// 0 = Montag … 6 = Sonntag — matches js/availability.js
const BIZ_DAY_NAMES = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'];

function renderBusinessHoursTable(rows) {
  const container = document.getElementById('bizHoursTable');
  if (!container) return;
  // Empty array == brand-new customer who has never saved → friendly defaults
  // (Mo–Fr open, weekend closed). Once any row exists, render the persisted
  // is_active state exactly: a missing day means the user explicitly closed it.
  const hasPersistedHours = Array.isArray(rows) && rows.length > 0;
  const html = BIZ_DAY_NAMES.map((name, i) => {
    const wh = rows.find(h => h.day_of_week === i);
    let isOpen, start, end;
    if (wh) {
      isOpen = wh.is_active !== false;
      start  = wh.start_time?.slice(0,5) || '08:00';
      end    = wh.end_time?.slice(0,5)   || '17:00';
    } else if (!hasPersistedHours) {
      isOpen = (i < 5);
      start  = '08:00';
      end    = '17:00';
    } else {
      isOpen = false;
      start  = '08:00';
      end    = '17:00';
    }
    return (
      '<div class="biz-hours-row" data-day="' + i + '" style="display:grid;grid-template-columns:120px auto 1fr 1fr;gap:12px;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);">' +
        '<div style="font-weight:600;font-size:13px;">' + name + '</div>' +
        '<label class="toggle"><input type="checkbox" class="biz-hours-active" ' + (isOpen ? 'checked' : '') + '><span class="toggle-slider"></span></label>' +
        '<input type="time" class="form-input biz-hours-start" value="' + start + '" ' + (isOpen ? '' : 'disabled') + '>' +
        '<input type="time" class="form-input biz-hours-end"   value="' + end   + '" ' + (isOpen ? '' : 'disabled') + '>' +
      '</div>'
    );
  }).join('');
  container.innerHTML = html;

  // Wire open/closed toggles to enable/disable time inputs in the same row
  container.querySelectorAll('.biz-hours-row').forEach(row => {
    const toggle = row.querySelector('.biz-hours-active');
    const start  = row.querySelector('.biz-hours-start');
    const end    = row.querySelector('.biz-hours-end');
    toggle.addEventListener('change', () => {
      start.disabled = !toggle.checked;
      end.disabled   = !toggle.checked;
    });
  });
}

async function loadBusinessProfile() {
  // Load all three sources in parallel — none are blocking dependencies
  const [profileRes, settingsRes, hoursRes] = await Promise.all([
    clanaDB.getBusinessProfile(),
    clanaDB.getSettings(),
    clanaDB.getWorkingHours()
  ]);

  businessProfile      = (profileRes  && profileRes.success  && profileRes.data)  || null;
  businessSettings     = (settingsRes && settingsRes.success && settingsRes.data) || {};
  businessWorkingHours = (hoursRes    && hoursRes.success    && hoursRes.data)    || [];

  // Firmenname is sourced from profiles.company (read-only here)
  const company = (currentProfile && currentProfile.company || '').trim();
  const companyEl = document.getElementById('bizCompany');
  if (companyEl) companyEl.value = company || 'In Einstellungen ergänzen';

  // Prefer saved row; fall back to profile defaults for first-time visitors
  const profileFullName = [currentProfile && currentProfile.first_name, currentProfile && currentProfile.last_name]
    .filter(Boolean).join(' ').trim();
  const profilePhone = (currentProfile && currentProfile.phone || '').trim();

  document.getElementById('bizTrade').value = (businessProfile && businessProfile.trade) || '';
  document.getElementById('bizContactName').value =
    (businessProfile && businessProfile.contact_name) || profileFullName || '';
  document.getElementById('bizContactPhone').value =
    (businessProfile && businessProfile.contact_phone) || profilePhone || '';
  document.getElementById('bizWebsite').value = (businessProfile && businessProfile.website_url) || '';

  const services = new Set((businessProfile && businessProfile.services) || []);
  document.querySelectorAll('#bizServices input[type="checkbox"]').forEach(cb => {
    cb.checked = services.has(cb.value);
  });
  document.getElementById('bizServicesCustom').value = (businessProfile && businessProfile.services_custom) || '';

  const zips = (businessProfile && businessProfile.service_area_zips) || [];
  document.getElementById('bizAreaZips').value = zips.join(', ');
  document.getElementById('bizAreaText').value = (businessProfile && businessProfile.service_area_text) || '';

  const accepts = (businessProfile && businessProfile.accepts_new_clients) || '';
  document.querySelectorAll('input[name="bizAccepts"]').forEach(r => { r.checked = (r.value === accepts); });

  // --- Notfall (user_settings jsonb) ---
  // Default OFF for brand-new users — only enabled once a phone is entered.
  const s = businessSettings || {};
  const emActive = !!s.emergency_active;
  const emActiveEl = document.getElementById('bizEmergencyActive');
  if (emActiveEl) emActiveEl.checked = emActive;
  document.getElementById('bizEmergencyPhone').value    = s.emergency_phone || '';
  document.getElementById('bizEmergencyKeywords').value = (s.emergency_keywords || []).join(', ');

  // --- Öffnungszeiten ---
  renderBusinessHoursTable(businessWorkingHours);

  // --- Anrufverhalten ---
  const bookingMode = (businessProfile && businessProfile.booking_mode) || 'callback';
  document.querySelectorAll('input[name="bizBooking"]').forEach(r => { r.checked = (r.value === bookingMode); });
  document.getElementById('bizCallbackWindow').value =
    (businessProfile && businessProfile.callback_window) || '24h';
  document.getElementById('bizDoNotHandle').value =
    (businessProfile && businessProfile.do_not_handle) || '';

  const errEl = document.getElementById('bizErr');
  if (errEl) errEl.textContent = '';

  // Briefing reflects the form state — build once after load.
  updateAssistantBriefing();
}

// ==========================================
// ASSISTENT-BRIEFING (read-only summary for support handoff)
// ==========================================
// This is NOT a live runtime config. It exists so the customer can copy a
// clean German summary of their setup data and send it to support, who then
// configures the actual assistant. No automatic sync happens anywhere.
const BIZ_ACCEPTS_LABELS = {
  yes:        'Ja',
  peak_only:  'Nur in Stoßzeiten',
  no:         'Nein, derzeit voll'
};
const BIZ_BOOKING_LABELS = {
  direct:    'Direkt buchen',
  callback:  'Rückruf vereinbaren'
};
const BIZ_CALLBACK_LABELS = {
  today:  'Noch heute',
  '24h':  'Innerhalb von 24 Stunden',
  '48h':  'Innerhalb von 48 Stunden'
};

function buildAssistantBriefing() {
  const val = id => (document.getElementById(id)?.value || '').trim();

  const company = val('bizCompany');
  // loadBusinessProfile fills bizCompany with this placeholder for users
  // without a saved company name — treat it as empty in the briefing.
  const companyClean = (company && !company.includes('Einstellungen ergänzen')) ? company : '';

  const tradeVal = document.getElementById('bizTrade')?.value || '';
  const tradeOpt = tradeVal ? document.querySelector('#bizTrade option[value="' + tradeVal + '"]') : null;
  const trade = tradeOpt ? tradeOpt.textContent.trim() : '';

  const contactName  = val('bizContactName');
  const contactPhone = val('bizContactPhone');
  const website      = val('bizWebsite');

  const services = Array.from(
    document.querySelectorAll('#bizServices input[type="checkbox"]:checked')
  ).map(cb => (cb.parentElement?.textContent || '').trim()).filter(Boolean);
  const servicesCustom = val('bizServicesCustom');

  const areaZips = val('bizAreaZips');
  const areaText = val('bizAreaText');
  const acceptsEl = document.querySelector('input[name="bizAccepts"]:checked');
  const accepts = acceptsEl ? (BIZ_ACCEPTS_LABELS[acceptsEl.value] || '') : '';

  const emergencyActive   = !!document.getElementById('bizEmergencyActive')?.checked;
  const emergencyPhone    = val('bizEmergencyPhone');
  const emergencyKeywords = val('bizEmergencyKeywords');

  const bookingEl    = document.querySelector('input[name="bizBooking"]:checked');
  const bookingMode  = bookingEl ? bookingEl.value : '';
  const bookingLabel = BIZ_BOOKING_LABELS[bookingMode] || '';
  const callbackVal  = document.getElementById('bizCallbackWindow')?.value || '';
  const callbackLabel = BIZ_CALLBACK_LABELS[callbackVal] || '';
  const doNotHandle = val('bizDoNotHandle');

  const hourLines = [];
  document.querySelectorAll('#bizHoursTable .biz-hours-row').forEach(row => {
    const day = parseInt(row.dataset.day, 10);
    const active = !!row.querySelector('.biz-hours-active')?.checked;
    const start = row.querySelector('.biz-hours-start')?.value || '';
    const end   = row.querySelector('.biz-hours-end')?.value   || '';
    const name = BIZ_DAY_NAMES[day] || ('Tag ' + day);
    if (active && start && end) {
      hourLines.push('- ' + name + ': ' + start + ' bis ' + end);
    } else {
      hourLines.push('- ' + name + ': geschlossen');
    }
  });

  const lines = [];
  lines.push('Betriebsprofil für Lana');
  lines.push('');
  if (companyClean)  lines.push('Firma: ' + companyClean);
  if (trade)         lines.push('Gewerk: ' + trade);
  if (contactName || contactPhone) {
    const parts = [contactName, contactPhone].filter(Boolean).join(', ');
    lines.push('Ansprechpartner: ' + parts);
  }
  if (website)       lines.push('Website: ' + website);

  lines.push('');
  lines.push('Leistungen:');
  if (services.length) {
    services.forEach(s => lines.push('- ' + s));
  } else {
    lines.push('- (keine ausgewählt)');
  }
  if (servicesCustom) lines.push('Sonstige Leistungen: ' + servicesCustom);

  lines.push('');
  lines.push('Einsatzgebiet:');
  if (areaZips) lines.push('- PLZ: ' + areaZips);
  if (areaText) lines.push('- Region: ' + areaText);
  if (!areaZips && !areaText) lines.push('- (nicht angegeben)');
  if (accepts) lines.push('Neukunden: ' + accepts);

  lines.push('');
  lines.push('Notfall:');
  lines.push('- Notdienst aktiv: ' + (emergencyActive ? 'Ja' : 'Nein'));
  if (emergencyPhone)    lines.push('- Notfall-Telefon: ' + emergencyPhone);
  if (emergencyKeywords) lines.push('- Stichworte: ' + emergencyKeywords);

  lines.push('');
  lines.push('Öffnungszeiten:');
  if (hourLines.length) {
    hourLines.forEach(l => lines.push(l));
  } else {
    lines.push('- (noch nicht erfasst)');
  }

  lines.push('');
  lines.push('Anrufverhalten:');
  if (bookingLabel) lines.push('- Terminmodus: ' + bookingLabel);
  if (bookingMode === 'callback' && callbackLabel) {
    lines.push('- Standard-Rückrufzeit: ' + callbackLabel);
  }
  if (doNotHandle) lines.push('- Nicht annehmen: ' + doNotHandle);

  return lines.join('\n');
}

function updateAssistantBriefing() {
  const ta = document.getElementById('bizBriefing');
  if (!ta) return;
  ta.value = buildAssistantBriefing();
}

// Live preview: rebuild briefing whenever any field on the Betrieb page changes.
// Delegated listener — readonly bizBriefing itself never fires input/change.
const businessPageEl = document.getElementById('page-business');
if (businessPageEl) {
  businessPageEl.addEventListener('input',  updateAssistantBriefing);
  businessPageEl.addEventListener('change', updateAssistantBriefing);
}

document.getElementById('btnCopyBriefing')?.addEventListener('click', async () => {
  const statusEl = document.getElementById('bizCopyStatus');
  const text = buildAssistantBriefing();
  const setStatus = (msg, isErr) => {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.style.color = isErr ? 'var(--red)' : 'var(--tx2)';
    setTimeout(() => { if (statusEl.textContent === msg) statusEl.textContent = ''; }, 3000);
  };
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      setStatus('Briefing kopiert.');
      return;
    }
    throw new Error('clipboard unavailable');
  } catch (e) {
    // Fallback for non-secure contexts: select the textarea and copy.
    const ta = document.getElementById('bizBriefing');
    if (!ta) { setStatus('Kopieren fehlgeschlagen.', true); return; }
    const wasReadonly = ta.hasAttribute('readonly');
    ta.removeAttribute('readonly');
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
    if (wasReadonly) ta.setAttribute('readonly', '');
    ta.setSelectionRange(0, 0);
    ta.blur();
    setStatus(ok ? 'Briefing kopiert.' : 'Kopieren fehlgeschlagen.', !ok);
  }
});

document.getElementById('btnSaveBusiness')?.addEventListener('click', async () => {
  const errEl = document.getElementById('bizErr');
  errEl.textContent = '';

  const trade         = document.getElementById('bizTrade').value;
  const contactName   = document.getElementById('bizContactName').value.trim();
  const contactPhone  = document.getElementById('bizContactPhone').value.trim();
  const website       = document.getElementById('bizWebsite').value.trim();
  const services      = Array.from(document.querySelectorAll('#bizServices input[type="checkbox"]:checked')).map(cb => cb.value);
  const servicesCustom = document.getElementById('bizServicesCustom').value.trim();

  // PLZ cleanup: split on comma/whitespace, keep only 5-digit entries, dedupe, preserve input order
  const rawZips = document.getElementById('bizAreaZips').value;
  const zipsSeen = new Set();
  const zipsClean = [];
  rawZips.split(/[,\s;]+/).forEach(z => {
    const t = z.trim();
    if (/^\d{5}$/.test(t) && !zipsSeen.has(t)) { zipsSeen.add(t); zipsClean.push(t); }
  });

  const areaText  = document.getElementById('bizAreaText').value.trim();
  const acceptsEl = document.querySelector('input[name="bizAccepts"]:checked');
  const accepts   = acceptsEl ? acceptsEl.value : '';

  // --- Notfall ---
  const emergencyActive   = !!document.getElementById('bizEmergencyActive')?.checked;
  const emergencyPhone    = (document.getElementById('bizEmergencyPhone')?.value || '').trim();
  const emergencyKeywords = (document.getElementById('bizEmergencyKeywords')?.value || '')
    .split(',').map(k => k.trim()).filter(Boolean);

  // --- Anrufverhalten ---
  const bookingEl  = document.querySelector('input[name="bizBooking"]:checked');
  const bookingMode = bookingEl ? bookingEl.value : 'callback';
  const callbackWindow = document.getElementById('bizCallbackWindow').value || '24h';
  const doNotHandle = (document.getElementById('bizDoNotHandle').value || '').trim();

  // --- Öffnungszeiten ---
  // Always write all 7 days (is_active true for open, false for closed) so the
  // exact user state round-trips through the DB. Validation only applies to
  // open days; closed days get safe placeholder times to satisfy the NOT NULL
  // start_time/end_time columns. Existing break_start/break_end are preserved
  // since this MVP UI does not edit them.
  const hoursRows = [];
  let hoursError = null;
  document.querySelectorAll('#bizHoursTable .biz-hours-row').forEach(row => {
    if (hoursError) return;
    const day = parseInt(row.dataset.day, 10);
    const active = row.querySelector('.biz-hours-active').checked;
    const start = row.querySelector('.biz-hours-start').value || '08:00';
    const end   = row.querySelector('.biz-hours-end').value   || '17:00';
    if (active) {
      if (start >= end) {
        hoursError = 'Startzeit muss vor Endzeit liegen (' + BIZ_DAY_NAMES[day] + ').';
        return;
      }
    }
    const existing = (businessWorkingHours || []).find(h => h.day_of_week === day) || {};
    const entry = { day_of_week: day, start_time: start, end_time: end, is_active: !!active };
    if (existing.break_start && existing.break_end) {
      entry.break_start = existing.break_start;
      entry.break_end   = existing.break_end;
    }
    hoursRows.push(entry);
  });

  // Validation
  if (!trade)        { errEl.textContent = 'Bitte ein Gewerk wählen.'; return; }
  if (!contactName)  { errEl.textContent = 'Bitte einen Ansprechpartner angeben.'; return; }
  if (!contactPhone) { errEl.textContent = 'Bitte eine Telefonnummer für den Ansprechpartner angeben.'; return; }
  if (services.length === 0 && !servicesCustom) {
    errEl.textContent = 'Bitte mindestens eine Leistung auswählen oder unter „Sonstige Leistungen" eintragen.'; return;
  }
  if (zipsClean.length === 0 && !areaText) {
    errEl.textContent = 'Bitte ein Einsatzgebiet angeben (PLZ-Liste oder Region/Stadt).'; return;
  }
  if (!['yes','no','peak_only'].includes(accepts)) {
    errEl.textContent = 'Bitte angeben, ob Neukunden angenommen werden.'; return;
  }
  if (emergencyActive && !emergencyPhone) {
    errEl.textContent = 'Bitte eine Notfall-Telefonnummer angeben oder den Notdienst deaktivieren.'; return;
  }
  if (!['direct','callback'].includes(bookingMode)) {
    errEl.textContent = 'Bitte angeben, ob Termine direkt vereinbart werden sollen.'; return;
  }
  if (!['today','24h','48h'].includes(callbackWindow)) {
    errEl.textContent = 'Bitte eine Standard-Rückrufzeit wählen.'; return;
  }
  if (hoursError) { errEl.textContent = hoursError; return; }

  const btn = document.getElementById('btnSaveBusiness');
  const orig = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Speichern…';

  const profilePayload = {
    trade,
    contact_name:        contactName,
    contact_phone:       contactPhone,
    website_url:         website || null,
    services,
    services_custom:     servicesCustom || null,
    service_area_zips:   zipsClean,
    service_area_text:   areaText || null,
    accepts_new_clients: accepts,
    booking_mode:        bookingMode,
    callback_window:     callbackWindow,
    do_not_handle:       doNotHandle || null
  };

  // Merge emergency fields into the existing settings jsonb so unrelated keys
  // (calendar, modules, alert_channel, …) are preserved. Re-fetch immediately
  // before merge so edits made elsewhere (settings.html in another tab) are
  // not clobbered by a stale page-load snapshot. Fall back to the snapshot
  // only if the fresh fetch fails.
  const freshRes = await clanaDB.getSettings();
  const baseSettings = (freshRes && freshRes.success && freshRes.data) || businessSettings || {};
  const mergedSettings = Object.assign({}, baseSettings, {
    emergency_active:   emergencyActive,
    emergency_phone:    emergencyPhone || null,
    emergency_keywords: emergencyKeywords
  });

  // Run the three writes in parallel — they target unrelated tables.
  const [profileRes, settingsRes, hoursRes] = await Promise.all([
    clanaDB.upsertBusinessProfile(null, profilePayload),
    clanaDB.saveSettings(mergedSettings),
    clanaDB.setWorkingHours(hoursRows)
  ]);

  const failures = [];
  if (profileRes.success)  businessProfile = profileRes.data;     else failures.push('Stammdaten');
  if (settingsRes.success) businessSettings = mergedSettings;     else failures.push('Notfall');
  if (hoursRes.success)    businessWorkingHours = hoursRows;      else failures.push('Öffnungszeiten');

  if (failures.length === 0) {
    showToast('Betriebsdaten gespeichert.');
  } else {
    errEl.textContent = 'Teilweise nicht gespeichert: ' + failures.join(', ') + '.';
    showToast('Fehler beim Speichern.', true);
  }
  updateAssistantBriefing();
  btn.disabled = false;
  btn.textContent = orig;
});

// ==========================================
// KNOWLEDGE BASE (placeholder)
// ==========================================
document.getElementById('btnUploadDoc')?.addEventListener('click', () => {
  showToast('Dokument-Upload wird bald verfügbar sein.');
});

document.getElementById('kbSearch')?.addEventListener('input', (e) => {
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
  business: 'Betrieb',
  assistants: 'Assistenten',
  'assistant-edit': 'Assistent bearbeiten',
  phones: 'Telefonnummern',
  transactions: 'Anrufverlauf',
  appointments: 'Termine',
  analytics: 'Analytics',
  billing: 'Guthaben',
  payment: 'Zahlungsmethoden'
};

// Valid dashboard pages whitelist
const VALID_PAGES = Object.keys(breadcrumbNames);

function navigateToPage(page, updateHash = true) {
  // Validate page against whitelist — fallback to 'home' for unknown routes
  const requestedPage = page;
  if (!VALID_PAGES.includes(page) && page !== 'assistant-edit') {
    page = 'home';
  }
  // If we had to clamp a hidden/invalid hash (e.g. #team, #plans, #integrations
  // from removed sections), rewrite the URL so a refresh doesn't re-enter the
  // dead route.
  if (requestedPage !== page && window.location.hash.slice(1) === requestedPage) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
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
    case 'billing': loadBillingData(); break;
    case 'payment': loadPaymentMethods(); break;
    case 'invoices': loadInvoices(); break;
    case 'business': loadBusinessProfile(); break;
  }
};
// Also load on initial hash
if (window.location.hash === '#payment') loadPaymentMethods();
if (window.location.hash === '#billing') loadBillingData();
// #business is loaded inside the auth IIFE once currentProfile is ready.
