// Admin Bulk Operations — Select-All, Bulk-Delete, Bulk-Status-Change
// Depends on: supabase-init.js, admin.js

const AdminBulk = {
  selectedIds: new Set(),
  tableType: null, // 'users' or 'customers'

  init(tableType, tbodyId) {
    this.tableType = tableType;
    this.selectedIds.clear();
    this._injectToolbar(tableType);
    this._attachCheckboxes(tbodyId);
  },

  _injectToolbar(tableType) {
    const containerId = `bulk-toolbar-${tableType}`;
    if (document.getElementById(containerId)) return;

    const tab = document.getElementById(`tab-${tableType}`);
    if (!tab) return;

    const toolbar = document.createElement('div');
    toolbar.id = containerId;
    toolbar.style.cssText = 'display:none;align-items:center;gap:10px;padding:10px 16px;background:var(--bg3);border-radius:10px;margin-bottom:12px;';
    toolbar.innerHTML = `
      <span id="bulk-count-${tableType}" style="font-size:13px;font-weight:600;">0 ausgewählt</span>
      <div style="flex:1;"></div>
      ${tableType === 'users' ? `
        <button class="btn btn-sm" onclick="AdminBulk.bulkAction('activate')" title="Aktivieren">✅ Aktivieren</button>
        <button class="btn btn-sm" onclick="AdminBulk.bulkAction('deactivate')" style="background:var(--red);color:#fff;" title="Deaktivieren">⛔ Deaktivieren</button>
      ` : `
        <button class="btn btn-sm" onclick="AdminBulk.bulkAction('export')" title="Exportieren">📥 CSV Export</button>
      `}
      <button class="btn btn-sm" onclick="AdminBulk.clearSelection()" style="background:transparent;border:1px solid var(--tx3);">Abbrechen</button>
    `;

    // Insert before the table
    const table = tab.querySelector('table, .data-table');
    if (table) {
      table.parentNode.insertBefore(toolbar, table);
    } else {
      tab.prepend(toolbar);
    }
  },

  _attachCheckboxes(tbodyId) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    // Add select-all checkbox to thead if not exists
    const thead = tbody.closest('table')?.querySelector('thead tr');
    if (thead && !thead.querySelector('.bulk-select-all')) {
      const th = document.createElement('th');
      th.style.width = '40px';
      th.innerHTML = `<input type="checkbox" class="bulk-select-all" onchange="AdminBulk.toggleAll(this.checked, '${tbodyId}')">`;
      thead.prepend(th);
    }

    // Observe tbody for new rows and add checkboxes
    const observer = new MutationObserver(() => this._addRowCheckboxes(tbodyId));
    observer.observe(tbody, { childList: true });
    this._addRowCheckboxes(tbodyId);
  },

  _addRowCheckboxes(tbodyId) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    tbody.querySelectorAll('tr').forEach(row => {
      if (row.querySelector('.bulk-cb')) return;
      const id = row.dataset.id || row.querySelector('[data-id]')?.dataset.id;
      if (!id) return;

      const td = document.createElement('td');
      td.innerHTML = `<input type="checkbox" class="bulk-cb" data-id="${id}" onchange="AdminBulk.toggleOne('${id}', this.checked)">`;
      row.prepend(td);
    });
  },

  toggleAll(checked, tbodyId) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    tbody.querySelectorAll('.bulk-cb').forEach(cb => {
      cb.checked = checked;
      const id = cb.dataset.id;
      if (checked) this.selectedIds.add(id);
      else this.selectedIds.delete(id);
    });
    this._updateToolbar();
  },

  toggleOne(id, checked) {
    if (checked) this.selectedIds.add(id);
    else this.selectedIds.delete(id);
    this._updateToolbar();
  },

  clearSelection() {
    this.selectedIds.clear();
    document.querySelectorAll('.bulk-cb, .bulk-select-all').forEach(cb => { cb.checked = false; });
    this._updateToolbar();
  },

  _updateToolbar() {
    const count = this.selectedIds.size;
    const toolbar = document.getElementById(`bulk-toolbar-${this.tableType}`);
    const countEl = document.getElementById(`bulk-count-${this.tableType}`);
    if (toolbar) toolbar.style.display = count > 0 ? 'flex' : 'none';
    if (countEl) countEl.textContent = `${count} ausgewählt`;
  },

  async bulkAction(action) {
    const ids = [...this.selectedIds];
    if (ids.length === 0) return;

    const table = this.tableType === 'users' ? 'profiles' : 'customers';

    try {
      if (action === 'activate' || action === 'deactivate') {
        const isActive = action === 'activate';
        const { error } = await supabaseClient
          .from(table)
          .update({ is_active: isActive })
          .in('id', ids);
        if (error) throw error;
        if (typeof showToast !== 'undefined') {
          showToast(`${ids.length} Benutzer ${isActive ? 'aktiviert' : 'deaktiviert'}`);
        }
      } else if (action === 'export') {
        this._exportCsv(ids);
        return;
      }

      this.clearSelection();
      // Trigger table refresh
      if (typeof AdminExtra !== 'undefined' && typeof AdminExtra.loadCustomers === 'function') {
        AdminExtra.loadCustomers();
      }
    } catch (err) {
      if (typeof showToast !== 'undefined') showToast('Fehler: ' + (err.message || 'Unbekannter Fehler'));
    }
  },

  _exportCsv(ids) {
    const rows = [];
    const tbody = document.getElementById(`${this.tableType}-tbody`);
    if (!tbody) return;

    // Get headers
    const thead = tbody.closest('table')?.querySelector('thead tr');
    if (thead) {
      const headers = [...thead.querySelectorAll('th')].slice(1).map(th => th.textContent.trim());
      rows.push(headers.join(';'));
    }

    // Get selected rows
    tbody.querySelectorAll('tr').forEach(row => {
      const id = row.dataset.id || row.querySelector('[data-id]')?.dataset.id;
      if (!ids.includes(id)) return;
      const cells = [...row.querySelectorAll('td')].slice(1).map(td => td.textContent.trim().replace(/;/g, ','));
      rows.push(cells.join(';'));
    });

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${this.tableType}_export_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

    if (typeof showToast !== 'undefined') showToast(`${ids.length} Einträge exportiert`);
  }
};

window.AdminBulk = AdminBulk;
