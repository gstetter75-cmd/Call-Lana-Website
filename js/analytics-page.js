// ==========================================
// Analytics Page: Charts for call performance insights
// Depends on: supabase-init.js, auth.js
// ==========================================

const AnalyticsPage = {

  _calls: [],

  async init() {
    try {
      const user = await auth.getUser();
      if (!user) return;

      // Load last 30 days of calls
      const since = new Date();
      since.setDate(since.getDate() - 30);

      const { data, error } = await supabaseClient
        .from('calls')
        .select('created_at,duration,status,outcome,sentiment_score')
        .eq('user_id', await auth.getEffectiveUserId())
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: true })
        .limit(5000);

      if (error) throw error;
      this._calls = data || [];
    } catch (err) {
      this._calls = [];
      if (typeof Logger !== 'undefined') Logger.warn('AnalyticsPage.init', err);
    }

    this._renderCallsPerDay();
    this._renderOutcomeMix();
    this._renderBookingTrend();
    this._renderCallHours();
    this._renderSentimentTrend();
    this._renderMinutesGauge();
  },

  // ==========================================
  // CALLS PER DAY (Bar Chart)
  // ==========================================

  _renderCallsPerDay() {
    const container = document.getElementById('chart-calls-per-day');
    if (!container) return;

    const days = this._groupByDay();
    const last14 = days.slice(-14);
    if (!last14.length) { container.innerHTML = this._emptyMsg(); return; }

    const maxVal = Math.max(...last14.map(d => d.count), 1);
    const barWidth = Math.floor(100 / last14.length);

    let html = '<svg width="100%" height="100%" viewBox="0 0 500 160" preserveAspectRatio="none">';
    last14.forEach((d, i) => {
      const x = i * (500 / last14.length) + 4;
      const w = (500 / last14.length) - 8;
      const h = (d.count / maxVal) * 130;
      const y = 140 - h;
      html += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="3" fill="rgba(124,58,237,.7)"/>';
      html += '<text x="' + (x + w / 2) + '" y="155" text-anchor="middle" fill="var(--tx3)" font-size="8" font-family="Manrope,sans-serif">' + d.label + '</text>';
      if (d.count > 0) {
        html += '<text x="' + (x + w / 2) + '" y="' + (y - 4) + '" text-anchor="middle" fill="var(--tx2)" font-size="9" font-weight="600" font-family="Manrope,sans-serif">' + d.count + '</text>';
      }
    });
    html += '</svg>';
    container.innerHTML = html;
  },

  // ==========================================
  // OUTCOME MIX (Pie Chart)
  // ==========================================

  _renderOutcomeMix() {
    const container = document.getElementById('chart-outcome-mix');
    if (!container) return;

    const outcomes = {};
    this._calls.forEach(c => {
      const key = c.outcome || 'sonstige';
      outcomes[key] = (outcomes[key] || 0) + 1;
    });

    const entries = Object.entries(outcomes).sort((a, b) => b[1] - a[1]);
    if (!entries.length) { container.innerHTML = this._emptyMsg(); return; }

    const total = entries.reduce((s, e) => s + e[1], 0);
    const colors = { termin: '#4ade80', notfall: '#f87171', frage: '#22d3ee', abbruch: '#6b5f8a', sonstige: '#9d5cf6' };
    const labels = { termin: 'Termin', notfall: 'Notfall', frage: 'Frage', abbruch: 'Abbruch', sonstige: 'Sonstige' };

    let html = '<div style="display:flex;align-items:center;gap:20px;width:100%;">';
    // SVG Donut
    html += '<svg width="120" height="120" viewBox="0 0 120 120">';
    let angle = -90;
    entries.forEach(([key, count]) => {
      const pct = count / total;
      const sweep = pct * 360;
      const color = colors[key] || '#9d5cf6';
      const rad1 = (angle * Math.PI) / 180;
      const rad2 = ((angle + sweep) * Math.PI) / 180;
      const x1 = 60 + 45 * Math.cos(rad1);
      const y1 = 60 + 45 * Math.sin(rad1);
      const x2 = 60 + 45 * Math.cos(rad2);
      const y2 = 60 + 45 * Math.sin(rad2);
      const largeArc = sweep > 180 ? 1 : 0;
      if (entries.length === 1) {
        html += '<circle cx="60" cy="60" r="45" fill="none" stroke="' + color + '" stroke-width="20"/>';
      } else {
        html += '<path d="M60,60 L' + x1 + ',' + y1 + ' A45,45 0 ' + largeArc + ',1 ' + x2 + ',' + y2 + ' Z" fill="' + color + '"/>';
      }
      angle += sweep;
    });
    html += '<circle cx="60" cy="60" r="28" fill="var(--card)"/>';
    html += '<text x="60" y="63" text-anchor="middle" fill="var(--tx)" font-size="16" font-weight="800" font-family="Syne,sans-serif">' + total + '</text>';
    html += '</svg>';

    // Legend
    html += '<div style="display:flex;flex-direction:column;gap:6px;">';
    entries.forEach(([key, count]) => {
      const color = colors[key] || '#9d5cf6';
      const label = labels[key] || key;
      const pct = Math.round((count / total) * 100);
      html += '<div style="display:flex;align-items:center;gap:6px;font-size:12px;">' +
        '<div style="width:10px;height:10px;border-radius:3px;background:' + color + ';flex-shrink:0;"></div>' +
        '<span style="color:var(--tx2);">' + label + '</span>' +
        '<span style="color:var(--tx);font-weight:700;margin-left:auto;">' + pct + '%</span>' +
      '</div>';
    });
    html += '</div></div>';
    container.innerHTML = html;
  },

  // ==========================================
  // BOOKING RATE TREND (Line Chart)
  // ==========================================

  _renderBookingTrend() {
    const container = document.getElementById('chart-booking-trend');
    if (!container) return;

    const weeks = this._groupByWeek();
    if (weeks.length < 2) { container.innerHTML = this._emptyMsg(); return; }

    const rates = weeks.map(w => w.total > 0 ? Math.round((w.booked / w.total) * 100) : 0);
    const maxRate = Math.max(...rates, 1);

    const w = 500;
    const h = 140;
    const points = rates.map((r, i) => {
      const x = (i / (rates.length - 1)) * (w - 20) + 10;
      const y = h - 10 - ((r / maxRate) * (h - 30));
      return x + ',' + y;
    });

    let html = '<svg width="100%" height="100%" viewBox="0 0 500 160" preserveAspectRatio="none">';
    // Area fill
    html += '<polygon points="10,' + (h - 10) + ' ' + points.join(' ') + ' ' + (w - 10) + ',' + (h - 10) + '" fill="rgba(124,58,237,.08)"/>';
    // Line
    html += '<polyline points="' + points.join(' ') + '" fill="none" stroke="var(--pu)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>';
    // Dots + labels
    rates.forEach((r, i) => {
      const x = (i / (rates.length - 1)) * (w - 20) + 10;
      const y = h - 10 - ((r / maxRate) * (h - 30));
      html += '<circle cx="' + x + '" cy="' + y + '" r="4" fill="var(--pu)" stroke="var(--card)" stroke-width="2"/>';
      html += '<text x="' + x + '" y="' + (y - 8) + '" text-anchor="middle" fill="var(--tx2)" font-size="9" font-weight="600" font-family="Manrope,sans-serif">' + r + '%</text>';
      html += '<text x="' + x + '" y="155" text-anchor="middle" fill="var(--tx3)" font-size="8" font-family="Manrope,sans-serif">KW' + weeks[i].week + '</text>';
    });
    html += '</svg>';
    container.innerHTML = html;
  },

  // ==========================================
  // TOP CALL HOURS (Horizontal Bar Chart)
  // ==========================================

  _renderCallHours() {
    const container = document.getElementById('chart-call-hours');
    if (!container) return;

    const hours = Array(24).fill(0);
    this._calls.forEach(c => {
      if (!c.created_at) return;
      const h = new Date(c.created_at).getHours();
      hours[h]++;
    });

    // Show only business hours 6-22
    const businessHours = [];
    for (let h = 6; h <= 21; h++) {
      businessHours.push({ hour: h, count: hours[h] });
    }
    const maxCount = Math.max(...businessHours.map(h => h.count), 1);

    let html = '<div style="display:flex;flex-direction:column;gap:3px;height:100%;justify-content:space-between;">';
    businessHours.forEach(h => {
      const pct = Math.round((h.count / maxCount) * 100);
      html += '<div style="display:flex;align-items:center;gap:6px;">' +
        '<span style="font-size:10px;color:var(--tx3);min-width:30px;text-align:right;">' + h.hour + ':00</span>' +
        '<div style="flex:1;height:10px;background:var(--bg3);border-radius:5px;overflow:hidden;">' +
          '<div style="width:' + pct + '%;height:100%;background:rgba(124,58,237,' + (0.3 + (h.count / maxCount) * 0.6) + ');border-radius:5px;transition:width .3s;"></div>' +
        '</div>' +
        '<span style="font-size:10px;font-weight:600;color:var(--tx2);min-width:20px;">' + h.count + '</span>' +
      '</div>';
    });
    html += '</div>';
    container.innerHTML = html;
  },

  // ==========================================
  // SENTIMENT TREND (Area Chart)
  // ==========================================

  _renderSentimentTrend() {
    const container = document.getElementById('chart-sentiment-trend');
    if (!container) return;

    const days = this._groupByDay();
    const withSentiment = days.filter(d => d.avgSentiment !== null).slice(-14);
    if (withSentiment.length < 2) { container.innerHTML = this._emptyMsg('Sentiment-Daten werden nach Aktivierung der Sentiment-Analyse verfügbar.'); return; }

    const w = 500;
    const h = 140;
    const points = withSentiment.map((d, i) => {
      const x = (i / (withSentiment.length - 1)) * (w - 20) + 10;
      const y = h - 10 - ((d.avgSentiment / 10) * (h - 30));
      return x + ',' + y;
    });

    let html = '<svg width="100%" height="100%" viewBox="0 0 500 160" preserveAspectRatio="none">';
    html += '<polygon points="10,' + (h - 10) + ' ' + points.join(' ') + ' ' + (w - 10) + ',' + (h - 10) + '" fill="rgba(74,222,128,.1)"/>';
    html += '<polyline points="' + points.join(' ') + '" fill="none" stroke="#4ade80" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>';
    withSentiment.forEach((d, i) => {
      const x = (i / (withSentiment.length - 1)) * (w - 20) + 10;
      const y = h - 10 - ((d.avgSentiment / 10) * (h - 30));
      const color = d.avgSentiment >= 7 ? '#4ade80' : d.avgSentiment >= 4 ? '#fb923c' : '#f87171';
      html += '<circle cx="' + x + '" cy="' + y + '" r="4" fill="' + color + '" stroke="var(--card)" stroke-width="2"/>';
      html += '<text x="' + x + '" y="155" text-anchor="middle" fill="var(--tx3)" font-size="8" font-family="Manrope,sans-serif">' + d.label + '</text>';
    });
    html += '</svg>';
    container.innerHTML = html;
  },

  // ==========================================
  // MINUTES GAUGE
  // ==========================================

  async _renderMinutesGauge() {
    const container = document.getElementById('chart-minutes-gauge');
    if (!container) return;

    const totalMinutes = Math.round(this._calls.reduce((sum, c) => sum + (c.duration || 0), 0) / 60);

    // Try to get plan limit from settings
    let planLimit = 500;
    try {
      const settingsRes = await clanaDB.getSettings();
      if (settingsRes.success && settingsRes.data?.monthly_limit) {
        planLimit = settingsRes.data.monthly_limit;
      }
    } catch (e) { /* use default */ }

    const pct = Math.min(100, Math.round((totalMinutes / planLimit) * 100));
    const remaining = Math.max(0, planLimit - totalMinutes);
    const color = pct >= 90 ? '#f87171' : pct >= 70 ? '#fb923c' : '#7c3aed';

    // SVG gauge (half circle)
    const dashTotal = 283; // circumference of r=45 semicircle ≈ π*90
    const dashUsed = (pct / 100) * dashTotal;

    let html = '<div style="display:flex;flex-direction:column;align-items:center;gap:8px;">';
    html += '<svg width="160" height="100" viewBox="0 0 160 100">';
    html += '<path d="M15,90 A65,65 0 0,1 145,90" fill="none" stroke="var(--bg3)" stroke-width="14" stroke-linecap="round"/>';
    html += '<path d="M15,90 A65,65 0 0,1 145,90" fill="none" stroke="' + color + '" stroke-width="14" stroke-linecap="round" stroke-dasharray="' + dashTotal + '" stroke-dashoffset="' + (dashTotal - dashUsed) + '" style="transition:stroke-dashoffset .5s;"/>';
    html += '<text x="80" y="75" text-anchor="middle" fill="var(--tx)" font-size="24" font-weight="800" font-family="Syne,sans-serif">' + pct + '%</text>';
    html += '<text x="80" y="92" text-anchor="middle" fill="var(--tx3)" font-size="10" font-family="Manrope,sans-serif">' + totalMinutes + ' / ' + planLimit + ' min</text>';
    html += '</svg>';
    html += '<div style="font-size:12px;color:var(--tx3);text-align:center;">' + remaining + ' Minuten verbleibend</div>';
    html += '</div>';
    container.innerHTML = html;
  },

  // ==========================================
  // DATA HELPERS
  // ==========================================

  _groupByDay() {
    const map = {};
    this._calls.forEach(c => {
      if (!c.created_at) return;
      const day = c.created_at.slice(0, 10);
      if (!map[day]) map[day] = { date: day, count: 0, booked: 0, sentimentSum: 0, sentimentCount: 0 };
      map[day].count++;
      if (c.outcome === 'termin' || c.status === 'completed') map[day].booked++;
      if (c.sentiment_score != null) {
        map[day].sentimentSum += c.sentiment_score;
        map[day].sentimentCount++;
      }
    });

    return Object.keys(map).sort().map(day => {
      const d = map[day];
      const dateObj = new Date(day);
      return {
        date: day,
        label: dateObj.getDate() + '.' + (dateObj.getMonth() + 1) + '.',
        count: d.count,
        booked: d.booked,
        avgSentiment: d.sentimentCount > 0 ? Math.round((d.sentimentSum / d.sentimentCount) * 10) / 10 : null
      };
    });
  },

  _groupByWeek() {
    const map = {};
    this._calls.forEach(c => {
      if (!c.created_at) return;
      const d = new Date(c.created_at);
      const jan1 = new Date(d.getFullYear(), 0, 1);
      const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
      const key = d.getFullYear() + '-W' + week;
      if (!map[key]) map[key] = { week, total: 0, booked: 0 };
      map[key].total++;
      if (c.outcome === 'termin' || c.status === 'completed') map[key].booked++;
    });

    return Object.keys(map).sort().map(key => map[key]);
  },

  _emptyMsg(msg) {
    return '<div style="color:var(--tx3);font-size:13px;text-align:center;padding:40px 20px;">' + (msg || 'Noch nicht genug Daten vorhanden.') + '</div>';
  }
};

window.AnalyticsPage = AnalyticsPage;
