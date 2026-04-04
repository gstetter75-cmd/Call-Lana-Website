// ==========================================
// Appointments Page: Week View, List View, Detail Modal
// Depends on: supabase-init.js, auth.js, dashboard.js (escHtml, showToast)
// ==========================================

const AppointmentsPage = {

  _currentWeekStart: null,
  _appointments: [],
  _view: 'week',

  // ==========================================
  // INIT
  // ==========================================

  async init() {
    const today = new Date();
    const dayOfWeek = (today.getDay() + 6) % 7; // Mon=0
    this._currentWeekStart = new Date(today);
    this._currentWeekStart.setDate(today.getDate() - dayOfWeek);
    this._currentWeekStart.setHours(0, 0, 0, 0);

    await this.loadAppointments();
  },

  // ==========================================
  // DATA
  // ==========================================

  async loadAppointments() {
    try {
      const user = await auth.getUser();
      if (!user) return;

      const weekEnd = new Date(this._currentWeekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const { data, error } = await supabaseClient
        .from('appointments')
        .select('id,appointment_date,customer_name,name,phone,duration_minutes,note,status')
        .eq('user_id', await auth.getEffectiveUserId())
        .gte('appointment_date', this._currentWeekStart.toISOString())
        .lt('appointment_date', weekEnd.toISOString())
        .order('appointment_date', { ascending: true });

      if (error) throw error;
      this._appointments = data || [];
    } catch (err) {
      this._appointments = [];
      if (typeof Logger !== 'undefined') Logger.warn('AppointmentsPage.loadAppointments', err);
    }

    this._renderWeekLabel();
    if (this._view === 'week') {
      this._renderWeekView();
    } else {
      this._renderListView();
    }
  },

  // ==========================================
  // NAVIGATION
  // ==========================================

  prevWeek() {
    const d = new Date(this._currentWeekStart);
    d.setDate(d.getDate() - 7);
    this._currentWeekStart = d;
    this.loadAppointments();
  },

  nextWeek() {
    const d = new Date(this._currentWeekStart);
    d.setDate(d.getDate() + 7);
    this._currentWeekStart = d;
    this.loadAppointments();
  },

  setView(view) {
    this._view = view;
    const tabs = document.querySelectorAll('#page-appointments .editor-tab');
    tabs.forEach(t => t.classList.remove('active'));
    if (view === 'week') {
      tabs[0]?.classList.add('active');
      document.getElementById('appt-week-view').style.display = '';
      document.getElementById('appt-week-nav').style.display = '';
      document.getElementById('appt-list-view').style.display = 'none';
      this._renderWeekView();
    } else {
      tabs[1]?.classList.add('active');
      document.getElementById('appt-week-view').style.display = 'none';
      document.getElementById('appt-week-nav').style.display = 'none';
      document.getElementById('appt-list-view').style.display = '';
      this._renderListView();
    }
  },

  // ==========================================
  // WEEK LABEL
  // ==========================================

  _renderWeekLabel() {
    const el = document.getElementById('appt-week-label');
    if (!el) return;
    const start = this._currentWeekStart;
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const opts = { day: 'numeric', month: 'short' };
    el.textContent = start.toLocaleDateString('de-DE', opts) + ' – ' + end.toLocaleDateString('de-DE', opts) + ' ' + end.getFullYear();
  },

  // ==========================================
  // WEEK VIEW (7-day calendar grid)
  // ==========================================

  _renderWeekView() {
    const container = document.getElementById('appt-week-view');
    if (!container) return;

    const sanitize = typeof clanaUtils !== 'undefined' ? clanaUtils.sanitizeHtml : (s) => s;
    const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let html = '<div class="appt-week-grid">';

    // Header row
    html += '<div class="appt-week-header">';
    for (let d = 0; d < 7; d++) {
      const date = new Date(this._currentWeekStart);
      date.setDate(date.getDate() + d);
      const isToday = date.getTime() === today.getTime();
      html += '<div class="appt-day-header' + (isToday ? ' today' : '') + '">' +
        '<span class="appt-day-name">' + dayNames[d] + '</span>' +
        '<span class="appt-day-num">' + date.getDate() + '</span>' +
      '</div>';
    }
    html += '</div>';

    // Content row
    html += '<div class="appt-week-body">';
    for (let d = 0; d < 7; d++) {
      const date = new Date(this._currentWeekStart);
      date.setDate(date.getDate() + d);
      const dateStr = date.toISOString().slice(0, 10);
      const isToday = date.getTime() === today.getTime();

      const dayAppointments = this._appointments.filter(a => {
        return a.appointment_date && a.appointment_date.startsWith(dateStr);
      });

      html += '<div class="appt-day-col' + (isToday ? ' today' : '') + '">';
      if (dayAppointments.length === 0) {
        html += '<div style="color:var(--tx3);font-size:11px;text-align:center;padding:12px;">–</div>';
      } else {
        dayAppointments.forEach(a => {
          const time = new Date(a.appointment_date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
          const name = sanitize(a.customer_name || a.name || 'Unbekannt');
          const statusCls = this._getStatusClass(a.status);
          html += '<div class="appt-block ' + statusCls + '" data-id="' + sanitize(a.id) + '" onclick="AppointmentsPage.showDetail(this.dataset.id)">' +
            '<div style="font-size:11px;font-weight:700;">' + time + '</div>' +
            '<div style="font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + name + '</div>' +
          '</div>';
        });
      }
      html += '</div>';
    }
    html += '</div></div>';

    container.innerHTML = html;
  },

  // ==========================================
  // LIST VIEW
  // ==========================================

  _renderListView() {
    const container = document.getElementById('appt-list-body');
    const countEl = document.getElementById('apptListCount');
    if (!container) return;

    const sanitize = typeof clanaUtils !== 'undefined' ? clanaUtils.sanitizeHtml : (s) => s;
    const appointments = this._appointments;

    if (countEl) countEl.textContent = appointments.length + ' Termine';

    if (!appointments.length) {
      container.innerHTML = '<div class="empty-state"><h3>Keine Termine</h3><p>In dieser Woche gibt es keine Termine.</p></div>';
      return;
    }

    let html = '<div class="table-wrap"><table><thead><tr><th>Datum</th><th>Zeit</th><th>Kunde</th><th>Telefon</th><th>Dauer</th><th>Status</th></tr></thead><tbody>';
    appointments.forEach(a => {
      const date = a.appointment_date ? new Date(a.appointment_date).toLocaleDateString('de-DE') : '–';
      const time = a.appointment_date ? new Date(a.appointment_date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '–';
      const name = sanitize(a.customer_name || a.name || '–');
      const phone = sanitize(a.phone || '–');
      const dur = a.duration_minutes ? a.duration_minutes + ' min' : '–';
      const statusMap = {
        confirmed: { label: 'Bestätigt', cls: 'badge-green' },
        cancelled: { label: 'Storniert', cls: 'badge-red' },
        completed: { label: 'Erledigt', cls: 'badge-purple' },
        pending: { label: 'Ausstehend', cls: 'badge-orange' }
      };
      const st = statusMap[a.status] || { label: sanitize(a.status || 'Bestätigt'), cls: 'badge-green' };

      html += '<tr style="cursor:pointer;" data-id="' + sanitize(a.id) + '" onclick="AppointmentsPage.showDetail(this.dataset.id)">' +
        '<td>' + date + '</td>' +
        '<td style="font-weight:700;color:var(--pu);">' + time + '</td>' +
        '<td>' + name + '</td>' +
        '<td>' + phone + '</td>' +
        '<td>' + dur + '</td>' +
        '<td><span class="badge ' + st.cls + '">' + st.label + '</span></td>' +
      '</tr>';
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;
  },

  // ==========================================
  // DETAIL MODAL
  // ==========================================

  showDetail(id) {
    const appt = this._appointments.find(a => a.id === id);
    if (!appt) return;

    const sanitize = typeof clanaUtils !== 'undefined' ? clanaUtils.sanitizeHtml : (s) => s;

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);z-index:100;display:flex;align-items:center;justify-content:center;';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    const date = appt.appointment_date ? new Date(appt.appointment_date).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '–';
    const time = appt.appointment_date ? new Date(appt.appointment_date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '–';
    const name = sanitize(appt.customer_name || appt.name || 'Unbekannt');
    const phone = sanitize(appt.phone || '–');
    const dur = appt.duration_minutes ? appt.duration_minutes + ' min' : '–';
    const note = appt.note ? sanitize(appt.note) : '';
    const statusCls = this._getStatusClass(appt.status);
    const statusLabel = { confirmed: 'Bestätigt', cancelled: 'Storniert', completed: 'Erledigt', pending: 'Ausstehend' }[appt.status] || 'Bestätigt';

    overlay.innerHTML = '<div class="modal" style="max-width:480px;">' +
      '<div class="modal-header">' +
        '<h2 class="modal-title">Termin-Details</h2>' +
        '<button class="modal-close" onclick="this.closest(\'div[style*=fixed]\').remove()">✕</button>' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:16px;">' +
        '<div style="display:flex;align-items:center;gap:12px;">' +
          '<div class="appt-block ' + statusCls + '" style="width:8px;height:40px;border-radius:4px;padding:0;"></div>' +
          '<div>' +
            '<div style="font-size:16px;font-weight:700;">' + name + '</div>' +
            '<div style="font-size:13px;color:var(--tx3);">' + phone + '</div>' +
          '</div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' +
          '<div><div style="font-size:11px;color:var(--tx3);font-weight:600;text-transform:uppercase;">Datum</div><div style="font-size:14px;font-weight:600;margin-top:4px;">' + date + '</div></div>' +
          '<div><div style="font-size:11px;color:var(--tx3);font-weight:600;text-transform:uppercase;">Uhrzeit</div><div style="font-size:14px;font-weight:600;margin-top:4px;">' + time + '</div></div>' +
          '<div><div style="font-size:11px;color:var(--tx3);font-weight:600;text-transform:uppercase;">Dauer</div><div style="font-size:14px;font-weight:600;margin-top:4px;">' + dur + '</div></div>' +
          '<div><div style="font-size:11px;color:var(--tx3);font-weight:600;text-transform:uppercase;">Status</div><div style="margin-top:4px;"><span class="badge ' + this._getStatusBadgeClass(appt.status) + '">' + statusLabel + '</span></div></div>' +
        '</div>' +
        (note ? '<div style="background:var(--bg2);border-radius:10px;padding:14px;"><div style="font-size:11px;color:var(--tx3);font-weight:600;text-transform:uppercase;margin-bottom:6px;">Notiz</div><div style="font-size:13px;color:var(--tx2);line-height:1.6;">' + note + '</div></div>' : '') +
      '</div>' +
    '</div>';

    document.body.appendChild(overlay);
  },

  // ==========================================
  // HELPERS
  // ==========================================

  _getStatusClass(status) {
    const map = { confirmed: 'status-confirmed', cancelled: 'status-cancelled', completed: 'status-completed', pending: 'status-pending' };
    return map[status] || 'status-confirmed';
  },

  _getStatusBadgeClass(status) {
    const map = { confirmed: 'badge-green', cancelled: 'badge-red', completed: 'badge-purple', pending: 'badge-orange' };
    return map[status] || 'badge-green';
  }
};

window.AppointmentsPage = AppointmentsPage;
