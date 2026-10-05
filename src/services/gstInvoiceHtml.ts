import { BRAND } from '../config/brand';

export interface GstInvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  customerState: string | null;   // customer's state — used to decide IGST vs CGST+SGST
  planLabel: string;
  serviceDescription?: string;   // overrides the default "Personalised Diet Plan – <planLabel>" line
  amountPaid: number;   // GST-inclusive total the customer paid
  razorpayPaymentId: string | null;
}

const GST_RATE = 0.18;

// Returns true when the customer is in the same state as the company (Uttar Pradesh).
// Intra-state → CGST 9% + SGST 9%.  Inter-state → IGST 18%.
const isIntraState = (customerState: string | null): boolean => {
  if (!customerState) return false;
  const s = customerState.trim().toLowerCase();
  return s === 'uttar pradesh' || s === 'up';
};

const COMPANY = {
  name:      'MERIDIET TECHNOLOGIES PRIVATE LIMITED',
  cin:       'U62090UW2026PTC254182',
  address:   'Shop No-UGF-17, Ansal Plaza Mall Alpha, Greater Noida, Gautam Buddha Nagar, Uttar Pradesh – 201310',
  email:     'support@meridiet.com',
  phone:     '+91 960 960 6009',
  website:   'www.meridiet.com',
  gstin:     process.env.COMPANY_GSTIN ?? '09AAVCM0510H1ZE',
  state:     'Uttar Pradesh',
  stateCode: '09',
};

const esc = (s: unknown): string =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const inr = (n: number): string =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n);

