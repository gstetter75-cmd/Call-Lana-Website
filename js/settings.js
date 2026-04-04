// ==========================================
// GLOBALS
// ==========================================
let currentUser = null;
let currentProfile = null;
let userSettings = {};

// ==========================================
// AUTH CHECK (role-based via AuthGuard)
// ==========================================
(async () => {
  currentProfile = await AuthGuard.init();
  if (!currentProfile) return;

  currentUser = await clanaAuth.getUser();

  // Load shared sidebar
  await Components.loadSidebar('sidebar-container', currentProfile);

  // Logout handler
  document.getElementById('sidebar-logout')?.addEventListener('click', async () => {
    await clanaAuth.signOut();
    window.location.href = 'login.html';
  });

  // Profile form — use profiles table data first, fall back to auth metadata
  document.getElementById('firstName').value = currentProfile.first_name || '';
  document.getElementById('lastName').value = currentProfile.last_name || '';
  document.getElementById('email').value = currentProfile.email || currentUser?.email || '';
  document.getElementById('company').value = currentProfile.company || '';
  document.getElementById('industry').value = currentProfile.industry || '';

  // Last login
  const lastSign = currentUser?.last_sign_in_at;
  if (lastSign) {
    document.getElementById('lastLogin').textContent = new Intl.DateTimeFormat('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(new Date(lastSign));
  }

  // Load notification settings from Supabase
  const settingsResult = await clanaDB.getSettings();
  if (settingsResult.success) {
    userSettings = settingsResult.data;
    applyNotificationToggles(userSettings);
  }

  // Load billing address fields from profiles table
  loadBillingAddress(currentProfile);
})();

// ==========================================
// SAVE PROFILE (Supabase)
// ==========================================
async function saveProfile() {
  const btn = document.getElementById('saveProfileBtn');
  const errEl = document.getElementById('profile-err');
  errEl.textContent = '';

  const fn = document.getElementById('firstName').value.trim();
  const ln = document.getElementById('lastName').value.trim();
  const co = document.getElementById('company').value.trim();
  const ind = document.getElementById('industry').value.trim();

  if (!fn || !ln) {
    errEl.textContent = 'Vor- und Nachname sind erforderlich.';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Speichert...';

  // Update auth metadata
  const authResult = await clanaAuth.updateProfile({
    firstName: fn,
    lastName: ln,
    fullName: fn + ' ' + ln,
    company: co,
    industry: ind
  });

  // Update profiles table
  if (currentProfile?.id) {
    await clanaDB.updateProfile(currentProfile.id, {
      first_name: fn,
      last_name: ln,
      company: co,
      industry: ind
    });
  }

  btn.disabled = false;
  btn.textContent = 'Änderungen speichern';

  if (authResult.success) {
    // Update sidebar user info if present
    const nameEl = document.querySelector('.sb-user-name');
    const avatarEl = document.querySelector('.sb-avatar');
    if (nameEl) nameEl.textContent = fn + ' ' + ln;
    if (avatarEl) avatarEl.textContent = fn.charAt(0).toUpperCase();
    showToast('Profil erfolgreich aktualisiert!');
  } else {
    errEl.textContent = 'Fehler: ' + authResult.error;
  }
}

// ==========================================
// CHANGE PASSWORD (Supabase)
// ==========================================
async function changePassword() {
  if (typeof ImpersonationManager !== 'undefined' && ImpersonationManager.isActionBlocked('change_password')) {
    showToast('Passwort-Änderung ist während Impersonation nicht erlaubt.', true);
    return;
  }
  const btn = document.getElementById('savePwBtn');
  const errEl = document.getElementById('pw-err');
  errEl.textContent = '';

  const pw1 = document.getElementById('newPw').value;
  const pw2 = document.getElementById('newPw2').value;

  if (!pw1 || pw1.length < 8) {
    errEl.textContent = 'Passwort muss mindestens 8 Zeichen haben.';
    return;
  }
  if (pw1 !== pw2) {
    errEl.textContent = 'Passwörter stimmen nicht überein.';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Speichert…';

  try {
    const { data, error } = await supabaseClient.auth.updateUser({ password: pw1 });
    if (error) throw error;
    document.getElementById('newPw').value = '';
    document.getElementById('newPw2').value = '';
    showToast('Passwort erfolgreich geändert!');
  } catch (e) {
    Logger.error('changePassword', e);
    errEl.textContent = 'Passwort konnte nicht geändert werden. Bitte versuchen Sie es erneut.';
  }

  btn.disabled = false;
  btn.textContent = 'Passwort aktualisieren';
}

// ==========================================
// NOTIFICATIONS (Supabase)
// ==========================================
function toggleNotif(el) {
  el.classList.toggle('on');
}

function applyNotificationToggles(settings) {
  document.querySelectorAll('.toggle-switch[data-key]').forEach(toggle => {
    const key = toggle.dataset.key;
    if (settings[key] !== undefined) {
      toggle.classList.toggle('on', !!settings[key]);
    }
  });
}

async function saveNotifications() {
  const notifications = {};
  document.querySelectorAll('.toggle-switch[data-key]').forEach(toggle => {
    notifications[toggle.dataset.key] = toggle.classList.contains('on');
  });

  userSettings = { ...userSettings, ...notifications };
  const result = await clanaDB.saveSettings(userSettings);

  if (result.success) {
    showToast('Benachrichtigungen gespeichert!');
  } else {
    showToast('Fehler beim Speichern: ' + result.error, true);
  }
}

// ==========================================
// BILLING ADDRESS
// ==========================================

/**
 * Populate billing address fields from the profile record.
 * @param {Object} profile - Profile record from Supabase
 */
function loadBillingAddress(profile) {
  if (!profile) return;
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el && val) el.value = val;
  };
  setVal('billingCompany', profile.billing_company);
  setVal('billingStreet', profile.billing_street);
  setVal('billingZip', profile.billing_zip);
  setVal('billingCity', profile.billing_city);
  setVal('billingCountry', profile.billing_country);
  setVal('billingVatId', profile.billing_vat_id);

  // Auto-invoice email toggle
  const toggle = document.getElementById('autoInvoiceEmail');
  if (toggle && userSettings.auto_invoice_email) {
    toggle.classList.add('on');
  }
}

/**
 * Save billing address fields to the profiles table and auto_invoice_email to settings.
 */
async function saveBillingAddress() {
  const errEl = document.getElementById('billing-addr-err');
  if (errEl) errEl.textContent = '';

  const billingCompany = (document.getElementById('billingCompany')?.value || '').trim();
  const billingStreet = (document.getElementById('billingStreet')?.value || '').trim();
  const billingZip = (document.getElementById('billingZip')?.value || '').trim();
  const billingCity = (document.getElementById('billingCity')?.value || '').trim();
  const billingCountry = (document.getElementById('billingCountry')?.value || '').trim();
  const billingVatId = (document.getElementById('billingVatId')?.value || '').trim();

  if (!billingCompany || !billingStreet || !billingZip || !billingCity) {
    if (errEl) errEl.textContent = 'Bitte Firma, Stra\u00DFe, PLZ und Ort ausfuellen.';
    return;
  }

  try {
    // Save billing address to profiles table
    if (currentProfile?.id) {
      await clanaDB.updateProfile(currentProfile.id, {
        billing_company: billingCompany,
        billing_street: billingStreet,
        billing_zip: billingZip,
        billing_city: billingCity,
        billing_country: billingCountry || 'Deutschland',
        billing_vat_id: billingVatId || null
      });
    }

    // Save auto-invoice email preference to settings
    const autoEmailToggle = document.getElementById('autoInvoiceEmail');
    const autoInvoiceEmail = autoEmailToggle ? autoEmailToggle.classList.contains('on') : false;
    userSettings = { ...userSettings, auto_invoice_email: autoInvoiceEmail };
    await clanaDB.saveSettings(userSettings);

    showToast('Rechnungsadresse gespeichert!');
  } catch (err) {
    Logger.error('saveBillingAddress', err);
    if (errEl) errEl.textContent = 'Fehler beim Speichern. Bitte erneut versuchen.';
  }
}

// ==========================================
// DELETE ACCOUNT
// ==========================================
async function deleteAccount() {
  if (typeof ImpersonationManager !== 'undefined' && ImpersonationManager.isActionBlocked('delete_account')) {
    showToast('Account-Löschung ist während Impersonation nicht erlaubt.', true);
    return;
  }
  const confirmed = prompt('Gib "LÖSCHEN" ein, um dein Konto unwiderruflich zu löschen:');
  if (confirmed !== 'LÖSCHEN') return;

  showToast('Kontolöschung wird bald verfügbar sein. Kontaktiere den Support.', true);
}

// ==========================================
// TOAST
// ==========================================
function showToast(msg, isError) {
  const t = document.getElementById('toast');
  t.textContent = (isError ? '⚠️ ' : '✅ ') + msg;
  t.className = 'toast show' + (isError ? ' error' : '');
  setTimeout(() => t.className = 'toast', 3000);
}

// ==========================================
// CONNECTORS
// ==========================================
const CONNECTORS = [
  // Telefonie
  { provider: 'sip_trunk', label: 'SIP / SIP-Trunking', icon: '📞', category: 'Telefonie', type: 'sip',  status: 'available', desc: 'Verbinde deinen SIP-Trunk-Anbieter (Sipgate, Placetel, easybell u.a.) direkt mit Call Lana.' },
  { provider: 'fritzbox', label: 'Fritzbox', icon: '📠', category: 'Telefonie', type: 'sip', status: 'available', desc: 'Verbinde deine Fritzbox per SIP. So leitet deine Fritzbox Anrufe direkt an Call Lana weiter.' },
  { provider: 'rufumleitung', label: 'Rufumleitung', icon: '↪️', category: 'Telefonie', type: 'forward', status: 'available', desc: 'Leite Anrufe per Rufumleitung an Call Lana weiter – funktioniert mit jedem Telefonanbieter.' },
  { provider: 'eigene_rufnummer', label: 'Eigene Rufnummer', icon: '🔢', category: 'Telefonie', type: 'forward', status: 'available', desc: 'Nutze eine eigene Call Lana Rufnummer als Geschaeftsnummer.' },
  // Webhooks & API
  { provider: 'rest_api', label: 'REST API', icon: '🔌', category: 'Webhooks & API', type: 'webhook', status: 'available', desc: 'Nutze die Call Lana REST API fuer Anrufe, Kontakte und Daten.' },
  { provider: 'pre_call_webhook', label: 'Pre-Call Webhook', icon: '⚡', category: 'Webhooks & API', type: 'webhook', status: 'available', desc: 'Wird vor jedem Anruf ausgeloest. Lade Kundendaten oder entscheide ob angenommen wird.' },
  { provider: 'mid_call_api', label: 'Mid-Call / Live-API', icon: '🔄', category: 'Webhooks & API', type: 'webhook', status: 'available', desc: 'Greife waehrend des Gespraechs in Echtzeit auf externe Daten zu.' },
  { provider: 'post_call_webhook', label: 'Post-Call Webhook', icon: '📤', category: 'Webhooks & API', type: 'webhook', status: 'available', desc: 'Wird nach jedem Anruf ausgeloest. Sende Zusammenfassungen oder erstelle Tickets.' },
  { provider: 'outbound_api', label: 'Outbound Call API', icon: '📲', category: 'Webhooks & API', type: 'webhook', status: 'available', desc: 'Starte ausgehende Anrufe per API – z.B. fuer Terminbestaetigung.' },
  // CRM & Vertrieb
  { provider: 'hubspot', label: 'HubSpot CRM', icon: '💼', category: 'CRM & Vertrieb', type: 'oauth', status: 'available', desc: 'Synchronisiere Kontakte, Deals und Aktivitaeten mit HubSpot.' },
  { provider: 'salesforce', label: 'Salesforce', icon: '☁️', category: 'CRM & Vertrieb', type: 'oauth', status: 'available', desc: 'Verbinde Salesforce fuer Leads, Kontakte und Cases.' },
  { provider: 'pipedrive', label: 'Pipedrive', icon: '🔄', category: 'CRM & Vertrieb', type: 'apikey', status: 'available', desc: 'Importiere Kontakte und erstelle Aktivitaeten in Pipedrive.', apiHelp: 'API-Token unter Einstellungen > Persoenlich > API.' },
  { provider: 'zoho_crm', label: 'Zoho CRM', icon: '📊', category: 'CRM & Vertrieb', type: 'oauth', status: 'available', desc: 'Synchronisiere Zoho CRM Kontakte und erstelle Anrufprotokolle.' },
  { provider: 'gohighlevel', label: 'GoHighLevel', icon: '🚀', category: 'CRM & Vertrieb', type: 'apikey', status: 'available', desc: 'Lead-Management und automatische Follow-ups.', apiHelp: 'API-Key unter Settings > Business Profile > API Key.' },
  // Kalender
  { provider: 'google_calendar', label: 'Google Calendar', icon: '📆', category: 'Kalender & Termine', type: 'oauth', status: 'available', desc: 'Termine pruefen und neue Termine eintragen.' },
  { provider: 'outlook', label: 'Outlook / 365', icon: '📧', category: 'Kalender & Termine', type: 'oauth', status: 'available', desc: 'Outlook-Kalender fuer Terminvergabe und Verfuegbarkeitspruefung.' },
  { provider: 'cal_com', label: 'cal.com', icon: '🗓️', category: 'Kalender & Termine', type: 'apikey', status: 'available', desc: 'Freie Slots pruefen und Termine buchen.', apiHelp: 'API-Key unter Settings > Developer > API Keys.' },
  { provider: 'calendly', label: 'Calendly', icon: '📅', category: 'Kalender & Termine', type: 'oauth', status: 'available', desc: 'Verfuegbarkeit pruefen und Buchungslinks erstellen.' },
  { provider: 'etermin', label: 'eTermin', icon: '🕐', category: 'Kalender & Termine', type: 'apikey', status: 'available', desc: 'Online-Terminvergabe direkt waehrend des Telefonats.', apiHelp: 'API-Zugangsdaten unter Einstellungen > API.' },
  { provider: 'treatwell', label: 'Treatwell', icon: '💇', category: 'Kalender & Termine', type: 'apikey', status: 'coming_soon', desc: 'Fuer Salons und Beauty-Studios – Terminbuchung per Telefon.' },
  { provider: 'shore', label: 'Shore', icon: '🏪', category: 'Kalender & Termine', type: 'apikey', status: 'coming_soon', desc: 'Fuer lokale Dienstleister – Terminkalender und Kundenverwaltung.' },
  // Arztpraxen
  { provider: 'doctolib', label: 'Doctolib', icon: '🏥', category: 'Arztpraxen', type: 'apikey', status: 'coming_soon', desc: 'Terminvergabe und Patientenverwaltung.' },
  { provider: 'cgm_turbomed', label: 'CGM / Turbomed', icon: '💊', category: 'Arztpraxen', type: 'apikey', status: 'coming_soon', desc: 'Praxissoftware fuer Patientendaten und Termine.' },
  { provider: 'samedi', label: 'Samedi', icon: '🩺', category: 'Arztpraxen', type: 'apikey', status: 'coming_soon', desc: 'Terminmanagement fuer Arztpraxen und Kliniken.' },
  // Hotels & Gastro
  { provider: 'apaleo', label: 'Apaleo PMS', icon: '🏨', category: 'Hotels & Gastro', type: 'oauth', status: 'available', desc: 'Reservierungspruefung und Gaesteinformationen.' },
  { provider: 'aleno', label: 'aleno', icon: '🍽️', category: 'Hotels & Gastro', type: 'apikey', status: 'available', desc: 'Tischreservierungen per Telefon.', apiHelp: 'API-Key im Dashboard unter Einstellungen > API.' },
  { provider: 'opentable', label: 'OpenTable', icon: '🛎️', category: 'Hotels & Gastro', type: 'oauth', status: 'available', desc: 'Restaurantreservierungen waehrend des Anrufs.' },
  // E-Commerce & ERP
  { provider: 'shopify', label: 'Shopify', icon: '🛒', category: 'E-Commerce & ERP', type: 'apikey', status: 'available', desc: 'Bestellungen und Kundendaten abfragen.', apiHelp: 'API-Key unter Apps > App entwickeln.', extraField: 'Shop-URL', extraPlaceholder: 'dein-shop.myshopify.com' },
  { provider: 'jtl', label: 'JTL Wawi', icon: '📦', category: 'E-Commerce & ERP', type: 'apikey', status: 'available', desc: 'Bestellstatus, Lagerbestaende und Kundendaten.', apiHelp: 'API unter Globale Einstellungen > API.' },
  { provider: 'woocommerce', label: 'WooCommerce', icon: '🛍️', category: 'E-Commerce & ERP', type: 'apikey', status: 'available', desc: 'Bestellungen, Produkte und Kundendaten.', apiHelp: 'API-Key unter Einstellungen > Erweitert > REST-API.', extraField: 'Shop-URL', extraPlaceholder: 'https://dein-shop.de' },
  { provider: 'sap', label: 'SAP', icon: '🏢', category: 'E-Commerce & ERP', type: 'apikey', status: 'available', desc: 'Kundenstammdaten, Auftraege und Materialbestaende.', apiHelp: 'API-Key aus dem SAP BTP Cockpit.', extraField: 'SAP API Endpunkt', extraPlaceholder: 'https://api.sap.com/...' },
  { provider: 'xentral', label: 'Xentral', icon: '⚙️', category: 'E-Commerce & ERP', type: 'apikey', status: 'available', desc: 'Auftraege, Artikel und Kundendaten.', apiHelp: 'API unter Administration > API.', extraField: 'Xentral-URL', extraPlaceholder: 'https://instanz.xentral.biz' },
  { provider: 'plentymarkets', label: 'Plentymarkets', icon: '📋', category: 'E-Commerce & ERP', type: 'apikey', status: 'available', desc: 'Multi-Channel E-Commerce Daten.', apiHelp: 'API unter Einrichtung > Einstellungen > API.', extraField: 'Plenty-URL', extraPlaceholder: 'https://instanz.plentymarkets-cloud01.com' },
  { provider: 'shopware', label: 'Shopware', icon: '🛒', category: 'E-Commerce & ERP', type: 'apikey', status: 'available', desc: 'Shopware 6 API fuer Bestellungen und Kunden.', apiHelp: 'Unter Einstellungen > System > Integrationen.', extraField: 'Shop-URL', extraPlaceholder: 'https://dein-shop.de' },
  // Buchhaltung
  { provider: 'lexoffice', label: 'Lexoffice', icon: '📒', category: 'Buchhaltung', type: 'apikey', status: 'available', desc: 'Rechnungsdaten und Kundenstammdaten.', apiHelp: 'API-Key unter Einstellungen > Oeffentliche API.' },
  { provider: 'sevdesk', label: 'sevDesk', icon: '🧾', category: 'Buchhaltung', type: 'apikey', status: 'available', desc: 'Rechnungen, Kontakte und Buchungsdaten.', apiHelp: 'API-Token unter Einstellungen > Benutzer > API-Token.' },
  // Marketing
  { provider: 'mailchimp', label: 'Mailchimp', icon: '📧', category: 'Marketing & Lead-Gen', type: 'apikey', status: 'available', desc: 'Anrufer als Kontakte in Mailchimp-Listen.', apiHelp: 'API-Key unter Account > Extras > API Keys.' },
  { provider: 'activecampaign', label: 'ActiveCampaign', icon: '🎯', category: 'Marketing & Lead-Gen', type: 'apikey', status: 'available', desc: 'Kontakte erstellen und Automations starten.', apiHelp: 'API-Key unter Settings > Developer.', extraField: 'Account-URL', extraPlaceholder: 'https://account.activehosted.com' },
  { provider: 'klaviyo', label: 'Klaviyo', icon: '🎹', category: 'Marketing & Lead-Gen', type: 'apikey', status: 'available', desc: 'Anrufdaten fuer personalisierte Kampagnen.', apiHelp: 'API-Key unter Account > Settings > API Keys.' },
  { provider: 'klicktipp', label: 'Klick-Tipp', icon: '✉️', category: 'Marketing & Lead-Gen', type: 'apikey', status: 'available', desc: 'Kontakte taggen basierend auf Anrufinhalten.', apiHelp: 'API unter Mein Account > API.' },
  { provider: 'typeform', label: 'Typeform', icon: '📝', category: 'Marketing & Lead-Gen', type: 'oauth', status: 'available', desc: 'Typeform-Antworten als Kontext fuer Anrufe.' },
  { provider: 'meta_lead_ads', label: 'Meta Lead Ads', icon: '📱', category: 'Marketing & Lead-Gen', type: 'oauth', status: 'available', desc: 'Leads importieren und automatische Rueckrufe.' },
  // Support
  { provider: 'zendesk', label: 'Zendesk', icon: '🎫', category: 'Support & Tickets', type: 'apikey', status: 'available', desc: 'Tickets erstellen und bestehende pruefen.', apiHelp: 'API-Token unter Admin > Channels > API.', extraField: 'Subdomain', extraPlaceholder: 'firma.zendesk.com' },
  { provider: 'freshdesk', label: 'Freshdesk', icon: '💬', category: 'Support & Tickets', type: 'apikey', status: 'available', desc: 'Ticket-Erstellung und Kundenlookup.', apiHelp: 'API-Key unter Profil > API-Key.', extraField: 'Domain', extraPlaceholder: 'firma.freshdesk.com' },
  { provider: 'jira', label: 'Jira', icon: '🐛', category: 'Support & Tickets', type: 'apikey', status: 'available', desc: 'Jira-Issues erstellen oder Status pruefen.', apiHelp: 'API-Token unter id.atlassian.com > Sicherheit.', extraField: 'Jira-URL', extraPlaceholder: 'https://firma.atlassian.net' },
  { provider: 'autotask', label: 'Autotask', icon: '🔧', category: 'Support & Tickets', type: 'apikey', status: 'available', desc: 'PSA-Integration fuer IT-Dienstleister.', apiHelp: 'API unter Admin > Extensions > Other APIs.' },
  // Kommunikation
  { provider: 'slack', label: 'Slack', icon: '💬', category: 'Kommunikation', type: 'oauth', status: 'available', desc: 'Anrufzusammenfassungen in Slack-Channels.' },
  { provider: 'teams', label: 'Microsoft Teams', icon: '👥', category: 'Kommunikation', type: 'oauth', status: 'available', desc: 'Benachrichtigungen in Microsoft Teams.' },
  { provider: 'discord', label: 'Discord', icon: '🎮', category: 'Kommunikation', type: 'webhook', status: 'available', desc: 'Anruf-Benachrichtigungen per Discord Webhook.' },
  { provider: 'email_gateway', label: 'E-Mail-Gateway', icon: '✉️', category: 'Kommunikation', type: 'apikey', status: 'available', desc: 'E-Mails senden – Terminbestaetigungen, Zusammenfassungen.', apiHelp: 'SMTP-Zugangsdaten oder SendGrid/Mailgun API-Key.', extraField: 'SMTP-Server / API-URL', extraPlaceholder: 'smtp.provider.de' },
  { provider: 'sms_gateway', label: 'SMS-Gateway', icon: '📱', category: 'Kommunikation', type: 'apikey', status: 'available', desc: 'SMS senden – Terminbestaetigung, Infos per SMS.', apiHelp: 'API-Key deines SMS-Providers (Twilio, sipgate, seven.io).', extraField: 'Absender-Nummer', extraPlaceholder: '+49...' },
  // Datenbanken
  { provider: 'airtable', label: 'Airtable', icon: '🗃️', category: 'Datenbanken', type: 'apikey', status: 'available', desc: 'Daten in Airtable-Bases lesen und schreiben.', apiHelp: 'Personal Access Token unter airtable.com/account.', extraField: 'Base-ID', extraPlaceholder: 'appXXXXXXXXXX' },
  { provider: 'google_sheets', label: 'Google Sheets', icon: '📊', category: 'Datenbanken', type: 'oauth', status: 'available', desc: 'Google Sheets als Datenquelle fuer Preise, FAQ, Kontakte.' },
  { provider: 'sql_db', label: 'SQL-Datenbanken', icon: '🗄️', category: 'Datenbanken', type: 'apikey', status: 'available', desc: 'MySQL, PostgreSQL oder MSSQL verbinden.', apiHelp: 'Verbindungsstring (Host, Port, Benutzername, DB-Name).', extraField: 'Host:Port', extraPlaceholder: 'db.example.com:5432' },
  { provider: 'google_maps', label: 'Google Maps API', icon: '📍', category: 'Datenbanken', type: 'apikey', status: 'available', desc: 'Standortsuche und Entfernungsberechnung.', apiHelp: 'Google Maps API-Key aus der Cloud Console.' },
  // Projektmanagement
  { provider: 'notion', label: 'Notion', icon: '📓', category: 'Projektmanagement', type: 'oauth', status: 'available', desc: 'Notion-Datenbanken nutzen und Eintraege erstellen.' },
  { provider: 'monday', label: 'monday.com', icon: '📋', category: 'Projektmanagement', type: 'apikey', status: 'available', desc: 'Items in monday.com Boards erstellen.', apiHelp: 'API-Key unter Profilbild > Admin > API.' },
  // Automatisierung
  { provider: 'zapier', label: 'Zapier', icon: '⚡', category: 'Automatisierung', type: 'webhook', status: 'available', desc: '5000+ Apps ueber Zapier Webhooks verbinden.' },
  { provider: 'make', label: 'Make', icon: '🔧', category: 'Automatisierung', type: 'webhook', status: 'available', desc: 'Komplexe Automatisierungen mit Make erstellen.' },
  { provider: 'n8n', label: 'n8n', icon: '🔗', category: 'Automatisierung', type: 'webhook', status: 'available', desc: 'Self-hosted Automatisierung mit voller Datenkontrolle.' },
  // Sonderfunktionen
  { provider: 'live_web', label: 'Live-Websuche', icon: '🌐', category: 'Sonderfunktionen', type: 'apikey', status: 'available', desc: 'Waehrend des Telefonats live im Web suchen.', apiHelp: 'Such-API-Key (Google Custom Search oder SerpAPI).' },
  { provider: 'woasi', label: 'woasi', icon: '🏔️', category: 'Sonderfunktionen', type: 'apikey', status: 'coming_soon', desc: 'Regionale Auskunftsdienste und lokale Informationen.' },
];

let connActiveCategory = 'Alle';
let connSearchQuery = '';
let connConnected = [];
let connCurrentProvider = null;

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function getConnCategories() {
  const cats = [...new Set(CONNECTORS.map(c => c.category))];
  return cats;
}

function initConnectorTab() {
  const select = document.getElementById('connCategoryFilter');
  const cats = getConnCategories();
  select.innerHTML = '<option value="Alle">Alle Kategorien</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join('');
  loadConnectors();
}

function filterConnectors() {
  connSearchQuery = (document.getElementById('connSearchInput').value || '').toLowerCase().trim();
  connActiveCategory = document.getElementById('connCategoryFilter').value;
  renderConnectors();
}

function getFilteredConnectors() {
  return CONNECTORS.filter(c => {
    const matchCat = connActiveCategory === 'Alle' || c.category === connActiveCategory;
    const matchSearch = !connSearchQuery ||
      c.label.toLowerCase().includes(connSearchQuery) ||
      c.category.toLowerCase().includes(connSearchQuery) ||
      c.provider.toLowerCase().includes(connSearchQuery) ||
      (c.desc || '').toLowerCase().includes(connSearchQuery);
    return matchCat && matchSearch;
  });
}

function renderConnectors() {
  const connProviders = connConnected.map(c => c.provider);

  // Connected section
  const connSection = document.getElementById('connConnectedSection');
  if (connConnected.length > 0) {
    connSection.style.display = 'block';
    document.getElementById('connConnectedCount').textContent = connConnected.length;
    document.getElementById('connConnectedGrid').innerHTML = connConnected.map(c => {
      const def = CONNECTORS.find(d => d.provider === c.provider) || {};
      const cfg = c.config || {};
      const typeLabel = cfg.type === 'sip' ? 'SIP' : cfg.type === 'webhook' ? 'Webhook' : cfg.type === 'apikey' ? 'API-Key' : cfg.type === 'oauth' ? 'OAuth' : cfg.type === 'forward' ? 'Rufumleitung' : '';
      return `<div style="display:flex;align-items:center;gap:14px;padding:14px 16px;background:var(--bg3);border:1px solid rgba(74,222,128,.25);border-radius:12px;cursor:pointer;transition:all .2s;"
        onclick="openConnModal('${c.provider}')"
        onmouseover="this.style.borderColor='rgba(74,222,128,.5)'" onmouseout="this.style.borderColor='rgba(74,222,128,.25)'">
        <span style="font-size:1.3rem;">${def.icon || '🔗'}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:700;color:var(--tx);">${escHtml(c.provider_label || c.provider)}</div>
          <div style="font-size:11px;color:var(--tx3);">${escHtml(c.category || '')} · ${typeLabel} · Verbunden seit ${c.connected_at ? new Date(c.connected_at).toLocaleDateString('de-DE') : '–'}</div>
        </div>
        <span style="font-size:10px;background:rgba(74,222,128,.15);color:var(--green);padding:4px 10px;border-radius:12px;font-weight:600;">Aktiv</span>
      </div>`;
    }).join('');
  } else {
    connSection.style.display = 'none';
  }

  // Available section
  const filtered = getFilteredConnectors();
  const available = filtered.filter(c => !connProviders.includes(c.provider));
  document.getElementById('connAvailableLabel').textContent = 'Verfuegbar (' + available.length + ')';

  if (available.length === 0) {
    document.getElementById('connAvailableGrid').innerHTML = '<div style="text-align:center;padding:20px;color:var(--tx3);font-size:13px;">Keine weiteren Connectoren gefunden.</div>';
    return;
  }

  document.getElementById('connAvailableGrid').innerHTML = available.map(c => {
    const badge = c.status === 'coming_soon'
      ? '<span style="font-size:10px;background:rgba(251,146,60,.15);color:var(--orange);padding:4px 10px;border-radius:12px;font-weight:600;">Bald</span>'
      : '<span style="font-size:10px;background:rgba(124,58,237,.15);color:var(--pu3);padding:4px 10px;border-radius:12px;font-weight:600;">Verbinden</span>';
    return `<div style="display:flex;align-items:center;gap:14px;padding:12px 16px;background:var(--bg3);border:1px solid var(--border);border-radius:12px;cursor:pointer;transition:all .2s;"
      onclick="openConnModal('${c.provider}')"
      onmouseover="this.style.borderColor='var(--border2)'" onmouseout="this.style.borderColor='var(--border)'">
      <span style="font-size:1.3rem;">${c.icon}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:700;color:var(--tx);">${c.label}</div>
        <div style="font-size:11px;color:var(--tx3);">${c.category}</div>
      </div>
      ${badge}
    </div>`;
  }).join('');
}

async function loadConnectors() {
  if (!currentUser) return;
  try {
    const { data } = await supabaseClient.from('integrations').select('*').eq('user_id', currentUser.id);
    connConnected = data || [];
  } catch (e) {
    connConnected = [];
  }
  renderConnectors();
}

function openConnModal(provider) {
  const def = CONNECTORS.find(c => c.provider === provider);
  if (!def) return;
  connCurrentProvider = def;

  document.getElementById('connModalIcon').textContent = def.icon;
  document.getElementById('connModalTitle').textContent = def.label;
  document.getElementById('connModalCategory').textContent = def.category;
  document.getElementById('connModalDesc').textContent = def.desc || '';

  const isConnected = connConnected.some(c => c.provider === provider);
  document.getElementById('connDisconnectSection').style.display = isConnected ? 'block' : 'none';

  ['connFormOAuth','connFormApiKey','connFormWebhook','connFormSip','connFormForward','connFormInfo'].forEach(id => {
    document.getElementById(id).style.display = 'none';
  });

  if (def.status === 'coming_soon') {
    document.getElementById('connFormInfo').style.display = 'block';
  } else if (def.type === 'oauth') {
    document.getElementById('connFormOAuth').style.display = 'block';
    document.getElementById('connOAuthName').textContent = def.label;
    document.getElementById('connOAuthBtn').textContent = def.label;
  } else if (def.type === 'apikey') {
    document.getElementById('connFormApiKey').style.display = 'block';
    document.getElementById('connApiKeyInput').value = '';
    document.getElementById('connApiKeyHelp').textContent = def.apiHelp || 'Gib den API-Key des Anbieters ein.';
    if (def.extraField) {
      document.getElementById('connApiKeyExtra').style.display = 'flex';
      document.getElementById('connApiKeyExtraLabel').textContent = def.extraField;
      document.getElementById('connApiKeyExtraInput').placeholder = def.extraPlaceholder || '';
      document.getElementById('connApiKeyExtraInput').value = '';
    } else {
      document.getElementById('connApiKeyExtra').style.display = 'none';
    }
  } else if (def.type === 'webhook') {
    document.getElementById('connFormWebhook').style.display = 'block';
    const wid = crypto.randomUUID ? crypto.randomUUID().slice(0, 12) : Math.random().toString(36).slice(2, 14);
    document.getElementById('connWebhookUrl').value = 'https://api.call-lana.de/webhooks/' + def.provider + '/' + wid;
    document.getElementById('connWebhookSecret').value = 'whsec_' + Array.from(crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2, '0')).join('');
    document.getElementById('connWebhookHelp').textContent =
      def.provider === 'zapier' ? 'Trage die Webhook-URL als "Catch Hook" in deinem Zap ein.' :
      def.provider === 'make' ? 'Nutze die Webhook-URL als Custom Webhook Trigger in Make.' :
      def.provider === 'n8n' ? 'Verwende die Webhook-URL als Webhook-Node Trigger in n8n.' :
      def.provider === 'discord' ? 'Trage die URL als Webhook-URL in deinem Discord-Server ein.' :
      'Trage die Webhook-URL und das Secret in deinem System ein.';
  } else if (def.type === 'sip') {
    document.getElementById('connFormSip').style.display = 'block';
    document.getElementById('connSipServer').value = '';
    document.getElementById('connSipUser').value = '';
    document.getElementById('connSipPass').value = '';
    document.getElementById('connSipPort').value = '';
    document.getElementById('connSipServer').placeholder = def.provider === 'fritzbox' ? 'fritz.box oder 192.168.178.1' : 'z.B. sip.sipgate.de';
  } else if (def.type === 'forward') {
    document.getElementById('connFormForward').style.display = 'block';
    document.getElementById('connForwardNumber').value = '+49 30 XXXX XXXX';
    document.getElementById('connForwardHelp').textContent = def.provider === 'eigene_rufnummer'
      ? 'Du erhaeltst eine eigene Rufnummer, die direkt an Call Lana weiterleitet.'
      : 'Richte bei deinem Telefonanbieter eine Rufumleitung auf diese Nummer ein.';
  }

  document.getElementById('connModal').style.display = 'flex';
}

