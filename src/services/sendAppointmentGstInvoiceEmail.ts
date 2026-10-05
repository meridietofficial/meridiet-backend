import { findAppointmentById } from '../models/Appointment';
import { buildGstInvoiceHtml } from './gstInvoiceHtml';
import { generateGstInvoicePdf } from './generateGstInvoicePdf';
import { sendEmail } from './email';
import { BRAND } from '../config/brand';

const fmtDate = (d: Date): string => {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
};

const invoiceNumber = (appointmentId: number, createdAt: Date): string => {
  const y = createdAt.getFullYear();
  const m = createdAt.getMonth() + 1;
  const fy = m >= 4 ? `${y}-${String(y + 1).slice(-2)}` : `${y - 1}-${String(y).slice(-2)}`;
  return `MDT/APT/${fy}/${String(appointmentId).padStart(5, '0')}`;
};

const buildInvoiceEmailHtml = (customerName: string, invNumber: string): string => {
  const firstName = customerName.trim().split(/\s+/)[0] || 'there';
  const green     = BRAND.colors.green;
  const greenDark = BRAND.colors.greenDark;
  const greenBg   = BRAND.colors.greenBg;
  const textMid   = BRAND.colors.textMid;
  const white     = BRAND.colors.white;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Segoe UI',Arial,sans-serif;font-size:14px;color:#111;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:${white};border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
        <tr>
          <td style="background:${greenDark};padding:28px 36px;text-align:center;">
            <div style="font-size:26px;font-weight:800;color:${white};letter-spacing:0.5px;">${BRAND.name}</div>
            <div style="font-size:12px;color:#a7f3d0;margin-top:4px;letter-spacing:1px;">${BRAND.tagline}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 36px 28px;">
            <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#111;">Hi ${firstName}, your consultation invoice is ready!</h2>
            <p style="margin:0 0 20px;line-height:1.7;color:${textMid};">
              Thank you for booking your consultation. Please find your GST tax invoice
              (Invoice No: <strong>${invNumber}</strong>) attached to this email as a PDF.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
              <tr>
                <td style="background:${greenBg};border-left:4px solid ${green};border-radius:8px;padding:16px 20px;">
                  <p style="margin:0;font-size:13px;line-height:1.7;color:#1f2937;">
                    This is a computer-generated GST Tax Invoice as per the GST Act, 2017.
                    You can use this for reimbursement or tax purposes.
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

export const sendAppointmentGstInvoiceEmail = async (appointmentId: number): Promise<void> => {
  const appointment = await findAppointmentById(appointmentId);
  if (!appointment || appointment.payment_status !== 'paid') return;
  if (!appointment.email) return;

  const createdAt    = new Date(appointment.created_at);
  const invNumber    = invoiceNumber(appointment.id, createdAt);
  const amountPaid   = appointment.final_amount ?? appointment.fee;
  const sessionLabel = appointment.session_type === 'video_call' ? 'Video Call' : 'In-Person';
  const serviceDesc  = `Dietitian Consultation – ${sessionLabel}`;

  const invoiceHtml = buildGstInvoiceHtml({
    invoiceNumber:      invNumber,
    invoiceDate:        fmtDate(createdAt),
    customerName:       appointment.name,
    customerEmail:      appointment.email,
    customerPhone:      appointment.phone ?? null,
    customerState:      null,   // no customer state on appointments → IGST 18%
    planLabel:          sessionLabel,
    serviceDescription: serviceDesc,
    amountPaid,
    razorpayPaymentId:  appointment.payment_id ?? null,
  });

  const pdfBuffer = await generateGstInvoicePdf(invoiceHtml);
  const filename  = `GST_Invoice_${invNumber.replace(/\//g, '-')}.pdf`;
  const bodyHtml  = buildInvoiceEmailHtml(appointment.name, invNumber);

  await sendEmail({
    to:      appointment.email,
    subject: `Your GST Tax Invoice – ${invNumber} | ${BRAND.name}`,
    html:    bodyHtml,
    text:    `Hi ${appointment.name},\n\nThank you for booking your consultation. Please find your GST invoice (${invNumber}) attached.\n\nFor support: ${BRAND.supportEmail} | ${BRAND.supportPhone}`,
    attachments: [{ filename, content: pdfBuffer, contentType: 'application/pdf' }],
  });
};
