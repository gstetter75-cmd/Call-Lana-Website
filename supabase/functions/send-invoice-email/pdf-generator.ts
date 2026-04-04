// ==========================================
// SERVER-SIDE INVOICE PDF GENERATION (pdf-lib)
// Generates a UStG §14 compliant German invoice PDF.
// Compatible with Deno / Supabase Edge Functions.
// ==========================================

import {
  PDFDocument,
  rgb,
  StandardFonts,
} from "https://esm.sh/pdf-lib@1.17.1";

// ---- Constants ----
const PAGE_WIDTH = 595.28; // A4 in points (210mm)
const PAGE_HEIGHT = 841.89; // A4 in points (297mm)
const MARGIN_LEFT = 56.69; // ~20mm
const MARGIN_RIGHT = 56.69;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

const COLOR_PRIMARY = rgb(0.31, 0.16, 0.78); // #5028c8
const COLOR_TEXT = rgb(0.16, 0.16, 0.16);
const COLOR_GRAY = rgb(0.47, 0.47, 0.47);
const COLOR_LIGHT_GRAY = rgb(0.78, 0.78, 0.78);
const COLOR_TABLE_HEADER_BG = rgb(0.96, 0.95, 1.0);

/**
 * Format cents (integer) to German EUR string.
 */
function fmtCents(cents: number): string {
  return (
    (cents / 100).toLocaleString("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " \u20AC"
  );
}

/**
 * Format ISO date to German DD.MM.YYYY.
 */
function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "\u2013";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "\u2013";
  }
}

/**
 * Draw a horizontal line on the page.
 */
function drawLine(
  page: any,
  x1: number,
  y: number,
  x2: number,
  thickness = 0.5,
  color = COLOR_LIGHT_GRAY
) {
  page.drawLine({
    start: { x: x1, y },
    end: { x: x2, y },
    thickness,
    color,
  });
}

/**
 * Draw right-aligned text and return its width for layout purposes.
 */
function drawTextRight(
  page: any,
  text: string,
  x: number,
  y: number,
  font: any,
  size: number,
  color = COLOR_TEXT
) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: x - width, y, size, font, color });
  return width;
}

/**
 * Generate a professional invoice PDF.
 * Returns the PDF as Uint8Array (bytes).
 */