function closeConnModal() {
  document.getElementById('connModal').style.display = 'none';
  connCurrentProvider = null;
}

async function connSaveRecord(provider, label, category, config) {
  if (!currentUser) { showToast('Nicht eingeloggt.', true); return; }
  try {
    const { error } = await supabaseClient.from('integrations').upsert({
      user_id: currentUser.id,
      provider: provider,
      provider_label: label,
      category: category,
      status: 'connected',
      config: config,
      connected_at: new Date().toISOString()
    }, { onConflict: 'user_id,provider' });
    if (error) throw error;
    showToast(label + ' erfolgreich verbunden!');
    await loadConnectors();
  } catch (err) {
    Logger.error('connSaveRecord', err);
    showToast('Verbindung fehlgeschlagen. Bitte versuchen Sie es erneut.', true);
  }
}

async function connStartOAuth() {
  if (!connCurrentProvider) return;
  showToast(connCurrentProvider.label + ': OAuth-Weiterleitung wird vorbereitet...');
  await connSaveRecord(connCurrentProvider.provider, connCurrentProvider.label, connCurrentProvider.category, { type: 'oauth' });
  closeConnModal();
}

async function connSaveApiKey() {
  if (!connCurrentProvider) return;
  const key = document.getElementById('connApiKeyInput').value.trim();
  if (!key || key.length < 8) { showToast('Bitte einen gueltigen API-Key eingeben.', true); return; }
  const extra = document.getElementById('connApiKeyExtraInput')?.value.trim() || '';

  // SECURITY: API key must be encrypted server-side via Edge Function.
  // Only the masked last4 is stored client-side for display.
  try {
    const { data: encResult, error: encError } = await supabaseClient.functions.invoke('encrypt-secret', {
      body: { provider: connCurrentProvider.provider, secret: key }
    });
    if (encError) throw encError;

    await connSaveRecord(connCurrentProvider.provider, connCurrentProvider.label, connCurrentProvider.category, {
      type: 'apikey',
      api_key_last4: '...' + key.slice(-4),
      extra_field: extra || null,
      encrypted_key_ref: encResult?.ref || null
    });
  } catch (err) {
    // Fallback: store only metadata, no secret. Edge Function not yet deployed.
    Logger.error('connSaveApiKey.encrypt', err);
    await connSaveRecord(connCurrentProvider.provider, connCurrentProvider.label, connCurrentProvider.category, {
      type: 'apikey',
      api_key_last4: '...' + key.slice(-4),
      extra_field: extra || null,
      encrypted_key_ref: null
    });
    showToast('Verbunden (Key wird lokal nicht gespeichert bis Verschluesselung aktiv).', false);
  }
  closeConnModal();
}

