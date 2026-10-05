import { findPaymentById } from '../models/Payment';
import { findUserById } from '../models/User';
import { findDietFormById } from '../models/DietForm';
import { buildGstInvoiceHtml } from './gstInvoiceHtml';
import { generateGstInvoicePdf } from './generateGstInvoicePdf';
import { sendEmail } from './email';
import { BRAND } from '../config/brand';

const fmtDate = (d: Date): string => {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
};

const invoiceNumber = (paymentId: number, createdAt: Date): string => {
  const y = createdAt.getFullYear();
  const m = createdAt.getMonth() + 1;
  const fy = m >= 4 ? `${y}-${String(y + 1).slice(-2)}` : `${y - 1}-${String(y).slice(-2)}`;
  return `MDT/INV/${fy}/${String(paymentId).padStart(5, '0')}`;
};

const planLabel = (plan: string): string => {
  const map: Record<string, string> = {
    '1_week':   '1 Week',
    '1_month':  '1 Month',
    '3_months': '3 Months',
  };
  return map[plan] ?? plan;
};

const buildInvoiceEmailHtml = (customerName: string, invNumber: string): string => {
  const firstName = customerName.trim().split(/\s+/)[0] || 'there';
  const green = BRAND.colors.green;
  const greenDark = BRAND.colors.greenDark;
  const greenBg = BRAND.colors.greenBg;
  const textMid = BRAND.colors.textMid;
  const white = BRAND.colors.white;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Segoe UI',Arial,sans-serif;font-size:14px;color:#111;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:${white};border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="background:${greenDark};padding:28px 36px;text-align:center;">
            <div style="font-size:26px;font-weight:800;color:${white};letter-spacing:0.5px;">${BRAND.name}</div>
            <div style="font-size:12px;color:#a7f3d0;margin-top:4px;letter-spacing:1px;">${BRAND.tagline}</div>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 36px 28px;">
            <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#111;">Hi ${firstName}, your GST invoice is ready!</h2>
            <p style="margin:0 0 20px;line-height:1.7;color:${textMid};">
              Thank you for your payment. Please find your GST tax invoice (Invoice No: <strong>${invNumber}</strong>) attached to this email as a PDF.
            </p>
            <!-- Info box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
              <tr>
                <td style="background:${greenBg};border-left:4px solid ${green};border-radius:8px;padding:16px 20px;">
                  <p style="margin:0;font-size:13px;line-height:1.7;color:#1f2937;">
                    This is a computer-generated GST Tax Invoice as per the GST Act, 2017.
                    You can use this for reimbursement or tax purposes.<br/>
                    <strong>SAC Code:</strong> 998399 — Other information technology services.
                  </p>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 8px;font-size:13px;line-height:1.7;color:${textMid};">
              Need help? Reply to this email or reach us at
              <a href="mailto:${BRAND.supportEmail}" style="color:${green};text-decoration:none;">${BRAND.supportEmail}</a>
              &nbsp;|&nbsp;
              <a href="tel:${BRAND.supportPhone.replace(/\s/g, '')}" style="color:${green};text-decoration:none;">${BRAND.supportPhone}</a>
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="border-top:1px solid #e5e7eb;padding:18px 36px;background:${greenBg};text-align:center;">
            <p style="margin:0;font-size:11px;color:${textMid};">
              &copy; ${new Date().getFullYear()} ${BRAND.name} &nbsp;|&nbsp;
              <a href="${BRAND.website}" style="color:${green};text-decoration:none;">${BRAND.website}</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

export const sendGstInvoiceEmail = async (paymentId: number): Promise<void> => {
  const payment = await findPaymentById(paymentId);
  if (!payment || payment.status !== 'paid') return;

  const [user, form] = await Promise.all([
    payment.user_id ? findUserById(payment.user_id) : null,
    payment.diet_form_id ? findDietFormById(payment.diet_form_id) : null,
  ]);

  const email = user?.email ?? form?.email;
  if (!email) return;

  const createdAt    = new Date(payment.created_at);
  const invNumber    = invoiceNumber(payment.id, createdAt);
  const amount       = payment.final_amount ?? payment.amount;
  const customerName = user?.full_name ?? form?.full_name ?? 'Customer';
  const phone        = user?.phone_number
    ? `${user.phone_code ?? '+91'} ${user.phone_number}`
    : null;

  const html = buildGstInvoiceHtml({
    invoiceNumber:     invNumber,
    invoiceDate:       fmtDate(createdAt),
    customerName,
    customerEmail:     email,
    customerPhone:     phone,
    customerState:     form?.state ?? null,
    planLabel:         planLabel(payment.plan),
    amountPaid:        amount,
    razorpayPaymentId: payment.razorpay_payment_id,
  });

  const pdfBuffer = await generateGstInvoicePdf(html);
  const filename  = `GST_Invoice_${invNumber.replace(/\//g, '-')}.pdf`;

  const bodyHtml = buildInvoiceEmailHtml(customerName, invNumber);

  await sendEmail({
    to:      email,
    subject: `Your GST Tax Invoice – ${invNumber} | ${BRAND.name}`,
    html:    bodyHtml,
    text:    `Hi ${customerName},\n\nThank you for your payment. Please find your GST invoice (${invNumber}) attached.\n\nFor support: ${BRAND.supportEmail} | ${BRAND.supportPhone}`,
    attachments: [
      { filename, content: pdfBuffer, contentType: 'application/pdf' },
    ],
  });
};