export async function generateInvoicePdf(
  invoice: any,
  items: any[],
  settings: any
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - 56; // Start from top

  const rightEdge = PAGE_WIDTH - MARGIN_RIGHT;

  // ============================================================
  // HEADER: Company name
  // ============================================================
  page.drawText("Call Lana", {
    x: MARGIN_LEFT,
    y,
    size: 20,
    font: fontBold,
    color: COLOR_PRIMARY,
  });
  y -= 18;

  // ============================================================
  // SENDER LINE (DIN 5008 — small line above recipient)
  // ============================================================
  const senderLine =
    `${settings.company_name || "Call Lana GmbH"} \u00B7 ` +
    `${settings.street || "Grabenstra\u00DFe 19"} \u00B7 ` +
    `${settings.zip || "31020"} ${settings.city || "Salzhemmendorf"}`;

  page.drawText(senderLine, {
    x: MARGIN_LEFT,
    y,
    size: 7,
    font,
    color: COLOR_GRAY,
  });
  y -= 14;

  // ============================================================
  // RECIPIENT ADDRESS BLOCK
  // ============================================================
  const recipientLines = [
    invoice.recipient_name || "",
    invoice.recipient_street || "",
    `${invoice.recipient_zip || ""} ${invoice.recipient_city || ""}`.trim(),
    invoice.recipient_country && invoice.recipient_country !== "Deutschland"
      ? invoice.recipient_country
      : "",
  ].filter(Boolean);

  for (const line of recipientLines) {
    page.drawText(line, {
      x: MARGIN_LEFT,
      y,
      size: 10,
      font,
      color: COLOR_TEXT,
    });
    y -= 14;
  }

  // ============================================================
  // INFO BLOCK (right side)
  // ============================================================
  let infoY = PAGE_HEIGHT - 92;
  const infoLabelX = 370;
  const infoValueX = 440;

  const infoRows: [string, string][] = [
    ["Rechnungsnr.:", invoice.invoice_number || "\u2013"],
    ["Datum:", fmtDate(invoice.invoice_date)],
    ["Zeitraum:", `${fmtDate(invoice.period_start)} \u2013 ${fmtDate(invoice.period_end)}`],
    ["F\u00E4llig bis:", fmtDate(invoice.due_date)],
  ];

  for (const [label, value] of infoRows) {
    page.drawText(label, {
      x: infoLabelX,
      y: infoY,
      size: 8,
      font: fontBold,
      color: COLOR_GRAY,
    });
    page.drawText(value, {
      x: infoValueX,
      y: infoY,
      size: 8,
      font,
      color: COLOR_TEXT,
    });
    infoY -= 14;
  }

  // ============================================================
  // INVOICE TITLE
  // ============================================================
  y = Math.min(y, infoY) - 10;

  page.drawText(`Rechnung ${invoice.invoice_number || ""}`, {
    x: MARGIN_LEFT,
    y,
    size: 14,
    font: fontBold,
    color: COLOR_TEXT,
  });
  y -= 8;

  drawLine(page, MARGIN_LEFT, y, rightEdge);
  y -= 20;

  // ============================================================
  // ITEMS TABLE
  // ============================================================

  // Column positions
  const colPos = MARGIN_LEFT;
  const colDesc = MARGIN_LEFT + 30;
  const colQty = 340;
  const colUnit = 380;
  const colUnitPrice = 440;
  const colTotal = rightEdge;

  // Table header background
  page.drawRectangle({
    x: MARGIN_LEFT - 4,
    y: y - 4,
    width: CONTENT_WIDTH + 8,
    height: 18,
    color: COLOR_TABLE_HEADER_BG,
  });

  const headerY = y;
  const headerSize = 8;

  page.drawText("Pos", { x: colPos, y: headerY, size: headerSize, font: fontBold, color: COLOR_PRIMARY });
  page.drawText("Beschreibung", { x: colDesc, y: headerY, size: headerSize, font: fontBold, color: COLOR_PRIMARY });
  page.drawText("Menge", { x: colQty, y: headerY, size: headerSize, font: fontBold, color: COLOR_PRIMARY });
  page.drawText("Einheit", { x: colUnit, y: headerY, size: headerSize, font: fontBold, color: COLOR_PRIMARY });
  drawTextRight(page, "Einzelpreis", colUnitPrice + 40, headerY, fontBold, headerSize, COLOR_PRIMARY);
  drawTextRight(page, "Gesamt (netto)", colTotal, headerY, fontBold, headerSize, COLOR_PRIMARY);

  y -= 22;

  // Table rows
  for (const item of items) {
    // Check if we need a new page
    if (y < 120) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - 60;
    }

    const rowSize = 9;

    page.drawText(String(item.position || ""), {
      x: colPos + 4,
      y,
      size: rowSize,
      font,
      color: COLOR_TEXT,
    });

    // Truncate long descriptions
    const desc = String(item.description || "");
    const maxDescWidth = colQty - colDesc - 10;
    let displayDesc = desc;
    while (font.widthOfTextAtSize(displayDesc, rowSize) > maxDescWidth && displayDesc.length > 3) {
      displayDesc = displayDesc.slice(0, -4) + "...";
    }

    page.drawText(displayDesc, {
      x: colDesc,
      y,
      size: rowSize,
      font,
      color: COLOR_TEXT,
    });

    page.drawText(String(item.quantity ?? 1), {
      x: colQty + 4,
      y,
      size: rowSize,
      font,
      color: COLOR_TEXT,
    });

    page.drawText(item.unit || "Stk.", {
      x: colUnit,
      y,
      size: rowSize,
      font,
      color: COLOR_TEXT,
    });

    drawTextRight(page, fmtCents(item.unit_price_cents ?? 0), colUnitPrice + 40, y, font, rowSize, COLOR_TEXT);
    drawTextRight(page, fmtCents(item.net_amount_cents ?? 0), colTotal, y, font, rowSize, COLOR_TEXT);

    y -= 6;
    drawLine(page, MARGIN_LEFT, y, rightEdge, 0.3);
    y -= 14;
  }

  y -= 4;

  // ============================================================
  // TOTALS
  // ============================================================
  const netCents = invoice.net_amount_cents ?? 0;
  const taxCents = invoice.tax_amount_cents ?? 0;
  const grossCents = invoice.gross_amount_cents ?? 0;
  const taxRate = invoice.tax_rate ?? 19;

  const totalsLabelX = rightEdge - 140;

  // Netto
  page.drawText("Nettobetrag:", {
    x: totalsLabelX,
    y,
    size: 9,
    font,
    color: COLOR_GRAY,
  });
  drawTextRight(page, fmtCents(netCents), rightEdge, y, font, 9, COLOR_TEXT);
  y -= 14;

  // MwSt
  page.drawText(`zzgl. ${taxRate}% MwSt.:`, {
    x: totalsLabelX,
    y,
    size: 9,
    font,
    color: COLOR_GRAY,
  });
  drawTextRight(page, fmtCents(taxCents), rightEdge, y, font, 9, COLOR_TEXT);
  y -= 8;

  drawLine(page, totalsLabelX, y, rightEdge);
  y -= 14;

  // Brutto
  page.drawText("Gesamtbetrag:", {
    x: totalsLabelX,
    y,
    size: 11,
    font: fontBold,
    color: COLOR_TEXT,
  });
  drawTextRight(page, fmtCents(grossCents), rightEdge, y, fontBold, 11, COLOR_TEXT);
  y -= 24;

  // ============================================================
  // PAYMENT INFO
  // ============================================================
  page.drawText(
    `Bitte \u00FCberweisen Sie den Betrag bis zum ${fmtDate(invoice.due_date)} auf folgendes Konto:`,
    { x: MARGIN_LEFT, y, size: 9, font, color: COLOR_GRAY }
  );
  y -= 18;

  const bankRows: [string, string][] = [
    ["IBAN:", settings.iban || "DE94100110012577455738"],
    ["BIC:", settings.bic || "NTSBDEB1XXX"],
    ["Bank:", settings.bank_name || "N26"],
    ["Verwendungszweck:", invoice.invoice_number || "\u2013"],
  ];

  for (const [label, value] of bankRows) {
    page.drawText(label, {
      x: MARGIN_LEFT,
      y,
      size: 9,
      font: fontBold,
      color: COLOR_TEXT,
    });
    page.drawText(value, {
      x: MARGIN_LEFT + 100,
      y,
      size: 9,
      font,
      color: COLOR_TEXT,
    });
    y -= 14;
  }

  y -= 6;

  // ============================================================
  // NOTES
  // ============================================================
  const note = invoice.notes || settings.default_notes || "";
  if (note) {
    page.drawText(note, {
      x: MARGIN_LEFT,
      y,
      size: 8,
      font,
      color: COLOR_GRAY,
      maxWidth: CONTENT_WIDTH,
    });
    y -= 20;
  }

  // ============================================================
  // FOOTER
  // ============================================================
  const footerY = 42;

  drawLine(page, MARGIN_LEFT, footerY + 12, rightEdge, 0.3);

  const footerLine1 =
    `${settings.company_name || "Call Lana GmbH"}  |  ` +
    `${settings.street || "Grabenstra\u00DFe 19"}, ${settings.zip || "31020"} ${settings.city || "Salzhemmendorf"}  |  ` +
    `GF: ${settings.managing_directors || "Ahmet Asad & Gero Stetter"}`;

  const footerLine2Parts = [
    settings.registry_court && settings.registry_number
      ? `${settings.registry_court} ${settings.registry_number}`
      : null,
    settings.vat_id ? `USt-IdNr: ${settings.vat_id}` : null,
    settings.tax_number ? `Steuernr: ${settings.tax_number}` : null,
    settings.email || "hallo@call-lana.de",
  ].filter(Boolean);

  const footerLine2 = footerLine2Parts.join("  |  ");

  // Center footer text
  const fl1Width = font.widthOfTextAtSize(footerLine1, 7);
  const fl2Width = font.widthOfTextAtSize(footerLine2, 7);

  page.drawText(footerLine1, {
    x: (PAGE_WIDTH - fl1Width) / 2,
    y: footerY,
    size: 7,
    font,
    color: COLOR_GRAY,
  });

  page.drawText(footerLine2, {
    x: (PAGE_WIDTH - fl2Width) / 2,
    y: footerY - 10,
    size: 7,
    font,
    color: COLOR_GRAY,
  });

  // ============================================================
  // SERIALIZE
  // ============================================================
  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}