async function connActivateWebhook() {
  if (!connCurrentProvider) return;
  await connSaveRecord(connCurrentProvider.provider, connCurrentProvider.label, connCurrentProvider.category, {
    type: 'webhook', webhook_url: document.getElementById('connWebhookUrl').value
  });
  closeConnModal();
}

function connCopyWebhook() {
  navigator.clipboard.writeText(document.getElementById('connWebhookUrl').value)
    .then(() => showToast('Webhook-URL kopiert!')).catch(() => showToast('Kopieren fehlgeschlagen', true));
}

function connToggleSecret() {
  const f = document.getElementById('connWebhookSecret');
  f.type = f.type === 'password' ? 'text' : 'password';
}

async function connSaveSip() {
  if (!connCurrentProvider) return;
  const server = document.getElementById('connSipServer').value.trim();
  const user = document.getElementById('connSipUser').value.trim();
  const pass = document.getElementById('connSipPass').value.trim();
  if (!server || !user) { showToast('SIP-Server und Benutzername erforderlich.', true); return; }

  // SECURITY: SIP password must be encrypted server-side via Edge Function.
  // Only non-sensitive connection metadata is stored client-side.
  let encryptedRef = null;
  if (pass) {
    try {
      const { data: encResult, error: encError } = await supabaseClient.functions.invoke('encrypt-secret', {
        body: { provider: connCurrentProvider.provider, secret: pass }
      });
      if (!encError) encryptedRef = encResult?.ref;
    } catch (err) {
      Logger.error('connSaveSip.encrypt', err);
    }
  }

  await connSaveRecord(connCurrentProvider.provider, connCurrentProvider.label, connCurrentProvider.category, {
    type: 'sip',
    sip_server: server,
    sip_user: user,
    sip_port: document.getElementById('connSipPort').value.trim() || '5060',
    encrypted_pass_ref: encryptedRef
  });
  closeConnModal();
}

