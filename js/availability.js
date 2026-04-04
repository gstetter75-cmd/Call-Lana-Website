// ==========================================
// Enhanced Availability: Working Hours, Vacation, Team View
// Depends on: db.js, config.js, dashboard-components.js
// ==========================================

const AvailabilityModule = {
  currentSubTab: 'calendar',
  workingHours: [],
  timeOffRequests: [],

  // ==========================================
  // SUB-TAB NAVIGATION
  // ==========================================

  init() {
    const container = document.getElementById('avail-subtabs');
    if (!container) return;
    container.innerHTML = `
      <div style="display:flex;gap:6px;margin-bottom:16px;">
        <button class="tab-btn active" onclick="AvailabilityModule.switchSubTab('calendar', this)">Kalender</button>
        <button class="tab-btn" onclick="AvailabilityModule.switchSubTab('hours', this)">Arbeitszeiten</button>
        <button class="tab-btn" onclick="AvailabilityModule.switchSubTab('vacation', this)">Urlaub</button>
        <button class="tab-btn" onclick="AvailabilityModule.switchSubTab('team', this)">Team</button>
      </div>
      <div id="avail-subtab-content"></div>
    `;
    this.switchSubTab('calendar');
  },

  switchSubTab(tab, btn) {
    this.currentSubTab = tab;
    if (btn) {
      btn.parentElement.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    }
    const c = document.getElementById('avail-subtab-content');
    if (tab === 'calendar') this.renderCalendar(c);
    else if (tab === 'hours') this.renderWorkingHours(c);
    else if (tab === 'vacation') this.renderVacation(c);
    else if (tab === 'team') this.renderTeamView(c);
  },

  // ==========================================
  // CALENDAR VIEW (enhanced from basic dots)
  // ==========================================

  async renderCalendar(container) {
    container.innerHTML = '<div style="text-align:center;color:var(--tx3);padding:20px;">Laden...</div>';

    const [availRes, whRes] = await Promise.all([
      clanaDB.getAvailability(),
      clanaDB.getWorkingHours()
    ]);

    const avail = availRes.data || [];
    const hours = whRes.data || [];

    // Build week view
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));

    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });

    const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
    const slots = Array.from({ length: 13 }, (_, i) => i + 7); // 07:00 - 19:00

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="margin:0;font-size:14px;">Wochenansicht</h3>
        <span style="font-size:12px;color:var(--tx3);">KW ${getWeekNumber(today)}</span>
      </div>
      <div style="overflow-x:auto;">
        <div style="display:grid;grid-template-columns:50px repeat(7,1fr);gap:2px;min-width:500px;">
          <div></div>
          ${days.map((d, i) => `<div style="text-align:center;font-size:11px;font-weight:600;padding:6px 0;${d.toDateString()===today.toDateString()?'color:var(--pu);':'color:var(--tx3);'}">${dayNames[i]}<br>${d.getDate()}.${d.getMonth()+1}</div>`).join('')}
          ${slots.map(hour => {
            return `<div style="font-size:10px;color:var(--tx3);text-align:right;padding:4px 6px;line-height:32px;">${hour}:00</div>` +
              days.map((d, di) => {
                const wh = hours.find(h => h.day_of_week === di && h.is_active);
                const isWorkTime = wh && hour >= parseInt(wh.start_time) && hour < parseInt(wh.end_time);
                const isBreak = wh && wh.break_start && hour >= parseInt(wh.break_start) && hour < parseInt(wh.break_end);
                const dateStr = d.toISOString().split('T')[0];
                const dayAvail = avail.find(a => a.date === dateStr);
                const isVacation = dayAvail && (dayAvail.type === 'vacation' || dayAvail.type === 'sick');

                let bg = 'var(--bg3)';
                if (isVacation) bg = 'rgba(6,182,212,0.15)';
                else if (isBreak) bg = 'rgba(249,115,22,0.1)';
                else if (isWorkTime) bg = 'rgba(16,185,129,0.12)';

                return `<div style="height:32px;border-radius:4px;background:${bg};border:1px solid transparent;cursor:pointer;transition:all .15s;" onmouseenter="this.style.borderColor='var(--pu)'" onmouseleave="this.style.borderColor='transparent'" onclick="document.getElementById('avail-date').value='${dateStr}';openModal('modal-avail')"></div>`;
              }).join('');
          }).join('')}
        </div>
      </div>
      <div style="display:flex;gap:16px;margin-top:10px;font-size:11px;color:var(--tx3);">
        <span><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:rgba(16,185,129,0.15);vertical-align:middle;margin-right:4px;"></span>Arbeitszeit</span>
        <span><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:rgba(249,115,22,0.12);vertical-align:middle;margin-right:4px;"></span>Pause</span>
        <span><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:rgba(6,182,212,0.15);vertical-align:middle;margin-right:4px;"></span>Abwesend</span>
      </div>
    `;
  },

  // ==========================================
  // WORKING HOURS EDITOR
  // ==========================================

  async renderWorkingHours(container) {
    container.innerHTML = '<div style="text-align:center;color:var(--tx3);padding:20px;">Laden...</div>';

    const result = await clanaDB.getWorkingHours();
    this.workingHours = result.data || [];

    const dayNames = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
    const defaults = { start: '09:00', end: '17:00', breakStart: '12:00', breakEnd: '13:00' };

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="margin:0;font-size:14px;">Arbeitszeiten</h3>
        <div style="display:flex;gap:8px;">
          <select class="form-input form-select" id="wh-template" style="width:200px;font-size:12px;" onchange="AvailabilityModule.applyTemplate(this.value)">
            <option value="">Template wählen...</option>
            <option value="office">Standard Bürozeiten (Mo-Fr 9-17)</option>
            <option value="early">Frühschicht (Mo-Fr 6-14)</option>
            <option value="late">Spätschicht (Mo-Fr 14-22)</option>
          </select>
          <button class="btn btn-sm" onclick="AvailabilityModule.saveWorkingHours()">Speichern</button>
        </div>
      </div>
      <div class="card" style="padding:0;overflow:hidden;">
        <table class="data-table" style="margin:0;">
          <thead><tr><th>Tag</th><th>Aktiv</th><th>Start</th><th>Ende</th><th>Pause von</th><th>Pause bis</th></tr></thead>
          <tbody>${dayNames.map((name, i) => {
            const wh = this.workingHours.find(h => h.day_of_week === i);
            const active = wh ? wh.is_active : (i < 5);
            const start = wh?.start_time?.slice(0,5) || (i < 5 ? defaults.start : '');
            const end = wh?.end_time?.slice(0,5) || (i < 5 ? defaults.end : '');
            const bs = wh?.break_start?.slice(0,5) || (i < 5 ? defaults.breakStart : '');
            const be = wh?.break_end?.slice(0,5) || (i < 5 ? defaults.breakEnd : '');
            return `<tr>
              <td style="font-weight:600;">${name}</td>
              <td><input type="checkbox" id="wh-active-${i}" ${active ? 'checked' : ''} onchange="document.querySelectorAll('#wh-row-${i} input[type=time]').forEach(el=>el.disabled=!this.checked)"></td>
              <td id="wh-row-${i}"><input type="time" class="form-input" id="wh-start-${i}" value="${start}" style="width:100px;" ${!active?'disabled':''}></td>
              <td><input type="time" class="form-input" id="wh-end-${i}" value="${end}" style="width:100px;" ${!active?'disabled':''}></td>
              <td><input type="time" class="form-input" id="wh-bs-${i}" value="${bs}" style="width:100px;" ${!active?'disabled':''}></td>
              <td><input type="time" class="form-input" id="wh-be-${i}" value="${be}" style="width:100px;" ${!active?'disabled':''}></td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>
    `;
  },

  applyTemplate(template) {
    const templates = {
      office: { days: [0,1,2,3,4], start: '09:00', end: '17:00', bs: '12:00', be: '13:00' },
      early:  { days: [0,1,2,3,4], start: '06:00', end: '14:00', bs: '10:00', be: '10:30' },
      late:   { days: [0,1,2,3,4], start: '14:00', end: '22:00', bs: '18:00', be: '18:30' }
    };
    const t = templates[template];
    if (!t) return;

    for (let i = 0; i < 7; i++) {
      const active = t.days.includes(i);
      document.getElementById(`wh-active-${i}`).checked = active;
      document.getElementById(`wh-start-${i}`).value = active ? t.start : '';
      document.getElementById(`wh-end-${i}`).value = active ? t.end : '';
      document.getElementById(`wh-bs-${i}`).value = active ? t.bs : '';
      document.getElementById(`wh-be-${i}`).value = active ? t.be : '';
      document.querySelectorAll(`#wh-row-${i} input[type=time]`).forEach(el => el.disabled = !active);
    }
    Components.toast('Template angewendet — bitte Speichern klicken', 'info');
  },

  async saveWorkingHours() {
    const hours = [];
    for (let i = 0; i < 7; i++) {
      const active = document.getElementById(`wh-active-${i}`).checked;
      const start = document.getElementById(`wh-start-${i}`).value;
      const end = document.getElementById(`wh-end-${i}`).value;
      if (!active || !start || !end) continue;
      if (start >= end) { Components.toast(`Startzeit muss vor Endzeit liegen (Tag ${i+1})`, 'error'); return; }

      const entry = { day_of_week: i, start_time: start, end_time: end, is_active: true };
      const bs = document.getElementById(`wh-bs-${i}`).value;
      const be = document.getElementById(`wh-be-${i}`).value;
      if (bs && be) { entry.break_start = bs; entry.break_end = be; }
      hours.push(entry);
    }

    const result = await clanaDB.setWorkingHours(hours);
    if (result.success) {
      Components.toast('Arbeitszeiten gespeichert', 'success');
    } else {
      Components.toast('Fehler: ' + result.error, 'error');
    }
  },

  // ==========================================
  // VACATION MANAGEMENT
  // ==========================================

  async renderVacation(container) {
    container.innerHTML = '<div style="text-align:center;color:var(--tx3);padding:20px;">Laden...</div>';

    const year = new Date().getFullYear();
    const [reqRes, balRes] = await Promise.all([
      clanaDB.getTimeOffRequests(null, year),
      clanaDB.getVacationBalance(null, year)
    ]);

    const requests = reqRes.data || [];
    const balance = balRes.data || { totalDays: 30, usedDays: 0, remaining: 30 };
    const pct = Math.round((balance.usedDays / balance.totalDays) * 100);

    const typeLabels = { vacation: 'Urlaub', sick: 'Krankheit', training: 'Fortbildung', other: 'Sonstiges' };
    const statusLabels = { pending: 'Ausstehend', approved: 'Genehmigt', rejected: 'Abgelehnt', cancelled: 'Storniert' };
    const statusColors = { pending: '#f59e0b', approved: '#10b981', rejected: '#ef4444', cancelled: '#6b7280' };

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="margin:0;font-size:14px;">Urlaub & Abwesenheiten ${year}</h3>
        <button class="btn btn-sm" onclick="openModal('modal-time-off')">+ Abwesenheit beantragen</button>
      </div>

      <div class="card" style="margin-bottom:16px;padding:16px;">
        <div style="display:flex;align-items:center;gap:16px;">
          <div style="flex:1;">
            <div style="font-size:12px;color:var(--tx3);margin-bottom:6px;">Urlaubstage ${year}</div>
            <div style="height:10px;background:var(--bg3);border-radius:5px;overflow:hidden;">
              <div style="width:${pct}%;height:100%;background:${pct > 80 ? '#ef4444' : pct > 60 ? '#f59e0b' : '#10b981'};border-radius:5px;transition:width .5s;"></div>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:24px;font-weight:700;color:var(--tx);">${balance.remaining}</div>
            <div style="font-size:11px;color:var(--tx3);">von ${balance.totalDays} Tagen übrig</div>
          </div>
        </div>
      </div>

      <div class="card" style="padding:0;">
        <table class="data-table" style="margin:0;">
          <thead><tr><th>Zeitraum</th><th>Typ</th><th>Tage</th><th>Status</th><th>Notiz</th></tr></thead>
          <tbody>${requests.length ? requests.map(r => `
            <tr>
              <td style="font-size:12px;">${new Date(r.start_date).toLocaleDateString('de-DE')} – ${new Date(r.end_date).toLocaleDateString('de-DE')}</td>
              <td>${typeLabels[r.type] || clanaUtils.sanitizeHtml(r.type)}</td>
              <td>${r.days_count}</td>
              <td><span class="badge" style="background:${statusColors[r.status]}22;color:${statusColors[r.status]}">${statusLabels[r.status]}</span></td>
              <td style="font-size:12px;color:var(--tx3);">${clanaUtils.sanitizeHtml(r.note || '—')}</td>
            </tr>
          `).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--tx3);padding:30px;">Keine Abwesenheiten beantragt.</td></tr>'}</tbody>
        </table>
      </div>
    `;
  },

  async saveTimeOffRequest() {
    const startDate = document.getElementById('to-start').value;
    const endDate = document.getElementById('to-end').value;
    const type = document.getElementById('to-type').value;

    if (!startDate || !endDate) { Components.toast('Bitte Start- und Enddatum angeben', 'error'); return; }
    if (endDate < startDate) { Components.toast('Enddatum muss nach Startdatum liegen', 'error'); return; }

    // Calculate business days
    let days = 0;
    const cur = new Date(startDate);
    const end = new Date(endDate);
    while (cur <= end) {
      const dow = cur.getDay();
      if (dow !== 0 && dow !== 6) days++;
      cur.setDate(cur.getDate() + 1);
    }

    const halfStart = document.getElementById('to-half-start')?.checked;
    const halfEnd = document.getElementById('to-half-end')?.checked;
    if (halfStart) days -= 0.5;
    if (halfEnd) days -= 0.5;

    const result = await clanaDB.createTimeOffRequest({
      type,
      start_date: startDate,
      end_date: endDate,
      half_day_start: halfStart || false,
      half_day_end: halfEnd || false,
      days_count: Math.max(days, 0.5),
      note: document.getElementById('to-note')?.value?.trim() || null
    });

    if (result.success) {
      Components.toast('Abwesenheit beantragt', 'success');
      closeModal('modal-time-off');
      this.renderVacation(document.getElementById('avail-subtab-content'));
    } else {
      Components.toast('Fehler: ' + result.error, 'error');
    }
  },

  // ==========================================
  // TEAM VIEW
  // ==========================================

  async renderTeamView(container) {
    container.innerHTML = '<div style="text-align:center;color:var(--tx3);padding:20px;">Laden...</div>';

    const profilesRes = await clanaDB.getAllProfiles();
    const teamMembers = (profilesRes.data || []).filter(p => p.role === 'sales' || p.role === 'superadmin');

    if (!teamMembers.length) {
      container.innerHTML = '<div style="color:var(--tx3);text-align:center;padding:30px;">Keine Team-Mitglieder gefunden.</div>';
      return;
    }

    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d; });
    const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

    const startStr = days[0].toISOString().split('T')[0];
    const endStr = days[6].toISOString().split('T')[0];
    const teamRes = await clanaDB.getTeamAvailability(startStr, endStr);
    const timeOff = teamRes.timeOff || [];
    const workHours = teamRes.workHours || [];

    container.innerHTML = `
      <h3 style="margin:0 0 16px;font-size:14px;">Team-Kapazität (KW ${getWeekNumber(today)})</h3>
      <div class="card" style="padding:0;overflow-x:auto;">
        <table class="data-table" style="margin:0;min-width:500px;">
          <thead><tr><th>Mitarbeiter</th>${days.map((d, i) => `<th style="text-align:center;${d.toDateString()===today.toDateString()?'color:var(--pu);':''}">${dayNames[i]}<br><span style="font-weight:400;">${d.getDate()}.${d.getMonth()+1}</span></th>`).join('')}</tr></thead>
          <tbody>${teamMembers.map(m => {
            const name = `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email;
            return `<tr>
              <td style="font-weight:600;font-size:12px;">${clanaUtils.sanitizeHtml(name)}</td>
              ${days.map((d, di) => {
                const dateStr = d.toISOString().split('T')[0];
                const off = timeOff.find(t => t.user_id === m.id && dateStr >= t.start_date && dateStr <= t.end_date);
                const wh = workHours.find(h => h.user_id === m.id && h.day_of_week === di && h.is_active);

                let bg = 'var(--bg3)'; let label = '—'; let color = 'var(--tx3)';
                if (off) {
                  const types = { vacation: '🏖️', sick: '🤒', training: '📚', other: '⛔' };
                  bg = 'rgba(6,182,212,0.12)'; label = types[off.type] || '⛔'; color = '#06b6d4';
                } else if (wh) {
                  bg = 'rgba(16,185,129,0.1)'; label = `${clanaUtils.sanitizeHtml(wh.start_time?.slice(0,5) || '')}–${clanaUtils.sanitizeHtml(wh.end_time?.slice(0,5) || '')}`; color = '#10b981';
                }
                return `<td style="text-align:center;background:${bg};font-size:11px;color:${color};">${label}</td>`;
              }).join('')}
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>
    `;
  }
};

function getWeekNumber(d) {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

window.AvailabilityModule = AvailabilityModule;
