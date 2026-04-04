// ==========================================
// HTML EMAIL TEMPLATE FOR INVOICE EMAILS
// Clean, responsive, email-safe (inline styles only)
// ==========================================

/**
 * Escape HTML special characters to prevent XSS.
 */
function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Format cents to German EUR string.
 */
function fmtCents(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " \u20AC";
}

/**
 * Format ISO date string to German DD.MM.YYYY format.
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
 * Generate a clean HTML email body for an invoice.
 * Uses only inline styles for maximum email client compatibility.
 */
interface InvoiceSummary {
  invoice_number: string;
  invoice_date: string;
  gross_amount_cents: number;
  recipient_name: string;
}

/**
 * Generate an HTML email body for multiple invoices sent together.
 * Lists all invoices in a table and notes that PDFs are attached.
 */
export function multiInvoiceEmailHtml(
  recipientName: string,
  invoices: InvoiceSummary[],
  settings?: any
): string {
  const totalCents = invoices.reduce((sum, inv) => sum + (inv.gross_amount_cents || 0), 0);

  const invoiceRows = invoices
    .map(
      (inv) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;color:#333;font-weight:600;">
          ${escapeHtml(inv.invoice_number)}
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;color:#333;text-align:center;">
          ${fmtDate(inv.invoice_date)}
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;color:#333;text-align:right;">
          ${fmtCents(inv.gross_amount_cents)}
        </td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Ihre Rechnungen \u2014 Call Lana</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

          <!-- Header -->
          <tr>
            <td style="background-color:#5028c8;padding:28px 32px;">
              <h1 style="margin:0;font-size:22px;color:#ffffff;font-weight:700;">Call Lana</h1>
              <p style="margin:4px 0 0 0;font-size:13px;color:rgba(255,255,255,0.8);">Ihre Rechnungen</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">

              <!-- Greeting -->
              <p style="font-size:15px;color:#333;line-height:1.6;margin:0 0 20px 0;">
                Guten Tag${recipientName ? " " + escapeHtml(recipientName) : ""},
              </p>
              <p style="font-size:15px;color:#333;line-height:1.6;margin:0 0 24px 0;">
                anbei erhalten Sie <strong>${invoices.length} Rechnungen</strong> von Call Lana.
              </p>

              <!-- Invoices table -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                <tr style="background-color:#f0edf8;">
                  <th style="padding:10px 12px;font-size:12px;color:#5028c8;font-weight:600;text-align:left;text-transform:uppercase;">Rechnungsnr.</th>
                  <th style="padding:10px 12px;font-size:12px;color:#5028c8;font-weight:600;text-align:center;text-transform:uppercase;">Datum</th>
                  <th style="padding:10px 12px;font-size:12px;color:#5028c8;font-weight:600;text-align:right;text-transform:uppercase;">Betrag (brutto)</th>
                </tr>
                ${invoiceRows}
              </table>

              <!-- Total -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="padding:8px 12px;font-size:16px;color:#333;font-weight:700;text-align:right;">Gesamt:</td>
                  <td style="padding:8px 12px;font-size:16px;color:#5028c8;font-weight:700;text-align:right;width:140px;">${fmtCents(totalCents)}</td>
                </tr>
              </table>

              <!-- PDF note -->
              <div style="background-color:#eef7ee;border-left:4px solid #4ade80;border-radius:4px;padding:14px 18px;margin-bottom:24px;">
                <p style="margin:0;font-size:14px;color:#333;line-height:1.5;">
                  Die Rechnungen finden Sie als <strong>PDF-Dateien im Anhang</strong> dieser E-Mail.
                </p>
              </div>

              <p style="font-size:14px;color:#666;line-height:1.6;margin:0 0 12px 0;">
                Bei Fragen zu Ihren Rechnungen erreichen Sie uns unter
                <a href="mailto:hallo@call-lana.de" style="color:#5028c8;text-decoration:none;">hallo@call-lana.de</a>.
              </p>

              <p style="font-size:14px;color:#333;line-height:1.6;margin:20px 0 0 0;">
                Vielen Dank f\u00FCr Ihr Vertrauen!<br>
                <strong>Ihr Call Lana Team</strong>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8f7fc;padding:20px 32px;border-top:1px solid #eee;">
              <p style="margin:0;font-size:11px;color:#999;text-align:center;line-height:1.6;">
                Call Lana GmbH &middot; Grabenstra\u00DFe 19 &middot; 31020 Salzhemmendorf<br>
                GF: Ahmet Asad &amp; Gero Stetter &middot; AG Hildesheim<br>
                <a href="https://call-lana.de" style="color:#5028c8;text-decoration:none;">call-lana.de</a> &middot;
                <a href="mailto:hallo@call-lana.de" style="color:#5028c8;text-decoration:none;">hallo@call-lana.de</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function invoiceEmailHtml(invoice: any, items: any[], settings?: any): string {
  const netCents = invoice.net_amount_cents ?? 0;
  const taxCents = invoice.tax_amount_cents ?? 0;
  const grossCents = invoice.gross_amount_cents ?? 0;
  const taxRate = invoice.tax_rate ?? 19;

  const itemRows = items
    .map(
      (item: any) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;color:#333;">
          ${escapeHtml(item.description) || "\u2013"}
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;color:#333;text-align:center;">
          ${item.quantity ?? 1} ${escapeHtml(item.unit) || "Stk."}
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;color:#333;text-align:right;">
          ${fmtCents(item.net_amount_cents ?? 0)}
        </td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Rechnung ${escapeHtml(invoice.invoice_number)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

          <!-- Header -->
          <tr>
            <td style="background-color:#5028c8;padding:28px 32px;">
              <h1 style="margin:0;font-size:22px;color:#ffffff;font-weight:700;">Call Lana</h1>
              <p style="margin:4px 0 0 0;font-size:13px;color:rgba(255,255,255,0.8);">Ihre Rechnung</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">

              <!-- Greeting -->
              <p style="font-size:15px;color:#333;line-height:1.6;margin:0 0 20px 0;">
                Guten Tag${invoice.recipient_name ? " " + escapeHtml(invoice.recipient_name) : ""},
              </p>
              <p style="font-size:15px;color:#333;line-height:1.6;margin:0 0 24px 0;">
                anbei erhalten Sie Ihre Rechnung <strong>${escapeHtml(invoice.invoice_number)}</strong>
                f\u00FCr den Leistungszeitraum
                <strong>${fmtDate(invoice.period_start)} \u2013 ${fmtDate(invoice.period_end)}</strong>.
              </p>

              <!-- Invoice info box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f7fc;border-radius:6px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:13px;color:#666;padding-bottom:6px;">Rechnungsnr.</td>
                        <td style="font-size:13px;color:#333;font-weight:600;padding-bottom:6px;text-align:right;">${escapeHtml(invoice.invoice_number) || "\u2013"}</td>
                      </tr>
                      <tr>
                        <td style="font-size:13px;color:#666;padding-bottom:6px;">Datum</td>
                        <td style="font-size:13px;color:#333;font-weight:600;padding-bottom:6px;text-align:right;">${fmtDate(invoice.invoice_date)}</td>
                      </tr>
                      <tr>
                        <td style="font-size:13px;color:#666;padding-bottom:6px;">Zeitraum</td>
                        <td style="font-size:13px;color:#333;font-weight:600;padding-bottom:6px;text-align:right;">${fmtDate(invoice.period_start)} \u2013 ${fmtDate(invoice.period_end)}</td>
                      </tr>
                      <tr>
                        <td style="font-size:13px;color:#666;">F\u00E4llig bis</td>
                        <td style="font-size:13px;color:#333;font-weight:600;text-align:right;">${fmtDate(invoice.due_date)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Items table -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                <tr style="background-color:#f0edf8;">
                  <th style="padding:10px 12px;font-size:12px;color:#5028c8;font-weight:600;text-align:left;text-transform:uppercase;">Beschreibung</th>
                  <th style="padding:10px 12px;font-size:12px;color:#5028c8;font-weight:600;text-align:center;text-transform:uppercase;">Menge</th>
                  <th style="padding:10px 12px;font-size:12px;color:#5028c8;font-weight:600;text-align:right;text-transform:uppercase;">Netto</th>
                </tr>
                ${itemRows}
              </table>

              <!-- Totals -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="padding:4px 12px;font-size:14px;color:#666;text-align:right;">Nettobetrag:</td>
                  <td style="padding:4px 12px;font-size:14px;color:#333;text-align:right;width:120px;">${fmtCents(netCents)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 12px;font-size:14px;color:#666;text-align:right;">zzgl. ${taxRate}% MwSt.:</td>
                  <td style="padding:4px 12px;font-size:14px;color:#333;text-align:right;width:120px;">${fmtCents(taxCents)}</td>
                </tr>
                <tr>
                  <td colspan="2" style="padding:4px 12px;"><hr style="border:none;border-top:1px solid #ddd;margin:4px 0;"></td>
                </tr>
                <tr>
                  <td style="padding:4px 12px;font-size:16px;color:#333;font-weight:700;text-align:right;">Gesamtbetrag:</td>
                  <td style="padding:4px 12px;font-size:16px;color:#5028c8;font-weight:700;text-align:right;width:120px;">${fmtCents(grossCents)}</td>
                </tr>
              </table>

              <!-- PDF note -->
              <div style="background-color:#eef7ee;border-left:4px solid #4ade80;border-radius:4px;padding:14px 18px;margin-bottom:24px;">
                <p style="margin:0;font-size:14px;color:#333;line-height:1.5;">
                  Die vollst\u00E4ndige Rechnung finden Sie als <strong>PDF im Anhang</strong> dieser E-Mail.
                </p>
              </div>

              <!-- Payment info -->
              <p style="font-size:14px;color:#333;line-height:1.6;margin:0 0 12px 0;">
                Bitte \u00FCberweisen Sie den Betrag bis zum <strong>${fmtDate(invoice.due_date)}</strong> auf folgendes Konto:
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f7fc;border-radius:6px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 24px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:13px;color:#666;padding-bottom:4px;width:140px;">IBAN:</td>
                        <td style="font-size:13px;color:#333;font-weight:600;padding-bottom:4px;">${escapeHtml(settings?.iban || "")}</td>
                      </tr>
                      <tr>
                        <td style="font-size:13px;color:#666;padding-bottom:4px;">BIC:</td>
                        <td style="font-size:13px;color:#333;font-weight:600;padding-bottom:4px;">${escapeHtml(settings?.bic || "")}</td>
                      </tr>
                      <tr>
                        <td style="font-size:13px;color:#666;padding-bottom:4px;">Bank:</td>
                        <td style="font-size:13px;color:#333;font-weight:600;padding-bottom:4px;">${escapeHtml(settings?.bank_name || "")}</td>
                      </tr>
                      <tr>
                        <td style="font-size:13px;color:#666;">Verwendungszweck:</td>
                        <td style="font-size:13px;color:#333;font-weight:600;">${escapeHtml(invoice.invoice_number) || "\u2013"}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="font-size:14px;color:#666;line-height:1.6;margin:0;">
                Bei Fragen zu Ihrer Rechnung erreichen Sie uns unter
                <a href="mailto:hallo@call-lana.de" style="color:#5028c8;text-decoration:none;">hallo@call-lana.de</a>.
              </p>

              <p style="font-size:14px;color:#333;line-height:1.6;margin:20px 0 0 0;">
                Vielen Dank f\u00FCr Ihr Vertrauen!<br>
                <strong>Ihr Call Lana Team</strong>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8f7fc;padding:20px 32px;border-top:1px solid #eee;">
              <p style="margin:0;font-size:11px;color:#999;text-align:center;line-height:1.6;">
                Call Lana GmbH &middot; Grabenstra\u00DFe 19 &middot; 31020 Salzhemmendorf<br>
                GF: Ahmet Asad &amp; Gero Stetter &middot; AG Hildesheim<br>
                <a href="https://call-lana.de" style="color:#5028c8;text-decoration:none;">call-lana.de</a> &middot;
                <a href="mailto:hallo@call-lana.de" style="color:#5028c8;text-decoration:none;">hallo@call-lana.de</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