async function connActivateForward() {
  if (!connCurrentProvider) return;
  await connSaveRecord(connCurrentProvider.provider, connCurrentProvider.label, connCurrentProvider.category, {
    type: 'forward', forward_number: document.getElementById('connForwardNumber').value
  });
  closeConnModal();
}

function connCopyForward() {
  navigator.clipboard.writeText(document.getElementById('connForwardNumber').value)
    .then(() => showToast('Rufnummer kopiert!')).catch(() => showToast('Kopieren fehlgeschlagen', true));
}

function connNotifyReady() {
  if (!connCurrentProvider) return;
  showToast('Du wirst benachrichtigt, sobald ' + connCurrentProvider.label + ' verfuegbar ist.');
  closeConnModal();
}

async function connDisconnect() {
  if (!connCurrentProvider || !currentUser) return;
  if (!confirm('Connector "' + connCurrentProvider.label + '" wirklich trennen?')) return;
  try {
    await supabaseClient.from('integrations').delete()
      .eq('user_id', currentUser.id).eq('provider', connCurrentProvider.provider);
    showToast(connCurrentProvider.label + ' getrennt.');
    closeConnModal();
    await loadConnectors();
  } catch (err) {
    Logger.error('connDisconnect', err);
    showToast('Trennung fehlgeschlagen. Bitte versuchen Sie es erneut.', true);
  }
}

