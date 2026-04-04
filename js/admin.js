// Admin Dashboard — extracted from admin.html inline script
let currentProfile = null;
let editingUserId = null;

async function init() {
  currentProfile = await AuthGuard.requireSuperadmin();
  if (!currentProfile) return;

  await Components.loadSidebar('sidebar-container', currentProfile);

  // Sidebar logout
  document.getElementById('sidebar-logout')?.addEventListener('click', async () => {
    await clanaAuth.signOut();
    window.location.href = 'login.html';
  });

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Handle hash navigation
  const hash = window.location.hash.replace('#', '') || 'overview';
  switchTab(hash);

  loadOverview();
  loadUsers();
  loadOrgs();
  loadSystemStats();
  loadCustomers();

  // Search
  document.getElementById('user-search')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('#users-tbody tr').forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(q) ? '' : 'none';
    });
  });

  // Customer search
  document.getElementById('customer-search')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('#customers-tbody tr').forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });

  // Add org
  document.getElementById('btn-add-org')?.addEventListener('click', () => openModal('modal-add-org'));
  document.getElementById('btn-create-org')?.addEventListener('click', createOrg);
  document.getElementById('btn-save-role')?.addEventListener('click', saveUserRole);
}

const VALID_ADMIN_TABS = ['overview', 'analytics', 'onboarding', 'minutes-alert', 'error-log', 'integrations', 'customers', 'users', 'orgs', 'system'];

function switchTab(tab) {
  // Validate tab against whitelist
  if (!VALID_ADMIN_TABS.includes(tab)) tab = 'overview';
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  const section = document.getElementById('tab-' + tab);
  if (section) section.classList.add('active');
  const tabLabels = { overview: 'Übersicht', analytics: 'Analytics', onboarding: 'Onboarding', 'minutes-alert': 'Minuten-Alert', 'error-log': 'Fehler-Log', integrations: 'Integrationen', customers: 'Kunden', users: 'Benutzer', orgs: 'Organisationen', system: 'System' };
  document.getElementById('breadcrumb-page').textContent = tabLabels[tab] || tab;
  window.location.hash = tab;

  if (tab === 'system') {
    if (typeof AdminAudit !== 'undefined') {
      AdminAudit.initActivityFeed(document.getElementById('admin-activity-feed'));
      AdminAudit.renderAuditLog(document.getElementById('admin-audit-log'));
    }
    if (typeof SystemHealth !== 'undefined') {
      SystemHealth.renderHealthDashboard(document.getElementById('admin-system-health'));
    }
  }
  if (tab === 'integrations' && typeof IntegrationsHub !== 'undefined') {
    IntegrationsHub.renderStripeSettings(document.getElementById('int-stripe'));
    IntegrationsHub.renderCalendarSync(document.getElementById('int-calendar'));
    IntegrationsHub.renderEmailSettings(document.getElementById('int-email'));
    IntegrationsHub.renderFileUpload(document.getElementById('int-files'));
    IntegrationsHub.renderPhoneSettings(document.getElementById('int-phone'));
  }
  if (tab === 'analytics' && typeof AdminAnalytics !== 'undefined') {
    AdminAnalytics.renderRevenueForecast(document.getElementById('admin-forecast'));
    AdminAnalytics.renderChurnWarnings(document.getElementById('admin-churn'));
    AdminAnalytics.renderCohortAnalysis(document.getElementById('admin-cohorts'));
    AdminAnalytics.renderWebhookConfig(document.getElementById('admin-webhooks'));
  }
  if (typeof AdminExtra !== 'undefined') {
    AdminExtra.initTab(tab);
  }
}

