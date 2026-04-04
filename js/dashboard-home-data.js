// Extracted from dashboard.js — Month Select, Home Data, Call Chart
// MONTH SELECT
// ==========================================
function initMonthSelect() {
  const sel = document.getElementById('monthSelect');
  const now = new Date();
  const months = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = months[d.getMonth()] + ' ' + d.getFullYear();
    sel.appendChild(opt);
  }
  sel.addEventListener('change', () => loadHomeData());
}

// ==========================================
// HOME DATA
// ==========================================
async function loadHomeData() {
  const monthOffset = parseInt(document.getElementById('monthSelect').value) || 0;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - monthOffset + 1, 0, 23, 59, 59);

  const result = await clanaDB.getStats(start.toISOString(), end.toISOString());
  if (result.success) {
    const s = result.stats;
    document.getElementById('csAnrufe').textContent = s.totalCalls.toLocaleString('de-DE');
    document.getElementById('csSms').textContent = formatMinutes(s.avgDuration);
    const completedCalls = s.statuses?.completed || 0;
    const successRate = s.totalCalls > 0 ? Math.round((completedCalls / s.totalCalls) * 100) : 0;
    document.getElementById('csKosten').textContent = successRate + '%';
  } else {
    document.getElementById('csAnrufe').textContent = '0';
    document.getElementById('csSms').textContent = '0 min';
    document.getElementById('csKosten').textContent = '0%';
  }

  // Balance donut
  const settingsResult = await clanaDB.getSettings();
  const settings = settingsResult.success ? settingsResult.data : {};
  const balance = settings.balance || 0;
  const maxBalance = Math.max(balance * 1.5, 100);
  const pct = Math.min(balance / maxBalance, 1);
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (pct * circumference);
  document.getElementById('donutArc').setAttribute('stroke-dashoffset', offset);
  document.getElementById('donutCenter').textContent = formatCurrency(balance);

  // Call chart
  drawCallChart(start, end);
}

// ==========================================
// SVG LINE CHART
// ==========================================
async function drawCallChart(start, end) {
  const svg = document.getElementById('callChart');
  if (!svg) return;
  const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  const callsResult = await clanaDB.getCalls(1000);
  const calls = callsResult.success ? callsResult.data : [];

  // Previous month range
  const prevStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);
  const prevEnd = new Date(start.getFullYear(), start.getMonth(), 0, 23, 59, 59);
  const prevDays = new Date(prevStart.getFullYear(), prevStart.getMonth() + 1, 0).getDate();

  // Count calls per day (current + previous month)
  const dayCounts = new Array(daysInMonth).fill(0);
  const prevCounts = new Array(prevDays).fill(0);
  calls.forEach(c => {
    const d = new Date(c.created_at);
    if (d >= start && d <= end) {
      dayCounts[d.getDate() - 1]++;
    } else if (d >= prevStart && d <= prevEnd) {
      prevCounts[d.getDate() - 1]++;
    }
  });

  const maxVal = Math.max(...dayCounts, ...prevCounts, 1);
  const w = 600;
  const h = 140;
  const padT = 10, padB = 25, padL = 5, padR = 5;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  function buildPath(counts, numDays) {
    return counts.slice(0, numDays).map((v, i) => {
      const x = padL + (i / (numDays - 1)) * chartW;
      const y = padT + chartH - (v / maxVal) * chartH;
      return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
  }

  const pathD = buildPath(dayCounts, daysInMonth);
  const prevPathD = buildPath(prevCounts, Math.min(prevDays, daysInMonth));

  // Area fill for current month
  const points = dayCounts.map((v, i) => ({
    x: padL + (i / (daysInMonth - 1)) * chartW,
    y: padT + chartH - (v / maxVal) * chartH
  }));
  const areaD = pathD + ' L' + points[points.length - 1].x.toFixed(1) + ',' + (padT + chartH) + ' L' + points[0].x.toFixed(1) + ',' + (padT + chartH) + ' Z';

  // X-axis labels
  let labels = '';
  for (let i = 0; i < daysInMonth; i += 5) {
    const x = padL + (i / (daysInMonth - 1)) * chartW;
    labels += '<text x="' + x.toFixed(1) + '" y="' + (h - 4) + '" fill="var(--tx3)" font-size="9" text-anchor="middle" font-family="Manrope">' + (i + 1) + '</text>';
  }

  svg.innerHTML =
    '<defs><linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--pu)" stop-opacity="0.3"/><stop offset="100%" stop-color="var(--pu)" stop-opacity="0.02"/></linearGradient></defs>' +
    '<path d="' + areaD + '" fill="url(#chartGrad)"/>' +
    '<path d="' + prevPathD + '" fill="none" stroke="var(--tx3)" stroke-width="1.5" stroke-dasharray="4 3" stroke-linecap="round" opacity="0.4"/>' +
    '<path d="' + pathD + '" fill="none" stroke="var(--pu3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<text x="' + (w - padR) + '" y="' + (padT + 10) + '" fill="var(--pu3)" font-size="8" text-anchor="end" font-family="Manrope">● Aktuell</text>' +
    '<text x="' + (w - padR) + '" y="' + (padT + 22) + '" fill="var(--tx3)" font-size="8" text-anchor="end" font-family="Manrope" opacity="0.5">┄ Vormonat</text>' +
    labels;
}
