// ==========================================
// Dashboard Home Widgets: Metric Cards, Emergency Banner,
// Recent Calls, Today's Appointments, Top Leads
// Depends on: db.js, supabase-init.js, auth.js, utils.js
// ==========================================

const HomeWidgets = {

  _emergencyChannel: null,

  // ==========================================
  // METRIC CARDS (Spec §4.1)
  // ==========================================

  async loadMetricCards() {
    try {
      const user = await auth.getUser();
      if (!user) return;

      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const startOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()).toISOString();
      const endOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59).toISOString();

      // Query only today + yesterday from Supabase (not 5000 rows client-side)
      const [todayRes, yesterdayRes] = await Promise.all([
        supabaseClient
          .from('calls')
          .select('duration,outcome,status,sentiment_score,created_at')
          .eq('user_id', await auth.getEffectiveUserId())
          .gte('created_at', startOfDay)
          .lte('created_at', endOfDay),
        supabaseClient
          .from('calls')
          .select('id')
          .eq('user_id', await auth.getEffectiveUserId())
          .gte('created_at', startOfYesterday)
          .lte('created_at', endOfYesterday)
      ]);

      const todayCalls = todayRes.data || [];
      const yesterdayTotal = (yesterdayRes.data || []).length;

      const totalToday = todayCalls.length;
      const bookedToday = todayCalls.filter(c => c.outcome === 'termin' || c.status === 'completed').length;
      const bookingRate = totalToday > 0 ? Math.round((bookedToday / totalToday) * 100) : 0;
      const totalMinutes = Math.round(todayCalls.reduce((sum, c) => sum + (c.duration || 0), 0) / 60);
      const sentimentScores = todayCalls.filter(c => c.sentiment_score != null).map(c => c.sentiment_score);
      const avgSentiment = sentimentScores.length > 0
        ? (sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length).toFixed(1)
        : null;

      // Update DOM
      const elCalls = document.getElementById('metricCallsToday');
      const elBooking = document.getElementById('metricBookingRate');
      const elMinutes = document.getElementById('metricMinutes');
      const elSentiment = document.getElementById('metricSentiment');
      const elCallsTrend = document.getElementById('metricCallsTrend');

      if (elCalls) elCalls.textContent = totalToday;
      if (elBooking) elBooking.textContent = bookingRate + '%';
      if (elMinutes) elMinutes.textContent = totalMinutes + ' min';
      if (elSentiment) elSentiment.textContent = avgSentiment !== null ? avgSentiment + '/10' : '–';

      if (elCallsTrend && yesterdayTotal > 0) {
        const diff = totalToday - yesterdayTotal;
        const pct = Math.round((diff / yesterdayTotal) * 100);
        const arrow = diff >= 0 ? '↑' : '↓';
        const color = diff >= 0 ? 'var(--green)' : 'var(--red)';
        elCallsTrend.innerHTML = '<span style="color:' + color + ';font-weight:600;">' + arrow + ' ' + Math.abs(pct) + '% vs. gestern</span>';
      }
    } catch (err) {
      if (typeof Logger !== 'undefined') Logger.warn('HomeWidgets.loadMetricCards', err);
    }
  },

  // ==========================================
  // EMERGENCY BANNER (Spec §4.1 — Realtime)
  // ==========================================

  initEmergencyBanner() {
    try {
      const container = document.getElementById('emergency-banner');
      if (!container) return;

      // Subscribe to outbound_log for emergency alerts
      const channel = supabaseClient
        .channel('emergency-alerts')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'outbound_log'
        }, (payload) => {
          if (payload.new && payload.new.reason === 'notfall') {
            // Only show for own user's emergencies
            const user = typeof auth !== 'undefined' ? auth._cachedUser : null;
            if (!user || !payload.new.user_id || payload.new.user_id === user.id) {
              this._showEmergencyBanner(container, payload.new);
            }
          }
        })
        .subscribe();

      this._emergencyChannel = channel;
    } catch (err) {
      if (typeof Logger !== 'undefined') Logger.warn('HomeWidgets.initEmergencyBanner', err);
    }
  },

  _showEmergencyBanner(container, alert) {
    const sanitize = typeof clanaUtils !== 'undefined' ? clanaUtils.sanitizeHtml : (s) => s;
    const phone = sanitize(alert.phone_number || 'Unbekannt');
    const time = alert.created_at ? new Date(alert.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : 'jetzt';

    container.innerHTML =
      '<div class="emergency-banner">' +
        '<span style="font-size:20px;">🚨</span>' +
        '<div style="flex:1;">' +
          '<strong>Notfall-Anruf!</strong><br>' +
          '<span style="font-size:12px;color:var(--tx2);">' + phone + ' um ' + time + '</span>' +
        '</div>' +
        '<button class="btn btn-sm" onclick="this.closest(\'.emergency-banner\').remove()" style="white-space:nowrap;">Gesehen</button>' +
      '</div>';
  },

  // ==========================================
  // RECENT CALLS WIDGET (Spec §4.1 — Last 5)
  // ==========================================

  async loadRecentCalls() {
    const container = document.getElementById('widget-recent-calls');
    if (!container) return;

    const sanitize = typeof clanaUtils !== 'undefined' ? clanaUtils.sanitizeHtml : (s) => s;

    try {
      const res = await clanaDB.getCalls(5);
      const calls = res.data || [];

      if (!calls.length) {
        container.innerHTML = '<div style="color:var(--tx3);font-size:13px;text-align:center;padding:20px;">Noch keine Anrufe</div>';
        return;
      }

      container.innerHTML = calls.map(function(c) {
        const time = c.created_at ? new Date(c.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '–';
        const phone = sanitize(c.phone_number || c.caller_number || 'Unbekannt');
        const dur = c.duration ? (c.duration > 60 ? Math.round(c.duration / 60) + ' min' : c.duration + ' sek') : '–';
        let statusColor = 'var(--tx3)';
        let statusLabel = '·';
        if (c.status === 'completed') { statusColor = 'var(--green)'; statusLabel = '✓'; }
        else if (c.status === 'missed') { statusColor = 'var(--red)'; statusLabel = '✗'; }
        else if (c.status === 'voicemail') { statusColor = 'var(--orange)'; statusLabel = '📧'; }

        return '<div class="widget-call-row">' +
          '<span style="color:' + statusColor + ';font-weight:700;width:20px;text-align:center;">' + statusLabel + '</span>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:13px;font-weight:600;color:var(--tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + phone + '</div>' +
            '<div style="font-size:11px;color:var(--tx3);">' + time + ' · ' + dur + '</div>' +
          '</div>' +
        '</div>';
      }).join('');
    } catch (err) {
      container.innerHTML = '<div style="color:var(--tx3);font-size:13px;text-align:center;padding:20px;">Fehler beim Laden</div>';
    }
  },

  // ==========================================
  // TODAY'S APPOINTMENTS WIDGET (Spec §4.1)
  // ==========================================

  async loadTodayAppointments() {
    const container = document.getElementById('widget-appointments');
    const countEl = document.getElementById('widget-appointments-count');
    if (!container) return;

    const sanitize = typeof clanaUtils !== 'undefined' ? clanaUtils.sanitizeHtml : (s) => s;

    try {
      const user = await auth.getUser();
      if (!user) return;

      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();

      const { data, error } = await supabaseClient
        .from('appointments')
        .select('appointment_date,customer_name,name,status')
        .gte('appointment_date', startOfDay)
        .lte('appointment_date', endOfDay)
        .order('appointment_date', { ascending: true })
        .limit(10);

      if (error) throw error;

      const appointments = data || [];
      if (countEl) countEl.textContent = appointments.length;

      if (!appointments.length) {
        container.innerHTML = '<div style="color:var(--tx3);font-size:13px;text-align:center;padding:20px;">Keine Termine heute</div>';
        return;
      }

      container.innerHTML = appointments.map(function(a) {
        const time = a.appointment_date ? new Date(a.appointment_date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '–';
        const name = sanitize(a.customer_name || a.name || 'Unbekannt');
        let statusClass = 'badge-green';
        let statusText = 'Bestätigt';
        if (a.status === 'cancelled') { statusClass = 'badge-red'; statusText = 'Storniert'; }
        else if (a.status === 'completed') { statusClass = 'badge-purple'; statusText = 'Erledigt'; }

        return '<div class="widget-appointment-row">' +
          '<div style="font-size:13px;font-weight:700;color:var(--pu);width:50px;">' + time + '</div>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:13px;font-weight:600;color:var(--tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + name + '</div>' +
          '</div>' +
          '<span class="badge ' + statusClass + '" style="font-size:10px;">' + statusText + '</span>' +
        '</div>';
      }).join('');
    } catch (err) {
      container.innerHTML = '<div style="color:var(--tx3);font-size:13px;text-align:center;padding:20px;">Termine nicht verfügbar</div>';
    }
  },

  // ==========================================
  // TOP LEADS WIDGET (Spec §4.1)
  // ==========================================

  async loadTopLeads() {
    const container = document.getElementById('widget-top-leads');
    if (!container) return;

    const sanitize = typeof clanaUtils !== 'undefined' ? clanaUtils.sanitizeHtml : (s) => s;

    try {
      const user = await auth.getUser();
      if (!user) return;

      const { data, error } = await supabaseClient
        .from('leads')
        .select('id,name,company,lead_score,status')
        .order('lead_score', { ascending: false })
        .limit(5);

      if (error) throw error;

      const leads = data || [];

      if (!leads.length) {
        container.innerHTML = '<div style="color:var(--tx3);font-size:13px;text-align:center;padding:20px;">Keine Leads vorhanden</div>';
        return;
      }

      let maxScore = Math.max(...leads.map(l => l.lead_score || 0));
      if (maxScore === 0) maxScore = 100;

      container.innerHTML = leads.map(function(l) {
        const name = sanitize(l.name || 'Unbekannt');
        const company = sanitize(l.company || '');
        const score = l.lead_score || 0;
        const pct = Math.round((score / maxScore) * 100);
        const barColor = score >= 70 ? 'var(--green)' : score >= 40 ? 'var(--orange)' : 'var(--red)';

        return '<div class="widget-lead-row">' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:13px;font-weight:600;color:var(--tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + name + '</div>' +
            (company ? '<div style="font-size:11px;color:var(--tx3);">' + company + '</div>' : '') +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:8px;min-width:80px;">' +
            '<div style="flex:1;height:6px;background:var(--bg3);border-radius:3px;overflow:hidden;">' +
              '<div style="width:' + pct + '%;height:100%;background:' + barColor + ';border-radius:3px;"></div>' +
            '</div>' +
            '<span style="font-size:12px;font-weight:700;color:var(--tx);min-width:24px;text-align:right;">' + score + '</span>' +
          '</div>' +
        '</div>';
      }).join('');
    } catch (err) {
      container.innerHTML = '<div style="color:var(--tx3);font-size:13px;text-align:center;padding:20px;">Leads nicht verfügbar</div>';
    }
  },

  // ==========================================
  // CLEANUP — Remove realtime subscriptions
  // ==========================================

  destroy() {
    if (this._emergencyChannel) {
      supabaseClient.removeChannel(this._emergencyChannel);
      this._emergencyChannel = null;
    }
  },

  // ==========================================
  // INIT — Load all widgets
  // ==========================================

  async init() {
    this.destroy(); // clean up any previous subscriptions
    await Promise.all([
      this.loadMetricCards(),
      this.loadRecentCalls(),
      this.loadTodayAppointments(),
      this.loadTopLeads()
    ]);
    this.initEmergencyBanner();
  }
};

window.HomeWidgets = HomeWidgets;