async function loadUsers() {
  const result = await clanaDB.getAllProfiles();
  if (!result.success) {
    Components.toast('Fehler beim Laden der Benutzer', 'error');
    return;
  }
  const tbody = document.getElementById('users-tbody');
  if (!result.data.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Keine Benutzer gefunden</td></tr>';
    return;
  }
  tbody.innerHTML = result.data.map(u => `
    <tr>
      <td><strong>${clanaUtils.sanitizeHtml(u.first_name || '')} ${clanaUtils.sanitizeHtml(u.last_name || '')}</strong></td>
      <td>${clanaUtils.sanitizeHtml(u.email || '')}</td>
      <td><span class="badge badge-${u.role === 'superadmin' ? 'red' : u.role === 'sales' ? 'orange' : 'green'} role-badge">${u.role}</span></td>
      <td>${u.organizations?.name || '—'}</td>
      <td><span class="badge ${u.is_active ? 'badge-green' : 'badge-red'}">${u.is_active ? 'Aktiv' : 'Gesperrt'}</span></td>
      <td>${clanaUtils.formatDate(u.created_at)}</td>
      <td>
        <div class="user-actions">
          <button onclick="editUserRole('${u.id}', '${clanaUtils.sanitizeHtml(u.email || '')}', '${u.role}', '${u.organization_id || ''}')">Rolle</button>
          <button onclick="toggleUserActive('${u.id}', ${u.is_active})">${u.is_active ? 'Sperren' : 'Aktivieren'}</button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function loadOrgs() {
  const result = await clanaDB.getOrganizations();
  if (!result.success) return;
  const tbody = document.getElementById('orgs-tbody');
  if (!result.data.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Keine Organisationen</td></tr>';
    return;
  }
  tbody.innerHTML = result.data.map(o => `
    <tr>
      <td><strong>${clanaUtils.sanitizeHtml(o.name)}</strong></td>
      <td><span class="badge badge-purple">${o.plan}</span></td>
      <td>${o.profiles ? `${o.profiles.first_name || ''} ${o.profiles.last_name || ''}` : '—'}</td>
      <td>${o.max_users || 1}</td>
      <td><span class="badge ${o.is_active ? 'badge-green' : 'badge-red'}">${o.is_active ? 'Aktiv' : 'Inaktiv'}</span></td>
      <td>${clanaUtils.formatDate(o.created_at)}</td>
      <td>
        <div class="user-actions">
          <button onclick="editOrg('${o.id}')">Bearbeiten</button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function loadSystemStats() {
  const [users, orgs, leads, tasks] = await Promise.all([
    clanaDB.getAllProfiles(),
    clanaDB.getOrganizations(),
    clanaDB.getLeads(),
    clanaDB.getTasks()
  ]);

  const allUsers = users.data || [];
  const allOrgs = orgs.data || [];
  const allLeads = leads.data || [];
  const allTasks = tasks.data || [];

  // Primary KPIs
  document.getElementById('sys-total-users').textContent = allUsers.length;
  document.getElementById('sys-total-orgs').textContent = allOrgs.length;

  // Secondary KPIs
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const newLeads = allLeads.filter(l => l.created_at >= sevenDaysAgo);
  const activeLeads = allLeads.filter(l => !['won', 'lost'].includes(l.status));
  const openTasks = allTasks.filter(t => t.status !== 'done');
  const wonLeads = allLeads.filter(l => l.status === 'won');
  const conversionRate = allLeads.length ? Math.round((wonLeads.length / allLeads.length) * 100) : 0;

  document.getElementById('sys-new-leads').textContent = newLeads.length;
  document.getElementById('sys-active-leads').textContent = activeLeads.length;
  document.getElementById('sys-open-tasks').textContent = openTasks.length;
  document.getElementById('sys-conversion').textContent = conversionRate + '%';

  // Role distribution
  const roles = { superadmin: 0, sales: 0, customer: 0 };
  allUsers.forEach(u => { if (roles[u.role] !== undefined) roles[u.role]++; });
  document.getElementById('sys-role-superadmin').textContent = roles.superadmin;
  document.getElementById('sys-role-sales').textContent = roles.sales;
  document.getElementById('sys-role-customer').textContent = roles.customer;

  // Plan distribution (handle both legacy solo/team and new starter/professional names)
  const plans = { solo: 0, team: 0, business: 0 };
  allOrgs.forEach(o => {
    const p = (o.plan || '').toLowerCase();
    if (p === 'starter' || p === 'solo') plans.solo++;
    else if (p === 'professional' || p === 'team') plans.team++;
    else if (p === 'business') plans.business++;
  });
  document.getElementById('sys-plan-solo').textContent = plans.solo;
  document.getElementById('sys-plan-team').textContent = plans.team;
  document.getElementById('sys-plan-business').textContent = plans.business;

  // Assistants count
  try {
    const assistantsResult = await clanaDB.getAllAssistants();
    document.getElementById('sys-total-assistants').textContent = assistantsResult.data?.length || 0;
  } catch (e) {
    document.getElementById('sys-total-assistants').textContent = '-';
  }

  // Recent activity (newest leads + tasks as proxy)
  const recentItems = [
    ...newLeads.slice(0, 5).map(l => ({
      time: l.created_at,
      user: l.profiles ? `${l.profiles.first_name || ''} ${l.profiles.last_name || ''}` : '—',
      action: 'Neuer Lead',
      details: clanaUtils.sanitizeHtml(l.company_name)
    })),
    ...allTasks.filter(t => t.created_at >= sevenDaysAgo).slice(0, 5).map(t => ({
      time: t.created_at,
      user: t.profiles ? `${t.profiles.first_name || ''} ${t.profiles.last_name || ''}` : '—',
      action: 'Neue Aufgabe',
      details: clanaUtils.sanitizeHtml(t.title)
    }))
  ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 10);

  const tbody = document.getElementById('sys-activity-tbody');
  if (recentItems.length) {
    tbody.innerHTML = recentItems.map(item => `
      <tr>
        <td>${clanaUtils.formatDate(item.time)}</td>
        <td>${item.user}</td>
        <td><span class="badge badge-purple">${item.action}</span></td>
        <td>${item.details}</td>
      </tr>
    `).join('');
  } else {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--tx3);padding:20px;">Keine Aktivität in den letzten 7 Tagen</td></tr>';
  }
}

// ---- OVERVIEW (Vogelperspektive) ----

const PLAN_PRICES = CONFIG.PLANS;

async function loadOverview() {
  const [usersResult, orgsResult, leadsResult] = await Promise.all([
    clanaDB.getAllProfiles(),
    clanaDB.getOrganizations(),
    clanaDB.getLeads()
  ]);

  const allUsers = usersResult.data || [];
  const allOrgs = orgsResult.data || [];
  const allLeads = leadsResult.data || [];
  const customers = allUsers.filter(u => u.role === 'customer' && u.is_active !== false);

  // Calculate MRR from organizations
  let mrr = 0;
  const planCounts = { starter: 0, professional: 0, business: 0 };

  allOrgs.filter(o => o.is_active !== false).forEach(o => {
    const plan = (o.plan || 'solo').toLowerCase();
    const price = CONFIG.getPlanPrice(plan);
    mrr += price;
    const normalized = plan === 'solo' ? 'starter' : plan === 'team' ? 'professional' : plan;
    if (planCounts[normalized] !== undefined) planCounts[normalized]++;
  });

  // If no orgs, estimate from customer count
  if (mrr === 0 && customers.length > 0) {
    mrr = customers.length * PLAN_PRICES.starter;
    planCounts.starter = customers.length;
  }

  const arr = mrr * 12;
  const arpu = customers.length ? Math.round(mrr / customers.length) : 0;

  document.getElementById('ov-mrr').textContent = mrr.toLocaleString('de-DE') + ' €';
  document.getElementById('ov-active-customers').textContent = customers.length;
  document.getElementById('ov-arr').textContent = arr.toLocaleString('de-DE') + ' €';
  document.getElementById('ov-arpu').textContent = arpu.toLocaleString('de-DE') + ' €';

  // Plan breakdown
  const planBreakdown = document.getElementById('ov-plan-breakdown');
  const totalPlanCustomers = Object.values(planCounts).reduce((a, b) => a + b, 0) || 1;
  planBreakdown.innerHTML = [
    { label: 'Starter (149 €)', count: planCounts.starter, color: 'var(--cyan)', revenue: planCounts.starter * 149 },
    { label: 'Professional (299 €)', count: planCounts.professional, color: 'var(--pu3)', revenue: planCounts.professional * 299 },
    { label: 'Business (599 €)', count: planCounts.business, color: 'var(--green)', revenue: planCounts.business * 599 },
  ].map(p => `
    <div>
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
        <span style="color:var(--tx2);">${p.label}</span>
        <span style="font-weight:700;">${p.count} Kunden · ${p.revenue.toLocaleString('de-DE')} €/M</span>
      </div>
      <div style="height:6px;background:var(--bg3);border-radius:3px;overflow:hidden;">
        <div style="height:100%;width:${Math.round((p.count / totalPlanCustomers) * 100)}%;background:${p.color};border-radius:3px;transition:width .3s;"></div>
      </div>
    </div>
  `).join('');

  // Top sales
  const salesUsers = allUsers.filter(u => u.role === 'sales');
  const topSalesEl = document.getElementById('ov-top-sales');
  if (salesUsers.length) {
    const salesWithLeads = salesUsers.map(s => {
      const wonLeads = allLeads.filter(l => l.assigned_to === s.id && l.status === 'won');
      const pipelineValue = allLeads.filter(l => l.assigned_to === s.id && !['won', 'lost'].includes(l.status))
        .reduce((sum, l) => sum + (Number(l.value) || 0), 0);
      return { ...s, wonCount: wonLeads.length, pipelineValue };
    }).sort((a, b) => b.wonCount - a.wonCount);

    topSalesEl.innerHTML = salesWithLeads.map((s, i) => `
      <div style="display:flex;align-items:center;gap:12px;padding:8px 0;${i < salesWithLeads.length - 1 ? 'border-bottom:1px solid var(--border);' : ''}">
        <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--pu),var(--pu3));display:flex;align-items:center;justify-content:center;font-size:11px;color:white;font-weight:700;">${(s.first_name?.[0] || '') + (s.last_name?.[0] || '')}</div>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:600;">${clanaUtils.sanitizeHtml(s.first_name || '')} ${clanaUtils.sanitizeHtml(s.last_name || '')}</div>
          <div style="font-size:11px;color:var(--tx3);">${s.wonCount} gewonnen · ${s.pipelineValue.toLocaleString('de-DE')} € Pipeline</div>
        </div>
        <span class="badge badge-green">${s.wonCount} Deals</span>
      </div>
    `).join('');
  } else {
    topSalesEl.innerHTML = '<div style="text-align:center;color:var(--tx3);font-size:12px;padding:20px;">Keine Vertriebler vorhanden</div>';
  }

  // Recent customers
  const recentCustomers = customers
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 10);

  const recentTbody = document.getElementById('ov-recent-tbody');
  if (recentCustomers.length) {
    recentTbody.innerHTML = recentCustomers.map(c => {
      const plan = c.organizations?.plan || 'starter';
      const price = CONFIG.getPlanPrice(plan);
      // Find assigned sales person via leads
      const matchingLead = allLeads.find(l => l.email === c.email && l.status === 'won');
      const salesName = matchingLead?.profiles ? `${matchingLead.profiles.first_name || ''} ${matchingLead.profiles.last_name || ''}`.trim() : '—';

      return `
        <tr>
          <td><strong>${clanaUtils.sanitizeHtml(c.first_name || '')} ${clanaUtils.sanitizeHtml(c.last_name || '')}</strong></td>
          <td>${clanaUtils.sanitizeHtml(c.email || '')}</td>
          <td><span class="badge badge-purple">${plan}</span></td>
          <td>${price.toLocaleString('de-DE')} €</td>
          <td>${clanaUtils.sanitizeHtml(salesName)}</td>
          <td>${clanaUtils.formatDate(c.created_at)}</td>
          <td><button class="btn btn-sm btn-outline" onclick="viewCustomer('${c.id}')">Details</button></td>
        </tr>
      `;
    }).join('');
  } else {
    recentTbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--tx3);padding:20px;">Noch keine Kunden</td></tr>';
  }

  // Churn Stats
  const activeCustomers = allUsers.filter(u => u.role === 'customer' && u.is_active !== false);
  const inactiveCustomers = allUsers.filter(u => u.role === 'customer' && u.is_active === false);
  const totalCustomers = activeCustomers.length + inactiveCustomers.length;
  const churnRate = totalCustomers > 0 ? Math.round((inactiveCustomers.length / totalCustomers) * 100) : 0;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const newThisMonth = activeCustomers.filter(c => new Date(c.created_at) >= thirtyDaysAgo).length;

  const churnEl = document.getElementById('ov-churn-stats');
  churnEl.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div style="background:var(--bg2);border-radius:10px;padding:14px;">
        <div style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;margin-bottom:4px;">Churn-Rate</div>
        <div style="font-family:'Syne',sans-serif;font-size:1.3rem;font-weight:800;color:${churnRate > 10 ? 'var(--red)' : churnRate > 5 ? 'var(--orange)' : 'var(--green)'};">${churnRate}%</div>
      </div>
      <div style="background:var(--bg2);border-radius:10px;padding:14px;">
        <div style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;margin-bottom:4px;">Neu (30 Tage)</div>
        <div style="font-family:'Syne',sans-serif;font-size:1.3rem;font-weight:800;color:var(--green);">+${newThisMonth}</div>
      </div>
    </div>
    ${inactiveCustomers.length > 0 ? `
    <div style="margin-top:8px;">
      <div style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;margin-bottom:6px;">Inaktive Kunden (${inactiveCustomers.length})</div>
      ${inactiveCustomers.slice(0, 5).map(c => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:12px;">
          <span style="color:var(--tx2);">${clanaUtils.sanitizeHtml((c.first_name || '') + ' ' + (c.last_name || ''))}</span>
          <button class="btn btn-sm btn-outline" style="font-size:10px;padding:2px 8px;" onclick="toggleUserActive('${c.id}',false)">Aktivieren</button>
        </div>
      `).join('')}
    </div>` : '<div style="text-align:center;color:var(--green);font-size:12px;padding:12px;">Keine inaktiven Kunden</div>'}
  `;

  // MRR Chart (estimated from customer registration dates)
  renderMrrChart(allUsers, allOrgs);

  // Enhanced widgets
  if (typeof AdminOverview !== 'undefined') {
    AdminOverview.renderQuickActions(document.getElementById('admin-quick-actions'));
    AdminOverview.renderKpiComparison(mrr, customers, allUsers);
    AdminOverview.renderLeaderboard(document.getElementById('admin-leaderboard'), allUsers, allLeads);

    // Customer health (needs calls data)
    try {
      const callsRes = await clanaDB.getCalls(5000);
      AdminOverview.renderHealthOverview(document.getElementById('admin-health-overview'), customers, callsRes?.data || []);
    } catch (e) {
      AdminOverview.renderHealthOverview(document.getElementById('admin-health-overview'), customers, callsRes?.data || []);
    }

    // Customer journey funnel (needs customers from DB)
    let dbCustomers = [];
    try {
      const custRes = await clanaDB.getCustomers({});
      dbCustomers = custRes.data || [];
    } catch (e) {}
    AdminOverview.renderCustomerFunnel(document.getElementById('admin-journey-funnel'), allLeads, dbCustomers);
  }

  // Audit module: goals + announcements
  if (typeof AdminAudit !== 'undefined') {
    AdminAudit.renderGoals(document.getElementById('admin-goals'), mrr, customers.length);
    AdminAudit.renderAnnouncements(document.getElementById('admin-announcements'));
  }
}

