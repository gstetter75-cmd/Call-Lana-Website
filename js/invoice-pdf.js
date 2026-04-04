// ==========================================
// INVOICE PDF GENERATION (jsPDF)
// Compliant with German §14 UStG requirements
// ==========================================

/**
 * Generate a professional invoice PDF and trigger download.
 * @param {Object} invoice - Invoice record from Supabase
 * @param {Array} items - Array of invoice_items
 * @param {Object} settings - invoice_settings record
 */
async function generateInvoicePdf(invoice, items, settings) {
  /* global jspdf */
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  // ---- Constants ----
  const pageWidth = 210;
  const marginLeft = 20;
  const marginRight = 20;
  const contentWidth = pageWidth - marginLeft - marginRight;
  const lineColor = [200, 200, 200];

  // ---- Helper functions ----
  function fmtCents(cents) {
    return (cents / 100).toLocaleString('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' \u20AC';
  }

  function fmtDate(dateStr) {
    if (!dateStr) return '–';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return '–';
    }
  }

  // jsPDF standard fonts support basic Latin; German umlauts work with
  // the Windows-1252 encoding that Helvetica supports in jsPDF.

  // ============================================================
  // HEADER: Sender info (left) + Recipient address (right area)
  // ============================================================
  let y = 20;

  // Company name top-left
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80, 40, 180);
  doc.text('Call Lana', marginLeft, y);

  // Small sender line above recipient address (DIN 5008)
  y = 32;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  const senderLine = settings.sender_line || 'Call Lana GmbH \u00B7 Grabenstra\u00DFe 19 \u00B7 31020 Salzhemmendorf';
  doc.text(senderLine, marginLeft, y);

  // Recipient address block
  y = 37;
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  doc.setFont('helvetica', 'normal');

  const recipientLines = [
    invoice.recipient_company || '',
    invoice.recipient_name || '',
    invoice.recipient_street || '',
    ((invoice.recipient_zip || '') + ' ' + (invoice.recipient_city || '')).trim(),
    invoice.recipient_country && invoice.recipient_country !== 'Deutschland'
      ? invoice.recipient_country : ''
  ].filter(Boolean);

  recipientLines.forEach(line => {
    doc.text(line, marginLeft, y);
    y += 5;
  });

  // ============================================================
  // INFO BLOCK (right side)
  // ============================================================
  const infoX = 130;
  let infoY = 37;
  doc.setFontSize(9);

  const infoRows = [
    ['Rechnungsnummer:', invoice.invoice_number || '–'],
    ['Rechnungsdatum:', fmtDate(invoice.invoice_date)],
    ['Leistungszeitraum:', fmtDate(invoice.period_start) + ' \u2013 ' + fmtDate(invoice.period_end)],
    ['Kundennummer:', invoice.customer_number || '–'],
    ['F\u00E4lligkeitsdatum:', fmtDate(invoice.due_date)]
  ];

  infoRows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80, 80, 80);
    doc.text(label, infoX, infoY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 40);
    doc.text(value, infoX + 35, infoY);
    infoY += 5;
  });

  // ============================================================
  // INVOICE TITLE
  // ============================================================
  y = Math.max(y, infoY) + 10;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text('Rechnung ' + (invoice.invoice_number || ''), marginLeft, y);
  y += 4;

  // Divider
  doc.setDrawColor(...lineColor);
  doc.setLineWidth(0.3);
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  y += 8;

  // ============================================================
  // POSITIONS TABLE (using jspdf-autotable)
  // ============================================================
  const tableBody = items.map((item, idx) => [
    String(item.position || idx + 1),
    item.description || '',
    String(item.quantity != null ? item.quantity : 1),
    item.unit || 'Stk',
    fmtCents(item.unit_price_net_cents || 0),
    fmtCents(item.total_net_cents || (item.unit_price_net_cents || 0) * (item.quantity || 1))
  ]);

  if (typeof doc.autoTable === 'function') {
    doc.autoTable({
      startY: y,
      margin: { left: marginLeft, right: marginRight },
      head: [['Pos', 'Beschreibung', 'Menge', 'Einheit', 'Einzelpreis (netto)', 'Gesamtpreis (netto)']],
      body: tableBody,
      styles: {
        fontSize: 9,
        cellPadding: 3,
        textColor: [40, 40, 40],
        lineColor: lineColor,
        lineWidth: 0.2
      },
      headStyles: {
        fillColor: [245, 243, 255],
        textColor: [80, 40, 180],
        fontStyle: 'bold',
        fontSize: 8
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 12 },
        1: { cellWidth: 'auto' },
        2: { halign: 'center', cellWidth: 16 },
        3: { halign: 'center', cellWidth: 18 },
        4: { halign: 'right', cellWidth: 32 },
        5: { halign: 'right', cellWidth: 34 }
      },
      didDrawPage: () => {}
    });
    y = doc.lastAutoTable.finalY + 8;
  } else {
    // Fallback: simple text rendering if autoTable is not available
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Pos', marginLeft, y);
    doc.text('Beschreibung', marginLeft + 12, y);
    doc.text('Menge', marginLeft + 90, y);
    doc.text('Einheit', marginLeft + 106, y);
    doc.text('Einzelpreis', marginLeft + 126, y);
    doc.text('Gesamt', marginLeft + 154, y);
    y += 4;
    doc.line(marginLeft, y, pageWidth - marginRight, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    tableBody.forEach(row => {
      doc.text(row[0], marginLeft + 4, y);
      doc.text(row[1], marginLeft + 12, y);
      doc.text(row[2], marginLeft + 94, y);
      doc.text(row[3], marginLeft + 108, y);
      doc.text(row[4], marginLeft + 140, y, { align: 'right' });
      doc.text(row[5], marginLeft + 170, y, { align: 'right' });
      y += 6;
    });
    y += 4;
  }

  // ============================================================
  // TOTALS
  // ============================================================
  const totalNetCents = invoice.total_net_cents || 0;
  const vatCents = invoice.vat_cents || 0;
  const totalGrossCents = invoice.total_gross_cents || 0;
  const vatRate = invoice.vat_rate != null ? invoice.vat_rate : 19;

  const totalsX = pageWidth - marginRight;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text('Nettobetrag:', totalsX - 50, y);
  doc.text(fmtCents(totalNetCents), totalsX, y, { align: 'right' });
  y += 5;

  doc.text('zzgl. ' + vatRate + '% MwSt.:', totalsX - 50, y);
  doc.text(fmtCents(vatCents), totalsX, y, { align: 'right' });
  y += 5;

  doc.line(totalsX - 55, y, totalsX, y);
  y += 5;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text('Gesamtbetrag:', totalsX - 50, y);
  doc.text(fmtCents(totalGrossCents), totalsX, y, { align: 'right' });
  y += 12;

  // ============================================================
  // PAYMENT INFO
  // ============================================================
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);

  const dueDate = fmtDate(invoice.due_date);
  doc.text(
    'Bitte \u00FCberweisen Sie den Betrag bis zum ' + dueDate + ' auf folgendes Konto:',
    marginLeft, y
  );
  y += 7;

  const bankInfo = [
    ['IBAN:', settings.iban || '–'],
    ['BIC:', settings.bic || '–'],
    ['Bank:', settings.bank_name || '–'],
    ['Verwendungszweck:', invoice.invoice_number || '–']
  ];

  bankInfo.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, marginLeft, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value, marginLeft + 35, y);
    y += 5;
  });

  y += 5;

  // ============================================================
  // NOTES
  // ============================================================
  const note = invoice.notes || settings.default_note || '';
  if (note) {
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    const noteLines = doc.splitTextToSize(note, contentWidth);
    doc.text(noteLines, marginLeft, y);
    y += noteLines.length * 4 + 5;
  }

  // ============================================================
  // FOOTER (on every page)
  // ============================================================
  const footerY = 282;
  doc.setDrawColor(...lineColor);
  doc.setLineWidth(0.3);
  doc.line(marginLeft, footerY - 3, pageWidth - marginRight, footerY - 3);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(130, 130, 130);

  const footerCol1 = settings.footer_company || 'Call Lana GmbH';
  const footerCol2 = settings.footer_address || 'Grabenstra\u00DFe 19, 31020 Salzhemmendorf';
  const footerCol3 = settings.footer_management || 'GF: Ahmet Asad & Gero Stetter';

  const footerLine1 = [footerCol1, footerCol2, footerCol3].join('  |  ');

  const footerRegistration = settings.footer_registration || 'AG Hildesheim HRB [xxx]';
  const footerVatId = settings.footer_vat_id || 'USt-IdNr: [xxx]';
  const footerTaxNumber = settings.footer_tax_number || 'Steuernr: [xxx]';

  const footerLine2 = [footerRegistration, footerVatId, footerTaxNumber].join('  |  ');

  doc.text(footerLine1, pageWidth / 2, footerY, { align: 'center' });
  doc.text(footerLine2, pageWidth / 2, footerY + 4, { align: 'center' });

  // ============================================================
  // TRIGGER DOWNLOAD
  // ============================================================
  const fileName = 'Rechnung_' + (invoice.invoice_number || 'Entwurf').replace(/[^a-zA-Z0-9_-]/g, '_') + '.pdf';
  doc.save(fileName);
}
