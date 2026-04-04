// ==========================================
// INVOICE MANAGEMENT FOR DASHBOARD
// ==========================================

/**
 * Load invoices from Supabase and render them into the dashboard table.
 */
async function loadInvoices() {
  const tableBody = document.getElementById('invoiceTableBody');
  if (!tableBody) return;

  try {
    const { data, error } = await supabaseClient
      .from('invoices')
      .select('*')
      .order('invoice_date', { ascending: false });

    if (error) throw error;

    renderInvoiceTable(data || []);
  } catch (err) {
    Logger.error('loadInvoices', err);
    renderInvoiceTable([]);
  }
}

/**
 * Render invoice rows into #invoiceTableBody.
 * Columns: Rechnungsnr, Datum, Zeitraum, Betrag (brutto), Status, Aktionen
 */
function renderInvoiceTable(invoices) {
  const tableBody = document.getElementById('invoiceTableBody');
  if (!tableBody) return;

  if (!invoices || invoices.length === 0) {
    tableBody.innerHTML =
      '<tr><td colspan="7" style="text-align:center;color:var(--tx3);padding:30px;">Keine Rechnungen vorhanden</td></tr>';
    updateSelectionBar();
    return;
  }

  tableBody.innerHTML = invoices.map(inv => {
    const invoiceDate = formatDateDE(inv.invoice_date);
    const periodStart = formatDateDE(inv.period_start);
    const periodEnd = formatDateDE(inv.period_end);
    const period = periodStart && periodEnd ? `${periodStart} – ${periodEnd}` : '–';

    return `<tr>
      <td style="text-align:center;"><input type="checkbox" class="invoice-checkbox" data-invoice-id="${inv.id}" onchange="toggleInvoiceSelect(this)" style="cursor:pointer;width:16px;height:16px;accent-color:var(--pu);"></td>
      <td style="font-weight:600;">${escapeHtml(inv.invoice_number || '–')}</td>
      <td>${invoiceDate || '–'}</td>
      <td>${period}</td>
      <td style="font-weight:600;">${formatCents(inv.total_gross_cents || 0)}</td>
      <td>${getStatusBadge(inv.status)}</td>
      <td style="display:flex;gap:6px;align-items:center;">
        <button class="btn-icon" onclick="downloadInvoicePdf('${inv.id}')" title="PDF herunterladen"
          style="background:rgba(124,58,237,.1);border:1px solid rgba(124,58,237,.25);border-radius:8px;padding:6px 12px;cursor:pointer;color:var(--pu3);font-size:12px;font-weight:600;transition:all .2s;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>PDF
        </button>
        <button class="btn-icon" onclick="resendInvoiceEmail('${inv.id}')" title="${inv.email_sent ? 'Erneut senden' : 'Per E-Mail senden'}"
          style="background:${inv.email_sent ? 'rgba(74,222,128,.1)' : 'rgba(96,165,250,.1)'};border:1px solid ${inv.email_sent ? 'rgba(74,222,128,.25)' : 'rgba(96,165,250,.25)'};border-radius:8px;padding:6px 12px;cursor:pointer;color:${inv.email_sent ? 'var(--green)' : '#60a5fa'};font-size:12px;font-weight:600;transition:all .2s;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>${inv.email_sent ? 'Erneut' : 'Senden'}
        </button>
      </td>
    </tr>`;
  }).join('');

  // Reset select-all checkbox and selection bar after re-render
  const selectAllCb = document.getElementById('selectAllInvoices');
  if (selectAllCb) selectAllCb.checked = false;
  updateSelectionBar();
}

/**
 * Format cents (integer) to German EUR currency string.
 * @param {number} cents - Amount in cents
 * @returns {string} Formatted currency string, e.g. "1.234,56 EUR"
 */
function formatCents(cents) {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

/**
 * Format an ISO date string to German DD.MM.YYYY format.
 * @param {string} dateStr - ISO date string
 * @returns {string} Formatted date or empty string
 */
function formatDateDE(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '';
  }
}