// Close modal on overlay click
document.getElementById('connModal')?.addEventListener('click', function(e) {
  if (e.target === this) closeConnModal();
});

// ==========================================
// TAB NAVIGATION
// ==========================================
document.querySelectorAll('.sn-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    document.querySelectorAll('.sn-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    const tab = item.dataset.tab;
    document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
    document.getElementById('tab-' + tab).style.display = 'block';
    if (tab === 'connectors') initConnectorTab();
    if (typeof SettingsExtra !== 'undefined') SettingsExtra.initTab(tab);
    window.location.hash = tab;
  });
});

// Open tab from URL hash
(function() {
  const hash = window.location.hash.replace('#', '');
  if (hash) {
    const tabEl = document.getElementById('tab-' + hash);
    if (tabEl) {
      document.querySelectorAll('.sn-item').forEach(i => i.classList.remove('active'));
      const navItem = document.querySelector('.sn-item[data-tab="' + hash + '"]');
      if (navItem) navItem.classList.add('active');
      document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
      tabEl.style.display = 'block';
      if (hash === 'connectors') initConnectorTab();
      if (typeof SettingsExtra !== 'undefined') SettingsExtra.initTab(hash);
    }
  }
})();

// Logout is handled via sidebar-logout in init()

// ==========================================
// MOBILE SIDEBAR (hamburger extra, sidebar close handled by Components)
// ==========================================
document.getElementById('hamburgerBtn')?.addEventListener('click', () => {
  document.querySelector('.sidebar')?.classList.add('open');
  document.getElementById('sidebarOverlay')?.classList.add('open');
});
document.getElementById('sidebarOverlay')?.addEventListener('click', () => {
  document.querySelector('.sidebar')?.classList.remove('open');
  document.getElementById('sidebarOverlay')?.classList.remove('open');
});