function renderMrrChart(allUsers, allOrgs) {
  const svg = document.getElementById('ov-mrr-chart');
  if (!svg) return;

  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d);
  }
  const monthNames = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

  // Calculate cumulative MRR per month
  const customers = allUsers.filter(u => u.role === 'customer');
  const mrrPerMonth = months.map(m => {
    const endOfMonth = new Date(m.getFullYear(), m.getMonth() + 1, 0, 23, 59, 59);
    const activeAtMonth = customers.filter(c => new Date(c.created_at) <= endOfMonth && c.is_active !== false);
    let mrr = 0;
    activeAtMonth.forEach(c => {
      const org = allOrgs.find(o => o.id === c.organization_id);
      mrr += CONFIG.getPlanPrice(org?.plan || 'starter');
    });
    if (mrr === 0 && activeAtMonth.length > 0) mrr = activeAtMonth.length * CONFIG.getPlanPrice('starter');
    return mrr;
  });

  const maxMrr = Math.max(...mrrPerMonth, 1);
  const w = 400, h = 120, padT = 15, padB = 22, padL = 40, padR = 10;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  const points = mrrPerMonth.map((v, i) => ({
    x: padL + (i / Math.max(mrrPerMonth.length - 1, 1)) * chartW,
    y: padT + chartH - (v / maxMrr) * chartH
  }));

  const pathD = points.map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ');
  const areaD = pathD + ` L${points[points.length-1].x.toFixed(1)},${padT+chartH} L${points[0].x.toFixed(1)},${padT+chartH} Z`;

  let labels = months.map((m, i) => {
    const x = padL + (i / Math.max(months.length - 1, 1)) * chartW;
    return `<text x="${x.toFixed(1)}" y="${h - 4}" fill="var(--tx3)" font-size="9" text-anchor="middle" font-family="Manrope">${monthNames[m.getMonth()]}</text>`;
  }).join('');

  // Y-axis labels
  labels += `<text x="${padL - 4}" y="${padT + 4}" fill="var(--tx3)" font-size="8" text-anchor="end" font-family="Manrope">${(maxMrr/1000).toFixed(1)}k</text>`;
  labels += `<text x="${padL - 4}" y="${padT + chartH}" fill="var(--tx3)" font-size="8" text-anchor="end" font-family="Manrope">0</text>`;

  // Value dots
  const dots = points.map((p, i) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="var(--green)" stroke="var(--card)" stroke-width="2"/>`).join('');

  svg.innerHTML = `
    <defs><linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--green)" stop-opacity="0.25"/><stop offset="100%" stop-color="var(--green)" stop-opacity="0.02"/></linearGradient></defs>
    <path d="${areaD}" fill="url(#mrrGrad)"/>
    <path d="${pathD}" fill="none" stroke="var(--green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    ${dots}${labels}
  `;

  // Growth rate display
  const growthEl = document.getElementById('ov-mrr-growth');
  if (growthEl && mrrPerMonth.length >= 2) {
    const current = mrrPerMonth[mrrPerMonth.length - 1];
    const prev = mrrPerMonth[mrrPerMonth.length - 2];
    const growth = prev > 0 ? Math.round(((current - prev) / prev) * 100) : 0;
    const isUp = growth >= 0;
    growthEl.innerHTML = `<span style="font-size:12px;font-weight:700;color:${isUp ? '#10b981' : '#ef4444'};">${isUp ? '↑' : '↓'} ${Math.abs(growth)}% Wachstum</span> <span style="font-size:11px;color:var(--tx3);">vs. Vormonat</span>`;
  }
}

// ---- CUSTOMERS ----

async function loadCustomers() {
  const result = await clanaDB.getAllProfiles();
  if (!result.success) return;

  const customers = (result.data || []).filter(u => u.role === 'customer');
  const tbody = document.getElementById('customers-tbody');

  if (!customers.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--tx3);padding:40px;">Keine Kunden gefunden</td></tr>';
    return;
  }

  tbody.innerHTML = customers.map(c => {
    const plan = c.organizations?.plan || 'starter';
    const price = CONFIG.getPlanPrice(plan);

    return `
      <tr>
        <td><strong>${clanaUtils.sanitizeHtml(c.first_name || '')} ${clanaUtils.sanitizeHtml(c.last_name || '')}</strong></td>
        <td>${clanaUtils.sanitizeHtml(c.email || '')}</td>
        <td>${clanaUtils.sanitizeHtml(c.company || c.organizations?.name || '—')}</td>
        <td><span class="badge badge-purple">${plan}</span></td>
        <td>${price.toLocaleString('de-DE')} €</td>
        <td>${clanaUtils.sanitizeHtml(c.industry || '—')}</td>
        <td><span class="badge ${c.is_active !== false ? 'badge-green' : 'badge-red'}">${c.is_active !== false ? 'Aktiv' : 'Inaktiv'}</span></td>
        <td>${clanaUtils.formatDate(c.created_at)}</td>
        <td><button class="btn btn-sm btn-outline" onclick="viewCustomer('${c.id}')">Details</button></td>
      </tr>
    `;
  }).join('');
}

async function viewCustomer(customerId) {
  openModal('modal-customer-detail');
  const container = document.getElementById('customer-detail-content');
  container.innerHTML = '<div style="text-align:center;color:var(--tx3);padding:40px;">Laden...</div>';

  const { data: customer, error } = await supabaseClient
    .from('profiles')
    .select('*, organizations(name, plan)')
    .eq('id', customerId)
    .single();

  if (error || !customer) {
    container.innerHTML = '<div style="text-align:center;color:var(--red);padding:40px;">Fehler beim Laden.</div>';
    return;
  }

  const plan = customer.organizations?.plan || 'starter';
  const price = CONFIG.getPlanPrice(plan);

  // Load usage data
  const [callsRes, assistantsRes] = await Promise.all([
    supabaseClient.from('calls').select('id,duration,status,created_at').eq('user_id', customerId).order('created_at', { ascending: false }).limit(100),
    supabaseClient.from('assistants').select('id,name,status').eq('user_id', customerId)
  ]);
  const calls = callsRes.data || [];
  const assistants = assistantsRes.data || [];
  const totalCalls = calls.length;
  const totalMinutes = Math.round(calls.reduce((s, c) => s + (c.duration || 0), 0) / 60);
  const completedCalls = calls.filter(c => c.status === 'completed').length;
  const successRate = totalCalls > 0 ? Math.round((completedCalls / totalCalls) * 100) : 0;
  const liveAssistants = assistants.filter(a => a.status === 'live').length;

  container.innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;">
      <div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,var(--pu),var(--pu3));display:flex;align-items:center;justify-content:center;font-size:16px;color:white;font-weight:700;">
        ${((customer.first_name?.[0] || '') + (customer.last_name?.[0] || '')).toUpperCase() || '?'}
      </div>
      <div>
        <div style="font-family:'Syne',sans-serif;font-size:1.2rem;font-weight:700;">${clanaUtils.sanitizeHtml(customer.first_name || '')} ${clanaUtils.sanitizeHtml(customer.last_name || '')}</div>
        <div style="font-size:12px;color:var(--tx3);">${clanaUtils.sanitizeHtml(customer.email || '')}</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:16px;background:var(--bg2);border-radius:12px;margin-bottom:20px;">
      <div>
        <div style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px;">Unternehmen</div>
        <div style="font-size:13px;">${clanaUtils.sanitizeHtml(customer.company || customer.organizations?.name || '—')}</div>
      </div>
      <div>
        <div style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px;">Branche</div>
        <div style="font-size:13px;">${clanaUtils.sanitizeHtml(customer.industry || '—')}</div>
      </div>
      <div>
        <div style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px;">Plan</div>
        <div style="font-size:13px;"><span class="badge badge-purple">${plan}</span></div>
      </div>
      <div>
        <div style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px;">Monatl. Umsatz</div>
        <div style="font-size:13px;font-weight:700;color:var(--green);">${price.toLocaleString('de-DE')} €</div>
      </div>
      <div>
        <div style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px;">Status</div>
        <div><span class="badge ${customer.is_active !== false ? 'badge-green' : 'badge-red'}">${customer.is_active !== false ? 'Aktiv' : 'Inaktiv'}</span></div>
      </div>
      <div>
        <div style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px;">Registriert</div>
        <div style="font-size:13px;">${clanaUtils.formatDate(customer.created_at)}</div>
      </div>
    </div>

    <!-- Usage Stats -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:20px;">
      <div style="background:var(--bg2);border-radius:10px;padding:12px;text-align:center;">
        <div style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;margin-bottom:4px;">Anrufe</div>
        <div style="font-family:'Syne',sans-serif;font-size:1.1rem;font-weight:800;">${totalCalls}</div>
      </div>
      <div style="background:var(--bg2);border-radius:10px;padding:12px;text-align:center;">
        <div style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;margin-bottom:4px;">Minuten</div>
        <div style="font-family:'Syne',sans-serif;font-size:1.1rem;font-weight:800;">${totalMinutes}</div>
      </div>
      <div style="background:var(--bg2);border-radius:10px;padding:12px;text-align:center;">
        <div style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;margin-bottom:4px;">Erfolgsrate</div>
        <div style="font-family:'Syne',sans-serif;font-size:1.1rem;font-weight:800;color:${successRate >= 80 ? 'var(--green)' : successRate >= 50 ? 'var(--orange)' : 'var(--red)'};">${successRate}%</div>
      </div>
      <div style="background:var(--bg2);border-radius:10px;padding:12px;text-align:center;">
        <div style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;margin-bottom:4px;">Assistenten</div>
        <div style="font-family:'Syne',sans-serif;font-size:1.1rem;font-weight:800;">${liveAssistants}/${assistants.length}</div>
      </div>
    </div>

    <div style="display:flex;gap:8px;justify-content:flex-end;">
      <button class="btn btn-sm" style="background:linear-gradient(135deg,#f59e0b,#d97706);box-shadow:0 0 12px rgba(245,158,11,.3);" onclick="closeModal('modal-customer-detail'); ImpersonationManager.start('${customer.id}');">👁 Als Kunde anmelden</button>
      <button class="btn btn-sm btn-outline" onclick="editUserRole('${customer.id}', '${clanaUtils.sanitizeHtml(customer.email || '')}', '${customer.role}', '${customer.organization_id || ''}'); closeModal('modal-customer-detail');">Rolle ändern</button>
      <button class="btn btn-sm ${customer.is_active !== false ? 'btn-danger' : ''}" onclick="toggleUserActive('${customer.id}', ${customer.is_active !== false}); closeModal('modal-customer-detail');">
        ${customer.is_active !== false ? 'Sperren' : 'Aktivieren'}
      </button>
    </div>
  `;
}

