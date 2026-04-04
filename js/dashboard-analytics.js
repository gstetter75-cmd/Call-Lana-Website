// ==========================================
// Dashboard Analytics: Usage Alerts, Assistant Performance, Call Heatmap
// Depends on: db.js, config.js, dashboard-components.js
// ==========================================

const DashboardAnalytics = {

  // ==========================================
  // USAGE ALERTS
  // ==========================================

  async checkUsageAlerts() {
    const alertContainer = document.getElementById('usage-alert');
    if (!alertContainer) return;

    const settingsResult = await clanaDB.getSettings();
    if (!settingsResult.success) return;

    const balance = settingsResult.data?.balance || 0;
    const monthlyLimit = settingsResult.data?.monthly_limit || 500;
    const usagePct = monthlyLimit > 0 ? (1 - balance / monthlyLimit) * 100 : 0;

    if (balance <= 10) {
      alertContainer.innerHTML = `<div style="background:#ef444422;border:1px solid #ef444444;border-radius:12px;padding:12px 16px;display:flex;align-items:center;gap:10px;margin-bottom:16px;">
        <span style="font-size:20px;">🚨</span>
        <div><strong style="color:#ef4444;font-size:13px;">Guthaben fast aufgebraucht!</strong><br><span style="font-size:12px;color:var(--tx3);">Nur noch ${balance.toFixed(2)} € verbleibend. Bitte lade dein Guthaben auf.</span></div>
        <button class="btn btn-sm" onclick="navigateToPage('billing')" style="margin-left:auto;white-space:nowrap;">Aufladen</button>
      </div>`;
    } else if (balance <= 50) {
      alertContainer.innerHTML = `<div style="background:#f59e0b22;border:1px solid #f59e0b44;border-radius:12px;padding:12px 16px;display:flex;align-items:center;gap:10px;margin-bottom:16px;">
        <span style="font-size:20px;">⚠️</span>
        <div><strong style="color:#f59e0b;font-size:13px;">Guthaben wird knapp</strong><br><span style="font-size:12px;color:var(--tx3);">Noch ${balance.toFixed(2)} € verbleibend.</span></div>
        <button class="btn btn-sm btn-outline" onclick="navigateToPage('billing')" style="margin-left:auto;white-space:nowrap;">Aufladen</button>
      </div>`;
    } else {
      alertContainer.innerHTML = '';
    }
  },

  // ==========================================
  // ASSISTANT PERFORMANCE COMPARISON
  // ==========================================

  async loadAssistantPerformance() {
    const container = document.getElementById('assistant-performance');
    if (!container) return;

    const [assistantsRes, callsRes] = await Promise.all([
      clanaDB.getAssistants(),
      clanaDB.getCalls(5000)
    ]);

    const assistants = assistantsRes.data || [];
    const calls = callsRes.data || [];

    if (assistants.length < 1) {
      container.innerHTML = '<div style="color:var(--tx3);font-size:13px;text-align:center;padding:20px;">Erstelle Assistenten um Performance-Daten zu sehen.</div>';
      return;
    }

    const stats = assistants.map(a => {
      const aCalls = calls.filter(c => c.assistant_id === a.id);
      const completed = aCalls.filter(c => c.status === 'completed').length;
      const totalDur = aCalls.reduce((s, c) => s + (c.duration || 0), 0);
      const avgDur = aCalls.length ? Math.round(totalDur / aCalls.length) : 0;
      const successRate = aCalls.length ? Math.round((completed / aCalls.length) * 100) : 0;
      return { name: a.name, calls: aCalls.length, successRate, avgDur, status: a.status };
    }).sort((a, b) => b.successRate - a.successRate);

    const maxCalls = Math.max(...stats.map(s => s.calls), 1);
    const best = stats[0];

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="margin:0;font-size:14px;">Assistenten-Performance</h3>
        ${best && best.calls > 0 ? `<span class="badge badge-green" style="font-size:11px;">🏆 ${clanaUtils.sanitizeHtml(best.name)}</span>` : ''}
      </div>
      <table class="data-table" style="margin:0;">
        <thead><tr><th>Assistent</th><th>Anrufe</th><th>Erfolgsrate</th><th>Ø Dauer</th><th></th></tr></thead>
        <tbody>${stats.map(s => `
          <tr>
            <td><strong>${clanaUtils.sanitizeHtml(s.name)}</strong></td>
            <td>${s.calls}</td>
            <td><span style="color:${s.successRate >= 70 ? '#10b981' : s.successRate >= 40 ? '#f59e0b' : '#ef4444'};font-weight:700;">${s.successRate}%</span></td>
            <td>${s.avgDur > 60 ? Math.round(s.avgDur / 60) + ' min' : s.avgDur + ' sek'}</td>
            <td>
              <div style="width:60px;height:6px;background:var(--bg3);border-radius:3px;overflow:hidden;">
                <div style="width:${Math.round((s.calls / maxCalls) * 100)}%;height:100%;background:var(--pu);border-radius:3px;"></div>
              </div>
            </td>
          </tr>
        `).join('')}</tbody>
      </table>
    `;
  },

  // ==========================================
  // CALL STATISTICS HEATMAP
  // ==========================================

  async loadCallHeatmap() {
    const container = document.getElementById('call-heatmap');
    if (!container) return;

    const callsRes = await clanaDB.getCalls(5000);
    const calls = callsRes.data || [];

    if (!calls.length) {
      container.innerHTML = '<div style="color:var(--tx3);font-size:13px;text-align:center;padding:20px;">Noch keine Anrufe für die Heatmap.</div>';
      return;
    }

    // Build 7x24 grid (rows=hours 0-23, cols=days Mon-Sun)
    const grid = Array.from({ length: 24 }, () => Array(7).fill(0));
    let maxCount = 0;

    calls.forEach(c => {
      if (!c.created_at) return;
      const d = new Date(c.created_at);
      const day = (d.getDay() + 6) % 7; // Mon=0, Sun=6
      const hour = d.getHours();
      grid[hour][day]++;
      maxCount = Math.max(maxCount, grid[hour][day]);
    });

    const dayLabels = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="margin:0;font-size:14px;">Anruf-Heatmap</h3>
        <span style="font-size:11px;color:var(--tx3);">${calls.length} Anrufe total</span>
      </div>
      <div style="overflow-x:auto;">
        <div style="display:grid;grid-template-columns:36px repeat(7,1fr);gap:2px;min-width:300px;">
          <div></div>
          ${dayLabels.map(d => `<div style="text-align:center;font-size:10px;color:var(--tx3);font-weight:600;">${d}</div>`).join('')}
          ${grid.slice(6, 22).map((row, hi) => {
            const hour = hi + 6;
            return `<div style="font-size:10px;color:var(--tx3);text-align:right;padding-right:4px;line-height:20px;">${hour}:00</div>` +
              row.map(count => {
                const intensity = maxCount > 0 ? count / maxCount : 0;
                const bg = count === 0 ? 'var(--bg3)' : `rgba(124,58,237,${0.15 + intensity * 0.75})`;
                return `<div style="height:20px;border-radius:3px;background:${bg};display:flex;align-items:center;justify-content:center;" title="${count} Anrufe">
                  ${count > 0 ? `<span style="font-size:9px;color:white;font-weight:600;">${count}</span>` : ''}
                </div>`;
              }).join('');
          }).join('')}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;margin-top:8px;justify-content:flex-end;">
        <span style="font-size:10px;color:var(--tx3);">Wenig</span>
        ${[0.15, 0.35, 0.55, 0.75, 0.9].map(o => `<div style="width:14px;height:14px;border-radius:3px;background:rgba(124,58,237,${o});"></div>`).join('')}
        <span style="font-size:10px;color:var(--tx3);">Viel</span>
      </div>
    `;
  }
};

window.DashboardAnalytics = DashboardAnalytics;
