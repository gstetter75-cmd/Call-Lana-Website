// ==========================================
// Integrations Hub: Stripe, Calendar Sync, SendGrid, File Upload, Twilio
// Frontend preparation — external API keys needed for full functionality
// ==========================================

const IntegrationsHub = {

  // ==========================================
  // STRIPE (Payment Processing)
  // ==========================================

  renderStripeSettings(container) {
    if (!container) return;
    container.innerHTML = `
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;">
        <div style="width:48px;height:48px;border-radius:12px;background:#635bff22;display:flex;align-items:center;justify-content:center;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="#635bff"><path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-7.076-2.18l-.897 5.555C5.014 22.77 7.97 24 11.326 24c2.588 0 4.737-.715 6.217-1.9 1.673-1.32 2.5-3.275 2.5-5.67 0-4.218-2.737-5.95-6.067-7.28z"/></svg>
        </div>
        <div>
          <h3 style="margin:0;font-size:16px;">Stripe</h3>
          <p style="margin:2px 0 0;font-size:12px;color:var(--tx3);">Sichere Zahlungsabwicklung für Abonnements und Einmalzahlungen</p>
        </div>
      </div>
      <div style="background:var(--bg3);border-radius:10px;padding:16px;margin-bottom:12px;">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px;">Status: <span style="color:#f59e0b;">Nicht konfiguriert</span></div>
        <p style="font-size:12px;color:var(--tx3);margin:0;">Für die Stripe-Integration werden API-Keys benötigt. Bitte konfiguriere diese als Supabase Edge Function Secrets:</p>
        <ul style="font-size:12px;color:var(--tx3);margin:8px 0 0;padding-left:20px;">
          <li><code>STRIPE_SECRET_KEY</code> — Stripe Dashboard → API keys</li>
          <li><code>STRIPE_WEBHOOK_SECRET</code> — Stripe Dashboard → Webhooks</li>
        </ul>
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-outline btn-sm" disabled>Stripe verbinden</button>
        <button class="btn btn-outline btn-sm" disabled>Kundenportal öffnen</button>
      </div>
    `;
  },

  // ==========================================
  // CALENDAR SYNC (Google / Outlook / Apple)
  // ==========================================

  renderCalendarSync(container) {
    if (!container) return;
    const providers = [
      { id: 'google', name: 'Google Calendar', icon: '📅', color: '#4285f4', scopes: 'calendar.readonly, calendar.events', setup: 'Google Cloud Console → OAuth 2.0 Client ID' },
      { id: 'outlook', name: 'Microsoft Outlook', icon: '📆', color: '#0078d4', scopes: 'Calendars.ReadWrite', setup: 'Azure Portal → App Registration' },
      { id: 'apple', name: 'Apple Kalender', icon: '🍎', color: '#333', scopes: 'CalDAV', setup: 'App-spezifisches Passwort in iCloud' }
    ];

    container.innerHTML = `
      <h3 style="margin:0 0 16px;font-size:16px;">Kalender-Integration</h3>
      <p style="font-size:12px;color:var(--tx3);margin-bottom:16px;">Verbinde deinen persönlichen Kalender für automatische Verfügbarkeitssynchronisation.</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;">
        ${providers.map(p => `
          <div class="card" style="padding:16px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
              <span style="font-size:24px;">${p.icon}</span>
              <div>
                <div style="font-weight:600;font-size:14px;">${p.name}</div>
                <div style="font-size:11px;color:var(--tx3);">${p.scopes}</div>
              </div>
            </div>
            <div style="background:var(--bg3);border-radius:8px;padding:10px;font-size:11px;color:var(--tx3);margin-bottom:12px;">
              Setup: ${p.setup}
            </div>
            <button class="btn btn-outline btn-sm" disabled style="width:100%;">Verbinden (API-Key benötigt)</button>
          </div>
        `).join('')}
      </div>
    `;
  },

  // ==========================================
  // EMAIL (SendGrid / Resend)
  // ==========================================

  renderEmailSettings(container) {
    if (!container) return;
    container.innerHTML = `
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;">
        <div style="width:48px;height:48px;border-radius:12px;background:#00b4d822;display:flex;align-items:center;justify-content:center;font-size:24px;">✉️</div>
        <div>
          <h3 style="margin:0;font-size:16px;">E-Mail-Versand</h3>
          <p style="margin:2px 0 0;font-size:12px;color:var(--tx3);">Automatischer Versand von Follow-ups, Rechnungen und Benachrichtigungen</p>
        </div>
      </div>
      <div style="background:var(--bg3);border-radius:10px;padding:16px;margin-bottom:12px;">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px;">Status: <span style="color:#f59e0b;">Nicht konfiguriert</span></div>
        <p style="font-size:12px;color:var(--tx3);margin:0;">Empfohlen: <strong>Resend</strong> (einfachste Integration) oder <strong>SendGrid</strong></p>
        <ul style="font-size:12px;color:var(--tx3);margin:8px 0 0;padding-left:20px;">
          <li><code>RESEND_API_KEY</code> — resend.com → API Keys</li>
          <li>Absender-Domain verifizieren</li>
        </ul>
      </div>
      <div style="font-size:12px;color:var(--tx3);">Aktueller Fallback: E-Mails werden als <code>mailto:</code> Links geöffnet (Template-System funktioniert bereits).</div>
    `;
  },

  // ==========================================
  // KNOWLEDGE BASE FILE UPLOAD
  // ==========================================

  renderFileUpload(container) {
    if (!container) return;
    container.innerHTML = `
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;">
        <div style="width:48px;height:48px;border-radius:12px;background:#10b98122;display:flex;align-items:center;justify-content:center;font-size:24px;">📁</div>
        <div>
          <h3 style="margin:0;font-size:16px;">Wissensdatenbank</h3>
          <p style="margin:2px 0 0;font-size:12px;color:var(--tx3);">Lade Dokumente hoch, die deine KI-Assistenten als Wissensbasis nutzen</p>
        </div>
      </div>
      <div style="background:var(--bg3);border-radius:10px;padding:16px;margin-bottom:12px;">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px;">Status: <span style="color:#f59e0b;">Supabase Storage benötigt</span></div>
        <p style="font-size:12px;color:var(--tx3);margin:0;">Schritte zur Aktivierung:</p>
        <ol style="font-size:12px;color:var(--tx3);margin:8px 0 0;padding-left:20px;">
          <li>Supabase Dashboard → Storage → Neuen Bucket "knowledge-base" erstellen</li>
          <li>RLS-Policy: Nur eigene Dateien (auth.uid() = owner)</li>
          <li>Erlaubte Typen: PDF, DOCX, TXT, MD (max 10MB)</li>
        </ol>
      </div>
      <div id="kb-upload-area" style="border:2px dashed var(--border);border-radius:12px;padding:30px;text-align:center;cursor:pointer;transition:border-color .2s;" onmouseenter="this.style.borderColor='var(--pu)'" onmouseleave="this.style.borderColor='var(--border)'" onclick="document.getElementById('kb-file-input').click()">
        <input type="file" id="kb-file-input" style="display:none;" accept=".pdf,.docx,.txt,.md" onchange="IntegrationsHub.handleFileUpload(this)">
        <div style="font-size:28px;margin-bottom:8px;">📄</div>
        <div style="font-size:13px;font-weight:600;">Datei hierher ziehen oder klicken</div>
        <div style="font-size:11px;color:var(--tx3);margin-top:4px;">PDF, DOCX, TXT, MD — max. 10 MB</div>
      </div>
      <div id="kb-file-list" style="margin-top:12px;"></div>
    `;
  },

  async handleFileUpload(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { Components.toast('Datei zu groß (max. 10 MB)', 'error'); return; }

    try {
      const user = await clanaAuth.getUser();
      if (!user) throw new Error('Not authenticated');

      const path = `${user.id}/${Date.now()}_${file.name}`;
      const { error } = await supabaseClient.storage.from('knowledge-base').upload(path, file);

      if (error) throw error;
      Components.toast('Datei hochgeladen: ' + file.name, 'success');
      this.loadFileList(user.id);
    } catch (err) {
      Components.toast('Upload fehlgeschlagen: ' + (err.message || 'Bucket existiert möglicherweise nicht'), 'error');
    }
    input.value = '';
  },

  async loadFileList(userId) {
    const list = document.getElementById('kb-file-list');
    if (!list) return;
    try {
      const { data, error } = await supabaseClient.storage.from('knowledge-base').list(userId);
      if (error) throw error;
      if (!data?.length) { list.innerHTML = '<div style="color:var(--tx3);font-size:12px;">Keine Dateien hochgeladen.</div>'; return; }

      list.innerHTML = data.map(f => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);font-size:12px;">
          <span>📄 ${clanaUtils.sanitizeHtml(f.name)}</span>
          <span style="color:var(--tx3);">${(f.metadata?.size / 1024).toFixed(1)} KB</span>
        </div>
      `).join('');
    } catch (e) {
      list.innerHTML = '<div style="color:var(--tx3);font-size:12px;">Storage-Bucket nicht verfügbar.</div>';
    }
  },

  // ==========================================
  // TWILIO / PHONE NUMBERS
  // ==========================================

  renderPhoneSettings(container) {
    if (!container) return;
    container.innerHTML = `
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;">
        <div style="width:48px;height:48px;border-radius:12px;background:#f2282222;display:flex;align-items:center;justify-content:center;font-size:24px;">📞</div>
        <div>
          <h3 style="margin:0;font-size:16px;">Telefonnummern (Twilio)</h3>
          <p style="margin:2px 0 0;font-size:12px;color:var(--tx3);">Echte Telefonnummern für deine KI-Assistenten kaufen und verwalten</p>
        </div>
      </div>
      <div style="background:var(--bg3);border-radius:10px;padding:16px;">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px;">Status: <span style="color:#f59e0b;">Nicht konfiguriert</span></div>
        <p style="font-size:12px;color:var(--tx3);margin:0;">Für Telefonnummern-Management wird ein Twilio-Account benötigt:</p>
        <ul style="font-size:12px;color:var(--tx3);margin:8px 0 0;padding-left:20px;">
          <li><code>TWILIO_ACCOUNT_SID</code></li>
          <li><code>TWILIO_AUTH_TOKEN</code></li>
          <li>Deutsche Nummern: +49 Prefix, regulatorische Anforderungen beachten</li>
        </ul>
      </div>
    `;
  }
};

window.IntegrationsHub = IntegrationsHub;