// ---- CSV EXPORT ----

function exportCustomersCSV() {
  const rows = document.querySelectorAll('#customers-tbody tr');
  if (!rows.length) { Components.toast('Keine Daten zum Exportieren', 'error'); return; }

  let csv = 'Name,E-Mail,Unternehmen,Plan,Monatl. Netto,Branche,Status,Registriert\n';
  rows.forEach(row => {
    if (row.style.display === 'none') return;
    const cells = row.querySelectorAll('td');
    if (cells.length < 8) return;
    const values = Array.from(cells).slice(0, 8).map(td => '"' + td.textContent.trim().replace(/"/g, '""') + '"');
    csv += values.join(',') + '\n';
  });

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'call-lana-kunden-' + new Date().toISOString().split('T')[0] + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  Components.toast('CSV exportiert', 'success');
}

function editUserRole(userId, email, currentRole, currentOrgId) {
  editingUserId = userId;
  document.getElementById('edit-role-user').value = email;
  document.getElementById('edit-role-select').value = currentRole;
  // Load orgs into select
  loadOrgSelect(currentOrgId);
  openModal('modal-edit-role');
}

async function loadOrgSelect(currentOrgId) {
  const result = await clanaDB.getOrganizations();
  const select = document.getElementById('edit-role-org');
  select.innerHTML = '<option value="">Keine</option>';
  if (result.success && result.data) {
    result.data.forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.id;
      opt.textContent = o.name;
      if (o.id === currentOrgId) opt.selected = true;
      select.appendChild(opt);
    });
  }
}

