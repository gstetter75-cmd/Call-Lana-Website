// ==========================================
// Admin PDF Report Export
// Depends on: jsPDF (loaded in admin.html), config.js, admin-overview.js
// ==========================================

const AdminPdfExport = {

  _jsPdfPromise: null,

  async _ensureJsPdf() {
    if (typeof window.jspdf !== 'undefined') return true;
    if (this._jsPdfPromise) return this._jsPdfPromise;
    this._jsPdfPromise = new Promise((resolve) => {
      const s1 = document.createElement('script');
      s1.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js';
      s1.onload = () => resolve(true);
      s1.onerror = () => { this._jsPdfPromise = null; resolve(false); };
      document.head.appendChild(s1);
    });
    return this._jsPdfPromise;
  },

  async generateMonthlyReport() {
    if (!await this._ensureJsPdf()) {
      Components.toast('PDF-Bibliothek konnte nicht geladen werden', 'error');
      return;
    }

    Components.toast('Report wird erstellt…', 'info');

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const now = new Date();
    const monthName = now.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    let y = 20;

    // Load data
    const [usersRes, orgsRes, leadsRes] = await Promise.all([
      clanaDB.getAllProfiles(),
      clanaDB.getOrganizations(),
      clanaDB.getLeads()
    ]);

    const allUsers = usersRes.data || [];
    const allOrgs = orgsRes.data || [];
    const allLeads = leadsRes.data || [];
    const customers = allUsers.filter(u => u.role === 'customer' && u.is_active !== false);

    // Calculate MRR
    let mrr = 0;
    customers.forEach(c => {
      const plan = c.organizations?.plan || 'starter';
      mrr += CONFIG.getPlanPrice(plan);
    });

    // Header
    doc.setFontSize(22);
    doc.setTextColor(124, 58, 237);
    doc.text('Call Lana', 20, y);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Monatsbericht ${monthName}`, 20, y + 8);
    doc.text(`Erstellt am ${now.toLocaleDateString('de-DE')}`, 20, y + 14);

    doc.setDrawColor(124, 58, 237);
    doc.setLineWidth(0.5);
    doc.line(20, y + 18, 190, y + 18);
    y += 28;

    // KPI Overview
    doc.setFontSize(14);
    doc.setTextColor(30);
    doc.text('Kennzahlen', 20, y);
    y += 8;

    const kpis = [
      ['MRR', `${mrr.toLocaleString('de-DE')} €`],
      ['ARR', `${(mrr * 12).toLocaleString('de-DE')} €`],
      ['Aktive Kunden', customers.length.toString()],
      ['ARPU', customers.length ? `${Math.round(mrr / customers.length)} €` : '0 €'],
      ['Leads gesamt', allLeads.length.toString()],
      ['Gewonnen', allLeads.filter(l => l.status === 'won').length.toString()],
      ['Conversion Rate', allLeads.length ? `${Math.round((allLeads.filter(l => l.status === 'won').length / allLeads.length) * 100)}%` : '0%'],
      ['Organisationen', allOrgs.length.toString()],
      ['Benutzer gesamt', allUsers.length.toString()]
    ];

    doc.setFontSize(10);
    kpis.forEach(([label, value], i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 20 + col * 57;
      const ky = y + row * 16;

      doc.setFillColor(248, 249, 252);
      doc.roundedRect(x, ky, 52, 13, 2, 2, 'F');
      doc.setTextColor(100);
      doc.setFontSize(8);
      doc.text(label, x + 4, ky + 5);
      doc.setTextColor(30);
      doc.setFontSize(11);
      doc.text(value, x + 4, ky + 11);
    });

    y += Math.ceil(kpis.length / 3) * 16 + 10;

    // Plan Distribution
    doc.setFontSize(14);
    doc.setTextColor(30);
    doc.text('Plan-Verteilung', 20, y);
    y += 8;

    const planCounts = { starter: 0, professional: 0, business: 0 };
    customers.forEach(c => {
      const p = (c.organizations?.plan || 'starter').toLowerCase();
      if (p === 'starter' || p === 'solo') planCounts.starter++;
      else if (p === 'professional' || p === 'team') planCounts.professional++;
      else if (p === 'business') planCounts.business++;
    });

    doc.setFontSize(10);
    const plans = [
      { name: 'Starter (149 €)', count: planCounts.starter, color: [124, 58, 237] },
      { name: 'Professional (299 €)', count: planCounts.professional, color: [157, 92, 246] },
      { name: 'Business (599 €)', count: planCounts.business, color: [192, 132, 252] }
    ];

    const totalCustomers = Math.max(customers.length, 1);
    plans.forEach((p, i) => {
      const barWidth = (p.count / totalCustomers) * 130;
      doc.setFillColor(...p.color);
      doc.roundedRect(20, y + i * 10, Math.max(barWidth, 2), 7, 1, 1, 'F');
      doc.setTextColor(60);
      doc.text(`${p.name}: ${p.count} (${Math.round((p.count / totalCustomers) * 100)}%)`, 155, y + i * 10 + 5);
    });

    y += 40;

    // Top Sales
    if (y > 240) { doc.addPage(); y = 20; }

    doc.setFontSize(14);
    doc.setTextColor(30);
    doc.text('Top Vertriebler', 20, y);
    y += 8;

    const salesUsers = allUsers.filter(u => u.role === 'sales' || u.role === 'superadmin');
    const rankings = salesUsers.map(u => {
      const assigned = allLeads.filter(l => l.assigned_to === u.id);
      const won = assigned.filter(l => l.status === 'won');
      const revenue = won.reduce((s, l) => s + (Number(l.value) || CONFIG.getPlanPrice('starter')), 0);
      return { name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email, won: won.length, revenue };
    }).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text('Name', 20, y);
    doc.text('Deals', 110, y);
    doc.text('Umsatz', 140, y);
    y += 2;
    doc.setDrawColor(200);
    doc.line(20, y, 190, y);
    y += 5;

    doc.setTextColor(30);
    rankings.forEach(r => {
      doc.text(r.name, 20, y);
      doc.text(r.won.toString(), 110, y);
      doc.text(`${r.revenue.toLocaleString('de-DE')} €`, 140, y);
      y += 6;
    });

    y += 10;

    // Lead Pipeline Summary
    if (y > 240) { doc.addPage(); y = 20; }

    doc.setFontSize(14);
    doc.setTextColor(30);
    doc.text('Lead Pipeline', 20, y);
    y += 8;

    const stages = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'];
    const stageLabels = { new: 'Neu', contacted: 'Kontaktiert', qualified: 'Qualifiziert', proposal: 'Angebot', won: 'Gewonnen', lost: 'Verloren' };

    doc.setFontSize(9);
    stages.forEach((s, i) => {
      const count = allLeads.filter(l => l.status === s).length;
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 20 + col * 57;
      const ky = y + row * 12;

      doc.setTextColor(100);
      doc.text(`${stageLabels[s]}:`, x, ky);
      doc.setTextColor(30);
      doc.text(count.toString(), x + 30, ky);
    });

    y += 30;

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('Generiert von Call Lana CRM', 20, 285);
    doc.text(`Seite 1${doc.getNumberOfPages() > 1 ? ' von ' + doc.getNumberOfPages() : ''}`, 170, 285);

    // Save
    doc.save(`Call_Lana_Monatsbericht_${now.toISOString().slice(0, 7)}.pdf`);
    Components.toast('PDF-Report erstellt!', 'success');
  }
};

window.AdminPdfExport = AdminPdfExport;