/**
 * Return HTML for a colored status badge based on invoice status.
 * @param {string} status - Invoice status key
 * @returns {string} HTML badge markup
 */
function getStatusBadge(status) {
  const statusMap = {
    draft:     { label: 'Entwurf',      bg: 'rgba(107,95,138,.15)',  color: 'var(--tx3)'   },
    issued:    { label: 'Ausgestellt',   bg: 'rgba(96,165,250,.15)',  color: '#60a5fa'      },
    paid:      { label: 'Bezahlt',       bg: 'rgba(74,222,128,.15)',  color: 'var(--green)' },
    cancelled: { label: 'Storniert',     bg: 'rgba(248,113,113,.15)', color: 'var(--red)'   },
    credited:  { label: 'Gutschrift',    bg: 'rgba(251,146,60,.15)',  color: 'var(--orange)' }
  };

  const s = statusMap[status] || statusMap.draft;
  return `<span class="status-badge" style="background:${s.bg};color:${s.color};">${s.label}</span>`;
}

/**
 * Escape HTML special characters for safe rendering.
 * @param {string} str - Raw string
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Download a PDF for a given invoice.
 * Loads invoice, items, and settings from Supabase, then generates the PDF.
 * @param {string} invoiceId - UUID of the invoice
 */
async function downloadInvoicePdf(invoiceId) {
  try {
    // Load invoice
    const { data: invoice, error: invErr } = await supabaseClient
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (invErr) throw invErr;

    // Load invoice items
    const { data: items, error: itemsErr } = await supabaseClient
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('position', { ascending: true });

    if (itemsErr) throw itemsErr;

    // Load invoice settings
    const { data: settingsArr, error: setErr } = await supabaseClient
      .from('invoice_settings')
      .select('*')
      .limit(1);

    if (setErr) throw setErr;

    const settings = settingsArr && settingsArr.length > 0 ? settingsArr[0] : {};

    // Generate PDF
    await generateInvoicePdf(invoice, items || [], settings);
  } catch (err) {
    Logger.error('downloadInvoicePdf', err);
    if (typeof showToast === 'function') {
      showToast('PDF konnte nicht erstellt werden: ' + (err.message || err), true);
    }
  }
}

// ==========================================
// MULTI-SELECT INVOICE FUNCTIONS
// ==========================================

/**
 * Toggle individual invoice checkbox selection.
 * Updates the select-all checkbox state and the selection bar.
 * @param {HTMLInputElement} checkbox - The toggled checkbox
 */
function toggleInvoiceSelect(checkbox) {
  const allCheckboxes = document.querySelectorAll('.invoice-checkbox');
  const selectAllCb = document.getElementById('selectAllInvoices');

  if (selectAllCb) {
    const allChecked = [...allCheckboxes].every(cb => cb.checked);
    const someChecked = [...allCheckboxes].some(cb => cb.checked);
    selectAllCb.checked = allChecked;
    selectAllCb.indeterminate = someChecked && !allChecked;
  }

  updateSelectionBar();
}

/**
 * Select or deselect all invoice checkboxes.
 * @param {HTMLInputElement} checkbox - The select-all checkbox
 */
function toggleAllInvoices(checkbox) {
  const allCheckboxes = document.querySelectorAll('.invoice-checkbox');
  allCheckboxes.forEach(cb => { cb.checked = checkbox.checked; });
  updateSelectionBar();
}

/**
 * Return an array of selected invoice IDs.
 * @returns {string[]} Array of UUID strings
 */
function getSelectedInvoiceIds() {
  const checked = document.querySelectorAll('.invoice-checkbox:checked');
  return [...checked].map(cb => cb.getAttribute('data-invoice-id'));
}

/**
 * Show or hide the floating selection action bar based on how many invoices are selected.
 */