export const buildGstInvoiceHtml = (data: GstInvoiceData): string => {
  const total        = data.amountPaid;
  const taxableValue = parseFloat((total / (1 + GST_RATE)).toFixed(2));
  const gstTotal     = parseFloat((total - taxableValue).toFixed(2));
  const intraState   = isIntraState(data.customerState);

  // Intra-state (UP customer): CGST 9% + SGST 9%
  // Inter-state (all other states): IGST 18%
  const cgst = intraState ? parseFloat((taxableValue * 0.09).toFixed(2)) : 0;
  const sgst = intraState ? parseFloat((taxableValue * 0.09).toFixed(2)) : 0;
  const igst = intraState ? 0 : gstTotal;

  const GREEN      = '#1E8E3E';
  const GREEN_DARK = '#14532d';
  const GREEN_BG   = '#EEF4E8';
  const INK        = '#1f2937';
  const SUB        = '#6b7280';
  const BORDER     = '#d1fae5';
  const WHITE      = '#ffffff';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>GST Invoice – ${esc(data.invoiceNumber)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 13px;
    color: ${INK};
    background: #f4f4f4;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    width: 794px;
    min-height: 1123px;
    background: ${WHITE};
    margin: 0 auto;
    display: flex;
    flex-direction: column;
  }

  /* ── Header ── */
  .header {
    background: ${WHITE};
    color: ${INK};
    padding: 24px 36px 18px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 3px solid ${GREEN};
  }
  .header-left {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 14px;
  }
  .header-left img {
    display: block;
    height: 48px;
    width: auto;
    flex-shrink: 0;
  }
  .header-left .company-info {
    display: flex;
    flex-direction: column;
  }
  .header-left .company-name {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.3px;
    color: ${INK};
    margin: 0;
  }
  .header-left .company-sub {
    font-size: 10px;
    color: ${SUB};
    margin-top: 3px;
  }
  .header-left .company-meta {
    font-size: 10px;
    color: ${SUB};
    margin-top: 4px;
    line-height: 1.7;
  }
  .header-right {
    text-align: right;
  }
  .header-right .tax-invoice-label {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: 1px;
    color: ${INK};
  }
  .header-right .invoice-meta {
    font-size: 11px;
    color: ${SUB};
    margin-top: 6px;
    line-height: 1.7;
  }
  .header-right .invoice-meta span {
    color: ${INK};
    font-weight: 600;
  }

  /* ── Body ── */
  .body { padding: 28px 36px; flex: 1; }

  /* ── Bill to ── */
  .bill-row {
    display: flex;
    gap: 0;
    margin-bottom: 22px;
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 18px;
  }
  .bill-col {
    flex: 1;
    padding-right: 24px;
  }
  .bill-col + .bill-col {
    padding-right: 0;
    padding-left: 24px;
    border-left: 1px solid #e5e7eb;
  }
  .bill-col .col-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: ${GREEN};
    margin-bottom: 8px;
  }
  .bill-col .col-name {
    font-size: 14px;
    font-weight: 700;
    color: ${INK};
    margin-bottom: 3px;
  }
  .bill-col .col-line {
    font-size: 12px;
    color: ${SUB};
    line-height: 1.8;
  }
  .bill-col .col-kv {
    font-size: 12px;
    color: ${INK};
    line-height: 1.9;
  }
  .bill-col .col-kv span {
    color: ${INK};
    font-weight: 700;
    margin-right: 6px;
  }

  /* ── Items table ── */
  .items-section { margin-bottom: 20px; }
  .items-section h4 {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: ${GREEN};
    margin-bottom: 10px;
  }
  table.items {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  table.items thead tr {
    background: #f3f4f6;
    color: ${INK};
    border-bottom: 2px solid ${GREEN};
  }
  table.items thead th {
    padding: 9px 12px;
    text-align: left;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.4px;
    color: ${INK};
  }
  table.items thead th.right { text-align: right; }
  table.items tbody tr {
    border-bottom: 1px solid #e5e7eb;
  }
  table.items tbody tr:last-child { border-bottom: none; }
  table.items tbody td {
    padding: 11px 12px;
    vertical-align: top;
  }
  table.items tbody td.right { text-align: right; }
  table.items tbody td.muted { color: ${SUB}; font-size: 11px; }
  table.items tfoot tr {
    background: ${GREEN_BG};
    border-top: 2px solid ${GREEN};
  }
  table.items tfoot td {
    padding: 10px 12px;
    font-size: 13px;
    font-weight: 700;
    color: ${INK};
  }
  table.items tfoot td.right { text-align: right; }

  /* ── Divider ── */
  .divider {
    height: 1px;
    background: ${BORDER};
    margin: 20px 0;
  }

  /* ── Notes ── */
  .notes {
    background: ${GREEN_BG};
    border-left: 3px solid ${GREEN};
    border-radius: 0 6px 6px 0;
    padding: 12px 16px;
    font-size: 11px;
    color: ${SUB};
    line-height: 1.7;
    margin-bottom: 20px;
  }
  .notes strong { color: ${GREEN_DARK}; }

  /* ── Footer ── */
  .footer {
    border-top: 2px solid ${GREEN};
    padding: 16px 36px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: ${GREEN_BG};
  }
  .footer .footer-brand {
    font-size: 13px;
    font-weight: 700;
    color: ${GREEN_DARK};
  }
  .footer .footer-sub {
    font-size: 10px;
    color: ${SUB};
    margin-top: 2px;
  }
  .footer .footer-right {
    text-align: right;
    font-size: 10px;
    color: ${SUB};
  }

  @media print {
    body { background: ${WHITE}; }
    .page { margin: 0; box-shadow: none; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="header-left">
      <img src="${BRAND.logoUrl}" alt="${esc(BRAND.name)}" />
      <div class="company-info">
        <div class="company-name">${esc(COMPANY.name)}</div>
        <div class="company-sub">GSTIN: ${esc(COMPANY.gstin)} &nbsp;|&nbsp; CIN: ${esc(COMPANY.cin)}</div>
        <div class="company-meta">
          ${esc(COMPANY.email)} &nbsp;|&nbsp; ${esc(COMPANY.phone)}<br/>
          ${esc(COMPANY.website)}
        </div>
      </div>
    </div>
    <div class="header-right">
      <div class="tax-invoice-label">TAX INVOICE</div>
      <div class="invoice-meta">
        Invoice No: <span>${esc(data.invoiceNumber)}</span><br/>
        Invoice Date: <span>${esc(data.invoiceDate)}</span>
      </div>
    </div>
  </div>

  <!-- Body -->
  <div class="body">

    <!-- Bill To / Payment Info -->
    <div class="bill-row">
      <div class="bill-col">
        <div class="col-label">Bill To</div>
        <div class="col-name">${esc(data.customerName)}</div>
        <div class="col-line">${esc(data.customerEmail)}</div>
        ${data.customerPhone ? `<div class="col-line">${esc(data.customerPhone)}</div>` : ''}
      </div>
      <div class="bill-col">
        <div class="col-label">Payment Details</div>
        ${data.razorpayPaymentId ? `<div class="col-kv"><span>Payment ID</span>${esc(data.razorpayPaymentId)}</div>` : ''}
        <div class="col-kv"><span>Mode</span>Online (Razorpay)</div>
        <div class="col-kv"><span>Status</span>Paid</div>
      </div>
    </div>

    <!-- Items -->
    <div class="items-section">
      <h4>Item Details</h4>
      <table class="items">
        <thead>
          <tr>
            <th>#</th>
            <th>Description of Service</th>
            <th class="right">Taxable Value</th>
            ${intraState
              ? `<th class="right">CGST (9%)</th><th class="right">SGST (9%)</th>`
              : `<th class="right">IGST (18%)</th>`}
            <th class="right">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td>
              <strong>${esc(data.serviceDescription ?? `Personalised Diet Plan – ${data.planLabel}`)}</strong>
            </td>
            <td class="right">${inr(taxableValue)}</td>
            ${intraState
              ? `<td class="right">${inr(cgst)}</td><td class="right">${inr(sgst)}</td>`
              : `<td class="right">${inr(igst)}</td>`}
            <td class="right">${inr(total)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colspan="${intraState ? 4 : 3}"></td>
            <td class="right">Grand Total</td>
            <td class="right">${inr(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <div class="divider"></div>

    <!-- Notes -->
    <div class="notes">
      <strong>Notes &amp; Declaration:</strong><br/>
      1. This is a computer-generated invoice and does not require a physical signature.<br/>
      2. ${intraState
        ? 'CGST + SGST applicable — intra-state supply (Uttar Pradesh). CGST 9% + SGST 9% = 18%.'
        : 'IGST applicable — inter-state supply. IGST 18% charged as per GST Act, 2017.'}<br/>
      3. Amount shown is inclusive of GST. Taxable value is computed as: Total ÷ 1.18.
    </div>

  </div><!-- /body -->

  <!-- Footer -->
  <div class="footer">
    <div>
      <div class="footer-brand">${esc(BRAND.name)}</div>
      <div class="footer-sub">${esc(BRAND.tagline)} &nbsp;|&nbsp; ${esc(BRAND.website)}</div>
    </div>
    <div class="footer-right">
      GSTIN: ${esc(COMPANY.gstin)}<br/>
      This invoice is system-generated.
    </div>
  </div>

</div><!-- /page -->
</body>
</html>`;
};
