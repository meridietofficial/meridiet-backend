import { BRAND } from '../config/brand';

export interface GstInvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  planLabel: string;
  amountPaid: number;   // GST-inclusive total the customer paid
  razorpayPaymentId: string | null;
}

const GST_RATE   = 0.18;
const CGST_RATE  = 0.09;
const SGST_RATE  = 0.09;

// Company details — override via env if needed
const COMPANY = {
  name:    'Meridiet Technology Pvt Ltd',
  address: '123, Health Street, Mumbai, Maharashtra – 400001',
  email:   'support@meridiet.com',
  phone:   '+91 960 960 6009',
  website: 'www.meridiet.com',
  gstin:   process.env.COMPANY_GSTIN ?? 'GSTIN: To be updated',
  pan:     process.env.COMPANY_PAN   ?? 'PAN: To be updated',
  state:   'Maharashtra',
  stateCode: '27',
};

const esc = (s: unknown): string =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const inr = (n: number): string =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n);

export const buildGstInvoiceHtml = (data: GstInvoiceData): string => {
  const total        = data.amountPaid;
  const taxableValue = parseFloat((total / (1 + GST_RATE)).toFixed(2));
  const cgst         = parseFloat((taxableValue * CGST_RATE).toFixed(2));
  const sgst         = parseFloat((taxableValue * SGST_RATE).toFixed(2));
  const gstTotal     = parseFloat((cgst + sgst).toFixed(2));

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
    background: ${GREEN_DARK};
    color: ${WHITE};
    padding: 28px 36px 22px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .header-left .company-name {
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 0.5px;
  }
  .header-left .company-sub {
    font-size: 11px;
    color: #a7f3d0;
    margin-top: 3px;
  }
  .header-left .company-meta {
    font-size: 11px;
    color: #d1fae5;
    margin-top: 10px;
    line-height: 1.7;
  }
  .header-right {
    text-align: right;
  }
  .header-right .tax-invoice-label {
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 1px;
    color: ${WHITE};
  }
  .header-right .invoice-meta {
    font-size: 11px;
    color: #d1fae5;
    margin-top: 6px;
    line-height: 1.7;
  }
  .header-right .invoice-meta span {
    color: ${WHITE};
    font-weight: 600;
  }

  /* ── GST badge ── */
  .gst-badge {
    background: ${GREEN};
    color: ${WHITE};
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1px;
    padding: 2px 8px;
    border-radius: 3px;
    display: inline-block;
    margin-top: 6px;
  }

  /* ── Body ── */
  .body { padding: 28px 36px; flex: 1; }

  /* ── Bill to ── */
  .bill-row {
    display: flex;
    gap: 24px;
    margin-bottom: 24px;
  }
  .bill-box {
    flex: 1;
    border: 1px solid ${BORDER};
    border-radius: 6px;
    padding: 14px 16px;
    background: ${GREEN_BG};
  }
  .bill-box h4 {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: ${GREEN_DARK};
    margin-bottom: 8px;
    border-bottom: 1px solid ${BORDER};
    padding-bottom: 5px;
  }
  .bill-box p {
    font-size: 12px;
    color: ${INK};
    line-height: 1.7;
  }
  .bill-box p strong { font-weight: 600; }
  .bill-box p.muted { color: ${SUB}; font-size: 11px; }

  /* ── Items table ── */
  .items-section { margin-bottom: 20px; }
  .items-section h4 {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: ${GREEN_DARK};
    margin-bottom: 10px;
  }
  table.items {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  table.items thead tr {
    background: ${GREEN_DARK};
    color: ${WHITE};
  }
  table.items thead th {
    padding: 9px 12px;
    text-align: left;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.4px;
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

  /* ── Tax summary ── */
  .summary-row {
    display: flex;
    justify-content: flex-end;
    margin-top: 8px;
  }
  .summary-box {
    width: 300px;
    border: 1px solid ${BORDER};
    border-radius: 6px;
    overflow: hidden;
    font-size: 12px;
  }
  .summary-box .s-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 14px;
    border-bottom: 1px solid ${BORDER};
  }
  .summary-box .s-row:last-child { border-bottom: none; }
  .summary-box .s-row.total {
    background: ${GREEN_DARK};
    color: ${WHITE};
    font-weight: 700;
    font-size: 13px;
  }
  .summary-box .s-row.sub-head {
    background: ${GREEN_BG};
    font-weight: 600;
    color: ${GREEN_DARK};
  }
  .summary-box .s-label { color: inherit; }
  .summary-box .s-value { font-weight: 600; }

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
      <div class="company-name">${esc(COMPANY.name)}</div>
      <div class="company-sub">CIN: U74999MH2024PTC000000 &nbsp;|&nbsp; ${esc(COMPANY.state)} (${esc(COMPANY.stateCode)})</div>
      <div class="company-meta">
        ${esc(COMPANY.address)}<br/>
        ${esc(COMPANY.email)} &nbsp;|&nbsp; ${esc(COMPANY.phone)}<br/>
        ${esc(COMPANY.website)}
      </div>
      <div class="gst-badge">GSTIN: ${esc(COMPANY.gstin)}</div>
    </div>
    <div class="header-right">
      <div class="tax-invoice-label">TAX INVOICE</div>
      <div class="invoice-meta">
        Invoice No: <span>${esc(data.invoiceNumber)}</span><br/>
        Invoice Date: <span>${esc(data.invoiceDate)}</span><br/>
        Place of Supply: <span>${esc(COMPANY.state)} (${esc(COMPANY.stateCode)})</span>
      </div>
    </div>
  </div>

  <!-- Body -->
  <div class="body">

    <!-- Bill To / Payment Info -->
    <div class="bill-row">
      <div class="bill-box">
        <h4>Bill To</h4>
        <p><strong>${esc(data.customerName)}</strong></p>
        <p>${esc(data.customerEmail)}</p>
        ${data.customerPhone ? `<p>${esc(data.customerPhone)}</p>` : ''}
        <p class="muted">Consumer (B2C)</p>
      </div>
      <div class="bill-box">
        <h4>Payment Details</h4>
        ${data.razorpayPaymentId ? `<p><strong>Payment ID:</strong> ${esc(data.razorpayPaymentId)}</p>` : ''}
        <p><strong>Mode:</strong> Online (Razorpay)</p>
        <p><strong>Status:</strong> Paid</p>
        <p class="muted">PAN: ${esc(COMPANY.pan)}</p>
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
            <th>HSN/SAC</th>
            <th class="right">Taxable Value</th>
            <th class="right">CGST (9%)</th>
            <th class="right">SGST (9%)</th>
            <th class="right">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td>
              <strong>Personalised Diet Plan – ${esc(data.planLabel)}</strong>
              <br/><span style="font-size:11px;color:#6b7280;">AI-generated nutrition plan with dietitian review</span>
            </td>
            <td>998399</td>
            <td class="right">${inr(taxableValue)}</td>
            <td class="right">${inr(cgst)}</td>
            <td class="right">${inr(sgst)}</td>
            <td class="right"><strong>${inr(total)}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Summary -->
    <div class="summary-row">
      <div class="summary-box">
        <div class="s-row sub-head">
          <span class="s-label">Taxable Amount</span>
          <span class="s-value">${inr(taxableValue)}</span>
        </div>
        <div class="s-row">
          <span class="s-label">CGST @ 9%</span>
          <span class="s-value">${inr(cgst)}</span>
        </div>
        <div class="s-row">
          <span class="s-label">SGST @ 9%</span>
          <span class="s-value">${inr(sgst)}</span>
        </div>
        <div class="s-row">
          <span class="s-label">Total GST (18%)</span>
          <span class="s-value">${inr(gstTotal)}</span>
        </div>
        <div class="s-row total">
          <span class="s-label">Grand Total (INR)</span>
          <span class="s-value">${inr(total)}</span>
        </div>
      </div>
    </div>

    <div class="divider"></div>

    <!-- Notes -->
    <div class="notes">
      <strong>Notes &amp; Declaration:</strong><br/>
      1. This is a computer-generated invoice and does not require a physical signature.<br/>
      2. This service is classified under SAC 998399 – Other information technology services.<br/>
      3. Tax (CGST + SGST) is applicable as per GST Act, 2017. Supply is intra-state (Maharashtra).<br/>
      4. Amount shown is inclusive of GST. Taxable value is computed as: Total ÷ 1.18.<br/>
      5. For support: ${esc(BRAND.supportEmail)} | ${esc(BRAND.supportPhone)}
    </div>

  </div><!-- /body -->

  <!-- Footer -->
  <div class="footer">
    <div>
      <div class="footer-brand">${esc(BRAND.name)}</div>
      <div class="footer-sub">${esc(BRAND.tagline)} &nbsp;|&nbsp; ${esc(BRAND.website)}</div>
    </div>
    <div class="footer-right">
      GSTIN: ${esc(COMPANY.gstin)} &nbsp;|&nbsp; PAN: ${esc(COMPANY.pan)}<br/>
      This invoice is system-generated.
    </div>
  </div>

</div><!-- /page -->
</body>
</html>`;
};