async function saveUserRole() {
  if (!editingUserId) return;
  if (editingUserId === currentProfile.id) {
    Components.toast('Du kannst deine eigene Rolle nicht ändern.', 'error');
    return;
  }
  const role = document.getElementById('edit-role-select').value;
  const orgId = document.getElementById('edit-role-org').value || null;

  const result = await clanaDB.updateProfile(editingUserId, { role, organization_id: orgId });
  if (result.success) {
    Components.toast('Rolle aktualisiert', 'success');
    if (typeof AdminAudit !== 'undefined') AdminAudit.logAction('role_change', 'profile', editingUserId, null, { role });
    closeModal('modal-edit-role');
    loadUsers();
  } else {
    Components.toast('Fehler: ' + result.error, 'error');
  }
}

async function toggleUserActive(userId, currentlyActive) {
  const result = await clanaDB.updateProfile(userId, { is_active: !currentlyActive });
  if (result.success) {
    Components.toast(currentlyActive ? 'Benutzer gesperrt' : 'Benutzer aktiviert', 'success');
    loadUsers();
  } else {
    Components.toast('Fehler: ' + result.error, 'error');
  }
}

async function createOrg() {
  const name = document.getElementById('org-name').value.trim();
  const plan = document.getElementById('org-plan').value;
  if (!name) { Components.toast('Name ist erforderlich', 'error'); return; }

  const btn = document.getElementById('btn-save-org');
  const editId = btn?.dataset.editId;

  if (editId) {
    // Update existing org
    const { error } = await supabaseClient.from('organizations').update({ name, plan }).eq('id', editId);
    if (error) { Components.toast('Fehler: ' + error.message, 'error'); return; }
    Components.toast('Organisation aktualisiert', 'success');
    delete btn.dataset.editId;
    btn.textContent = 'Erstellen';
  } else {
    // Create new org
    const maxUsers = plan === 'solo' ? 1 : plan === 'team' ? 5 : 999;
    const result = await clanaDB.createOrganization({ name, plan, max_users: maxUsers, owner_id: currentProfile.id });
    if (!result.success) { Components.toast('Fehler: ' + result.error, 'error'); return; }
    Components.toast('Organisation erstellt', 'success');
    if (typeof AdminAudit !== 'undefined') AdminAudit.logAction('org_create', 'organization', null, null, { name, plan });
  }

  closeModal('modal-add-org');
  document.getElementById('org-name').value = '';
  loadOrgs();
  loadSystemStats();
}

async function editOrg(orgId) {
  const { data: org } = await supabaseClient.from('organizations').select('*').eq('id', orgId).single();
  if (!org) { Components.toast('Organisation nicht gefunden', 'error'); return; }

  document.getElementById('org-name').value = org.name || '';
  document.getElementById('org-plan').value = org.plan || 'starter';
  document.getElementById('btn-save-org').dataset.editId = orgId;
  document.getElementById('btn-save-org').textContent = 'Speichern';
  openModal('modal-add-org');
}

// openModal/closeModal provided by js/modal.js

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('active');
  });
});

init();
