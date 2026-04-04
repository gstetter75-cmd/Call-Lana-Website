// ==========================================
// Settings Extra: Emergency, Calendar, Forwarding, Add-Ons
// Depends on: supabase-init.js, auth.js, db.js
// ==========================================

const SettingsExtra = {

  // ==========================================
  // EMERGENCY CONFIG (Spec §4.4)
  // ==========================================

  async loadEmergency() {
    try {
      const res = await clanaDB.getSettings();
      if (!res.success) return;
      const s = res.data || {};
      const el = (id) => document.getElementById(id);
      if (el('emergencyPhone')) el('emergencyPhone').value = s.emergency_phone || '';
      if (el('emergencyChannel')) el('emergencyChannel').value = s.alert_channel || 'sms';
      if (el('emergencyKeywords')) el('emergencyKeywords').value = (s.emergency_keywords || []).join(', ');
      if (el('emergencyActive') && s.emergency_active === false) el('emergencyActive').classList.remove('on');
    } catch (e) { /* ignore */ }
  },

  async saveEmergency() {
    const el = (id) => document.getElementById(id);
    const phone = (el('emergencyPhone')?.value || '').trim();
    const channel = el('emergencyChannel')?.value || 'sms';
    const keywords = (el('emergencyKeywords')?.value || '').split(',').map(k => k.trim()).filter(Boolean);
    const active = el('emergencyActive')?.classList.contains('on') ?? true;

    if (!phone) {
      const err = el('emergency-err');
      if (err) err.textContent = 'Bitte gib eine Notfall-Nummer ein.';
      return;
    }

    try {
      const res = await clanaDB.getSettings();
      const current = res.success ? res.data : {};
      const updated = Object.assign({}, current, {
        emergency_phone: phone,
        alert_channel: channel,
        emergency_keywords: keywords,
        emergency_active: active
      });
      await clanaDB.saveSettings(updated);
      if (typeof showToast !== 'undefined') showToast('Notfall-Einstellungen gespeichert.');
    } catch (e) {
      const err = el('emergency-err');
      if (err) err.textContent = 'Fehler beim Speichern.';
    }
  },

  // ==========================================
  // CALENDAR CONFIG (Spec §4.4)
  // ==========================================

  async loadCalendar() {
    try {
      const res = await clanaDB.getSettings();
      if (!res.success) return;
      const s = res.data || {};
      const el = (id) => document.getElementById(id);

      if (s.calendar_id) {
        const sanitize = typeof clanaUtils !== 'undefined' ? clanaUtils.sanitizeHtml : (x) => x;
        if (el('calendarStatus')) {
          el('calendarStatus').className = 'info-box';
          el('calendarStatus').innerHTML = '✅ Verbunden mit <strong>' + sanitize(s.calendar_id || 'Google Kalender') + '</strong>';
        }
        if (el('btnConnectCalendar')) el('btnConnectCalendar').textContent = 'Kalender trennen';
      }

      if (el('slotDuration') && s.slot_durations) el('slotDuration').value = s.slot_durations;
      if (el('bookingWindow') && s.booking_window_days) el('bookingWindow').value = s.booking_window_days;
      if (el('bookingStart') && s.booking_start) el('bookingStart').value = s.booking_start;
      if (el('bookingEnd') && s.booking_end) el('bookingEnd').value = s.booking_end;
    } catch (e) { /* ignore */ }
  },

  connectCalendar() {
    // OAuth flow placeholder — requires Google Cloud project setup
    if (typeof showToast !== 'undefined') {
      showToast('Google Kalender OAuth wird in Kürze verfügbar sein.');
    }
  },

  async saveCalendar() {
    const el = (id) => document.getElementById(id);
    try {
      const res = await clanaDB.getSettings();
      const current = res.success ? res.data : {};
      const slotDur = parseInt(el('slotDuration')?.value || '30') || 30;
      const bookingWin = parseInt(el('bookingWindow')?.value || '14') || 14;
      const updated = Object.assign({}, current, {
        slot_durations: Math.max(5, Math.min(120, slotDur)),
        booking_window_days: Math.max(1, Math.min(90, bookingWin)),
        booking_start: el('bookingStart')?.value || '08:00',
        booking_end: el('bookingEnd')?.value || '18:00'
      });
      await clanaDB.saveSettings(updated);
      if (typeof showToast !== 'undefined') showToast('Kalender-Einstellungen gespeichert.');
    } catch (e) {
      const err = el('calendar-err');
      if (err) err.textContent = 'Fehler beim Speichern.';
    }
  },

  // ==========================================
  // FORWARDING RULES (Spec §4.4)
  // ==========================================

  _rules: [],

  async loadForwardingRules() {
    try {
      const user = await auth.getUser();
      if (!user) return;

      const { data, error } = await supabaseClient
        .from('forwarding_rules')
        .select('*')
        .order('priority', { ascending: true });

      if (error) {
        // Table may not exist yet — show empty state
        this._rules = [];
      } else {
        this._rules = data || [];
      }
    } catch (e) {
      this._rules = [];
    }
    this._renderRules();
  },

  _renderRules() {
    const container = document.getElementById('forwardingRules');
    if (!container) return;

    const sanitize = typeof clanaUtils !== 'undefined' ? clanaUtils.sanitizeHtml : (s) => s;

    if (!this._rules.length) {
      container.innerHTML = '<div style="color:var(--tx3);font-size:13px;text-align:center;padding:24px;">Keine Weiterleitungsregeln konfiguriert.</div>';
      return;
    }

    let html = '';
    this._rules.forEach((r, i) => {
      const keyword = sanitize(r.keyword || '–');
      const target = sanitize(r.target_name || r.target_phone || '–');
      const phone = sanitize(r.target_phone || '');
      html += '<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border);">' +
        '<span style="font-size:13px;font-weight:700;color:var(--pu);min-width:24px;">#' + (i + 1) + '</span>' +
        '<div style="flex:1;">' +
          '<div style="font-size:13px;font-weight:600;">Keyword: <span style="color:var(--tx);">' + keyword + '</span></div>' +
          '<div style="font-size:12px;color:var(--tx3);">→ ' + target + (phone ? ' (' + phone + ')' : '') + '</div>' +
        '</div>' +
        '<button class="btn-secondary" style="padding:6px 12px;font-size:11px;" onclick="SettingsExtra.deleteRule(\'' + r.id + '\')">Löschen</button>' +
      '</div>';
    });
    container.innerHTML = html;
  },

  addForwardingRule() {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);z-index:100;display:flex;align-items:center;justify-content:center;';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    overlay.innerHTML = '<div style="background:var(--card);border:1px solid var(--border);border-radius:16px;padding:32px;max-width:480px;width:90%;">' +
      '<h2 style="font-family:Syne,sans-serif;font-size:1.1rem;font-weight:700;margin-bottom:20px;">Neue Weiterleitungsregel</h2>' +
      '<div class="fgrp"><label>Keyword</label><input type="text" class="finp" id="ruleKeyword" placeholder="z.B. Heizung, Notfall"></div>' +
      '<div class="fgrp"><label>Zielname</label><input type="text" class="finp" id="ruleTarget" placeholder="z.B. Herr Müller"></div>' +
      '<div class="fgrp"><label>Telefonnummer</label><input type="tel" class="finp" id="rulePhone" placeholder="+49 170 1234567"></div>' +
      '<div class="fgrp"><label>Priorität</label><select class="finp" id="rulePriority"><option value="1">1 (Höchste)</option><option value="2">2</option><option value="3" selected>3 (Normal)</option><option value="4">4</option><option value="5">5 (Niedrigste)</option></select></div>' +
      '<div style="display:flex;gap:10px;margin-top:16px;">' +
        '<button class="btn-secondary" onclick="this.closest(\'div[style*=fixed]\').remove()">Abbrechen</button>' +
        '<button class="btn-save" onclick="SettingsExtra._saveRule(this)">Regel speichern</button>' +
      '</div>' +
    '</div>';
    document.body.appendChild(overlay);
  },

  async _saveRule(btn) {
    const keyword = document.getElementById('ruleKeyword')?.value?.trim();
    const target = document.getElementById('ruleTarget')?.value?.trim();
    const phone = document.getElementById('rulePhone')?.value?.trim();
    const priority = parseInt(document.getElementById('rulePriority')?.value || '3');

    if (!keyword || !phone) {
      if (typeof showToast !== 'undefined') showToast('Keyword und Telefonnummer sind Pflichtfelder.', true);
      return;
    }

    try {
      const user = await auth.getUser();
      if (!user) return;

      const { error } = await supabaseClient
        .from('forwarding_rules')
        .insert([{ user_id: user.id, keyword, target_name: target, target_phone: phone, priority }]);

      if (error) throw error;

      btn.closest('div[style*=fixed]').remove();
      if (typeof showToast !== 'undefined') showToast('Regel gespeichert.');
      await this.loadForwardingRules();
    } catch (e) {
      if (typeof showToast !== 'undefined') showToast('Fehler beim Speichern.', true);
    }
  },

  async deleteRule(id) {
    if (!confirm('Regel wirklich löschen?')) return;
    try {
      await supabaseClient.from('forwarding_rules').delete().eq('id', id);
      if (typeof showToast !== 'undefined') showToast('Regel gelöscht.');
      await this.loadForwardingRules();
    } catch (e) {
      if (typeof showToast !== 'undefined') showToast('Fehler beim Löschen.', true);
    }
  },

  // ==========================================
  // ADD-ONS (Spec §4.4)
  // ==========================================

  async loadAddons() {
    try {
      const res = await clanaDB.getSettings();
      if (!res.success) return;
      const modules = res.data?.modules || {};
      const toggles = {
        addonWhatsapp: modules.whatsapp,
        addonOutbound: modules.outbound,
        addonReviews: modules.reviews,
        addonLeadScoring: modules.lead_scoring,
        addonSentiment: modules.sentiment
      };
      Object.entries(toggles).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('on', !!val);
      });
    } catch (e) { /* ignore */ }
  },

  async saveAddons() {
    try {
      const modules = {
        whatsapp: document.getElementById('addonWhatsapp')?.classList.contains('on') || false,
        outbound: document.getElementById('addonOutbound')?.classList.contains('on') || false,
        reviews: document.getElementById('addonReviews')?.classList.contains('on') || false,
        lead_scoring: document.getElementById('addonLeadScoring')?.classList.contains('on') || false,
        sentiment: document.getElementById('addonSentiment')?.classList.contains('on') || false
      };
      const res = await clanaDB.getSettings();
      const current = res.success ? res.data : {};
      const updated = Object.assign({}, current, { modules });
      await clanaDB.saveSettings(updated);
      if (typeof showToast !== 'undefined') showToast('Add-Ons gespeichert.');
    } catch (e) {
      if (typeof showToast !== 'undefined') showToast('Fehler beim Speichern.', true);
    }
  },

  // ==========================================
  // INIT — Load all on tab switch
  // ==========================================

  async initTab(tab) {
    switch (tab) {
      case 'emergency': await this.loadEmergency(); break;
      case 'calendar': await this.loadCalendar(); break;
      case 'forwarding': await this.loadForwardingRules(); break;
      case 'addons': await this.loadAddons(); break;
    }
  }
};

window.SettingsExtra = SettingsExtra;
