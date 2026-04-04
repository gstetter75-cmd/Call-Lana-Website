// ==========================================
// Global Search across Leads, Customers, Tasks
// Depends on: db.js (supabaseClient), auth.js, dashboard-components.js
// ==========================================

const GlobalSearch = {
  isOpen: false,
  searchTimeout: null,

  init() {
    // Create search overlay if not exists
    if (document.getElementById('global-search-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'global-search-overlay';
    overlay.style.cssText = 'display:none;position:fixed;inset:0;z-index:250;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);';
    overlay.innerHTML = `
      <div style="max-width:560px;margin:80px auto;background:var(--bg2);border-radius:16px;border:1px solid var(--border);box-shadow:0 20px 60px rgba(0,0,0,.4);overflow:hidden;">
        <div style="display:flex;align-items:center;padding:12px 16px;border-bottom:1px solid var(--border);gap:10px;">
          <svg width="18" height="18" fill="none" stroke="var(--tx3)" stroke-width="2"><circle cx="8" cy="8" r="6"/><path d="M13 13l4 4"/></svg>
          <input id="global-search-input" type="text" placeholder="Leads, Kunden, Aufgaben suchen…" style="flex:1;background:none;border:none;color:var(--tx);font-size:15px;font-family:inherit;outline:none;" autocomplete="off">
          <kbd style="background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:2px 6px;font-size:11px;color:var(--tx3);">ESC</kbd>
        </div>
        <div id="global-search-results" style="max-height:400px;overflow-y:auto;padding:8px;"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });

    const input = document.getElementById('global-search-input');
    input.addEventListener('input', () => {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(() => this.search(input.value.trim()), 300);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });
  },

  open() {
    this.init();
    const overlay = document.getElementById('global-search-overlay');
    overlay.style.display = 'block';
    this.isOpen = true;
    const input = document.getElementById('global-search-input');
    input.value = '';
    document.getElementById('global-search-results').innerHTML = '<div style="padding:20px;text-align:center;color:var(--tx3);font-size:13px;">Tippe um zu suchen…</div>';
    setTimeout(() => input.focus(), 50);
  },

  close() {
    const overlay = document.getElementById('global-search-overlay');
    if (overlay) overlay.style.display = 'none';
    this.isOpen = false;
  },

  async search(query) {
    if (!query || query.length < 2) {
      document.getElementById('global-search-results').innerHTML = '<div style="padding:20px;text-align:center;color:var(--tx3);font-size:13px;">Mindestens 2 Zeichen eingeben…</div>';
      return;
    }

    const container = document.getElementById('global-search-results');
    container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--tx3);font-size:13px;">Suche…</div>';

    try {
      const user = await clanaAuth.getUser();
      if (!user) return;

      const pattern = `%${query}%`;

      const [leads, customers, tasks] = await Promise.all([
        supabaseClient.from('leads').select('id, company_name, contact_name, email, status').or(`company_name.ilike.${pattern},contact_name.ilike.${pattern},email.ilike.${pattern}`).limit(5),
        supabaseClient.from('customers').select('id, company_name, contact_name, email, status, plan').or(`company_name.ilike.${pattern},contact_name.ilike.${pattern},email.ilike.${pattern}`).limit(5),
        supabaseClient.from('tasks').select('id, title, status, due_date').ilike('title', pattern).limit(5)
      ]);

      let html = '';

      if (leads.data?.length) {
        html += this.renderSection('Leads', leads.data.map(l => ({
          title: l.company_name || l.contact_name || l.email,
          subtitle: l.contact_name || l.email || '',
          badge: l.status,
          action: `switchTab('leads')`,
          icon: '🎯'
        })));
      }

      if (customers.data?.length) {
        html += this.renderSection('Kunden', customers.data.map(c => ({
          title: c.company_name,
          subtitle: c.contact_name || c.email || '',
          badge: c.plan || c.status,
          action: `switchTab('customers');setTimeout(()=>viewCustomer('${c.id}'),300)`,
          icon: '👤'
        })));
      }

      if (tasks.data?.length) {
        html += this.renderSection('Aufgaben', tasks.data.map(t => ({
          title: t.title,
          subtitle: t.due_date ? 'Fällig: ' + new Date(t.due_date).toLocaleDateString('de-DE') : '',
          badge: t.status,
          action: `switchTab('tasks')`,
          icon: '✅'
        })));
      }

      if (!html) {
        html = '<div style="padding:20px;text-align:center;color:var(--tx3);font-size:13px;">Keine Ergebnisse für "' + query + '"</div>';
      }

      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--red);font-size:13px;">Suchfehler</div>';
    }
  },

  renderSection(title, items) {
    return `
      <div style="margin-bottom:8px;">
        <div style="padding:6px 8px;font-size:11px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px;">${title}</div>
        ${items.map(i => `
          <div onclick="${i.action};GlobalSearch.close();" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;transition:background .15s;" onmouseenter="this.style.background='var(--bg3)'" onmouseleave="this.style.background=''">
            <span style="font-size:16px;">${i.icon}</span>
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${i.title}</div>
              ${i.subtitle ? `<div style="font-size:11px;color:var(--tx3);">${i.subtitle}</div>` : ''}
            </div>
            ${i.badge ? `<span class="badge badge-purple" style="font-size:10px;">${i.badge}</span>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }
};

window.GlobalSearch = GlobalSearch;
