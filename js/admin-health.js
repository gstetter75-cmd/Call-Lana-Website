// ==========================================
// System Health Monitoring
// Checks API response times, DB table sizes, error rates
// ==========================================

const SystemHealth = {

  async renderHealthDashboard(container) {
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;color:var(--tx3);padding:20px;">Prüfe Systemstatus…</div>';

    const checks = await Promise.all([
      this.checkSupabaseApi(),
      this.checkAuthService(),
      this.checkDatabaseTables(),
      this.checkStorageUsage()
    ]);

    const allOk = checks.every(c => c.status === 'ok');
    const statusColor = allOk ? '#10b981' : '#f59e0b';
    const statusText = allOk ? 'Alle Systeme operational' : 'Einige Checks haben Warnungen';

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="margin:0;font-size:14px;">System Health</h3>
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="width:8px;height:8px;border-radius:50%;background:${statusColor};"></span>
          <span style="font-size:11px;color:${statusColor};font-weight:600;">${statusText}</span>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;">
        ${checks.map(c => `
          <div style="padding:12px;background:var(--bg3);border-radius:10px;border-left:3px solid ${c.status === 'ok' ? '#10b981' : c.status === 'warning' ? '#f59e0b' : '#ef4444'};">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:12px;font-weight:600;">${c.name}</span>
              <span style="font-size:18px;">${c.status === 'ok' ? '✅' : c.status === 'warning' ? '⚠️' : '❌'}</span>
            </div>
            <div style="font-size:11px;color:var(--tx3);margin-top:4px;">${c.detail}</div>
            ${c.responseTime ? `<div style="font-size:10px;color:var(--tx3);margin-top:2px;">Antwortzeit: ${c.responseTime}ms</div>` : ''}
          </div>
        `).join('')}
      </div>

      <div style="text-align:center;margin-top:12px;">
        <button class="btn btn-sm btn-outline" onclick="SystemHealth.renderHealthDashboard(this.parentElement.parentElement)">🔄 Erneut prüfen</button>
      </div>
    `;
  },

  async checkSupabaseApi() {
    try {
      const start = performance.now();
      const { data, error } = await supabaseClient.from('profiles').select('id').limit(1);
      const responseTime = Math.round(performance.now() - start);

      if (error) return { name: 'Supabase API', status: 'error', detail: error.message, responseTime };
      return {
        name: 'Supabase API',
        status: responseTime < 1000 ? 'ok' : 'warning',
        detail: responseTime < 500 ? 'Schnell' : responseTime < 1000 ? 'Normal' : 'Langsam',
        responseTime
      };
    } catch (e) {
      return { name: 'Supabase API', status: 'error', detail: 'Nicht erreichbar' };
    }
  },

  async checkAuthService() {
    try {
      const start = performance.now();
      const user = await clanaAuth.getUser();
      const responseTime = Math.round(performance.now() - start);

      return {
        name: 'Auth Service',
        status: user ? 'ok' : 'warning',
        detail: user ? `Eingeloggt als ${user.email}` : 'Kein User',
        responseTime
      };
    } catch (e) {
      return { name: 'Auth Service', status: 'error', detail: 'Fehler' };
    }
  },

  async checkDatabaseTables() {
    const tables = ['profiles', 'organizations', 'leads', 'tasks', 'calls', 'assistants'];
    let okCount = 0;
    let totalTime = 0;

    for (const table of tables) {
      try {
        const start = performance.now();
        const { error } = await supabaseClient.from(table).select('id').limit(1);
        totalTime += performance.now() - start;
        if (!error) okCount++;
      } catch (e) { /* skip */ }
    }

    const avgTime = Math.round(totalTime / tables.length);
    return {
      name: 'Datenbank-Tabellen',
      status: okCount === tables.length ? 'ok' : okCount >= 4 ? 'warning' : 'error',
      detail: `${okCount}/${tables.length} Tabellen erreichbar`,
      responseTime: avgTime
    };
  },

  async checkStorageUsage() {
    try {
      const { data } = await supabaseClient.storage.listBuckets();
      const bucketCount = data?.length || 0;
      return {
        name: 'Storage',
        status: 'ok',
        detail: `${bucketCount} Bucket${bucketCount !== 1 ? 's' : ''} konfiguriert`
      };
    } catch (e) {
      return {
        name: 'Storage',
        status: 'warning',
        detail: 'Storage nicht verfügbar oder keine Buckets'
      };
    }
  }
};

window.SystemHealth = SystemHealth;