function updateSelectionBar() {
  const bar = document.getElementById('invoiceSelectionBar');
  const countSpan = document.getElementById('invoiceSelectionCount');
  if (!bar) return;

  const ids = getSelectedInvoiceIds();
  const count = ids.length;

  if (count > 0) {
    bar.style.display = 'flex';
    if (countSpan) {
      countSpan.textContent = count === 1
        ? '1 Rechnung ausgewählt'
        : `${count} Rechnungen ausgewählt`;
    }
  } else {
    bar.style.display = 'none';
  }
}

/**
 * Send all selected invoices in a single email with multiple PDF attachments.
 * Calls the Edge Function with { invoice_ids: [...] }.
 */
async function sendSelectedInvoices() {
  const ids = getSelectedInvoiceIds();
  if (ids.length === 0) return;

  const label = ids.length === 1 ? '1 Rechnung' : `${ids.length} Rechnungen`;
  const confirmed = confirm(`${label} per E-Mail senden?`);
  if (!confirmed) return;

  try {
    if (typeof showToast === 'function') {
      showToast(`${label} werden gesendet...`);
    }

    const { data: sessionData } = await supabaseClient.auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    if (!accessToken) {
      throw new Error('Nicht angemeldet. Bitte erneut einloggen.');
    }

    const supabaseUrl = supabaseClient.supabaseUrl || SUPABASE_URL;
    const edgeFunctionUrl = supabaseUrl + '/functions/v1/send-invoice-email';

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + accessToken,
      },
      body: JSON.stringify({ invoice_ids: ids }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Fehler beim Senden der Rechnungen');
    }

    if (typeof showToast === 'function') {
      showToast(`${label} erfolgreich gesendet!`);
    }

    await loadInvoices();
  } catch (err) {
    Logger.error('sendSelectedInvoices', err);
    if (typeof showToast === 'function') {
      showToast('E-Mail konnte nicht gesendet werden: ' + (err.message || err), true);
    }
  }
}

/**
 * Download all selected invoices as individual PDF files.
 */
async function downloadSelectedInvoices() {
  const ids = getSelectedInvoiceIds();
  if (ids.length === 0) return;

  if (typeof showToast === 'function') {
    showToast(`${ids.length} PDF(s) werden erstellt...`);
  }

  let successCount = 0;
  let errorCount = 0;

  for (const id of ids) {
    try {
      await downloadInvoicePdf(id);
      successCount++;
    } catch (err) {
      Logger.error('downloadSelectedInvoices', err);
      errorCount++;
    }
  }

  if (typeof showToast === 'function') {
    if (errorCount === 0) {
      showToast(`${successCount} PDF(s) heruntergeladen.`);
    } else {
      showToast(`${successCount} heruntergeladen, ${errorCount} fehlgeschlagen.`, true);
    }
  }
}

/**
 * Send (or resend) an invoice email by calling the Edge Function.
 * Triggers server-side PDF generation and email delivery via Resend.
 * @param {string} invoiceId - UUID of the invoice
 */
async function resendInvoiceEmail(invoiceId) {
  try {
    // Confirm before sending
    const confirmed = confirm('Rechnung per E-Mail senden?');
    if (!confirmed) return;

    // Show loading state
    if (typeof showToast === 'function') {
      showToast('Rechnung wird gesendet...');
    }

    const { data: sessionData } = await supabaseClient.auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    if (!accessToken) {
      throw new Error('Nicht angemeldet. Bitte erneut einloggen.');
    }

    // Resolve Edge Function URL from Supabase project URL
    const supabaseUrl = supabaseClient.supabaseUrl || SUPABASE_URL;
    const edgeFunctionUrl = supabaseUrl + '/functions/v1/send-invoice-email';

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + accessToken,
      },
      body: JSON.stringify({ invoice_id: invoiceId }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Fehler beim Senden der Rechnung');
    }

    if (typeof showToast === 'function') {
      showToast('Rechnung erfolgreich gesendet!');
    }

    // Reload invoice table to reflect updated status
    await loadInvoices();
  } catch (err) {
    Logger.error('resendInvoiceEmail', err);
    if (typeof showToast === 'function') {
      showToast('E-Mail konnte nicht gesendet werden: ' + (err.message || err), true);
    }
  }
}
