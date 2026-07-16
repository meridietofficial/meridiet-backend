import { BRAND } from '../../config/brand';
import { c, emailLayout, footerText } from './layout';

const COURSE_FEE = '₹24,999';
const COURSE_NAME = 'MeriDiet Professional Nutrition Course';

// Sent right after /course/enroll — before payment is completed
export const courseEnrollmentUserEmail = (
  name: string,
  details: { email: string; phone: string; enrollmentId: number },
): { subject: string; html: string; text: string } => {
  const firstName = name.trim().split(/\s+/)[0] || 'there';
  const subject = `Complete Your Payment to Confirm Enrollment — ${BRAND.name} Course`;

  const bodyHtml = `
    <h1 style="margin:0 0 16px 0;font-size:24px;font-weight:800;color:${c.textDark};line-height:1.3;">
      Hi ${firstName}, you're almost in!
    </h1>
    <p style="margin:0 0 24px 0;font-size:15px;line-height:1.7;color:${c.textMid};">
      Your registration for the <strong style="color:${c.green};">${COURSE_NAME}</strong> has been received.
      Complete your payment of <strong style="color:${c.green};">${COURSE_FEE}</strong> on the checkout page to confirm your seat.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;">
      <tr>
        <td style="background:${c.greenBg};border-left:5px solid ${c.green};border-radius:10px;padding:20px 24px;">
          <div style="font-size:16px;font-weight:700;color:${c.green};text-transform:uppercase;letter-spacing:0.3px;">
            One Step Away from Joining!
          </div>
          <div style="font-size:14px;line-height:1.7;color:${c.textDark};margin-top:8px;">
            Your seat is reserved for a short time. Complete the secure online payment of
            <strong>${COURSE_FEE}</strong> on the checkout page to lock it in.
          </div>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 14px 0;font-size:14px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:${c.green};">
      Your Registration Summary
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="margin:0 0 28px 0;border:1px solid ${c.border};border-radius:10px;overflow:hidden;">
      <tr>
        <td style="padding:13px 20px;border-bottom:1px solid ${c.border};background:${c.greenBg};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="font-size:13px;font-weight:600;color:${c.textMid};width:40%;">Enrollment ID</td>
            <td style="font-size:14px;font-weight:700;color:${c.textDark};">#${details.enrollmentId}</td>
          </tr></table>
        </td>
      </tr>
      <tr>
        <td style="padding:13px 20px;border-bottom:1px solid ${c.border};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="font-size:13px;font-weight:600;color:${c.textMid};width:40%;">Name</td>
            <td style="font-size:14px;font-weight:700;color:${c.textDark};">${name}</td>
          </tr></table>
        </td>
      </tr>
      <tr>
        <td style="padding:13px 20px;border-bottom:1px solid ${c.border};background:${c.greenBg};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="font-size:13px;font-weight:600;color:${c.textMid};width:40%;">Phone</td>
            <td style="font-size:14px;font-weight:700;color:${c.textDark};">${details.phone}</td>
          </tr></table>
        </td>
      </tr>
      <tr>
        <td style="padding:13px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="font-size:13px;font-weight:600;color:${c.textMid};width:40%;">Course Fee</td>
            <td style="font-size:14px;font-weight:700;color:${c.green};">${COURSE_FEE}</td>
          </tr></table>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
      <tr>
        <td style="background:#FFF8F0;border-left:5px solid ${c.orange};border-radius:10px;padding:16px 20px;">
          <div style="font-size:13px;line-height:1.6;color:${c.textMid};">
            📌 <strong>Did not complete payment?</strong>
            Return to the checkout page or contact us to complete your enrollment.
          </div>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:13px;line-height:1.6;color:${c.textMid};">
      Need help? Call / WhatsApp
      <a href="tel:${BRAND.supportPhone.replace(/\s/g, '')}" style="color:${c.green};text-decoration:none;">${BRAND.supportPhone}</a>
      or email <a href="mailto:${BRAND.supportEmail}" style="color:${c.green};text-decoration:none;">${BRAND.supportEmail}</a>.
    </p>
  `;

  const html = emailLayout({
    preheader: `Hi ${firstName}, complete your payment of ${COURSE_FEE} to confirm your seat in the ${BRAND.name} Course.`,
    bodyHtml,
  });

  const text = [
    `Hi ${firstName}, you're almost in!`,
    ``,
    `Complete your payment of ${COURSE_FEE} to confirm your seat in the ${COURSE_NAME}.`,
    ``,
    `REGISTRATION SUMMARY`,
    `Enrollment ID : #${details.enrollmentId}`,
    `Name          : ${name}`,
    `Phone         : ${details.phone}`,
    `Course Fee    : ${COURSE_FEE}`,
    ``,
    `Return to the checkout page to complete your payment.`,
    ``,
    `Need help? Call / WhatsApp ${BRAND.supportPhone} · ${BRAND.supportEmail}`,
    ``,
    ...footerText,
  ].join('\n');

  return { subject, html, text };
};

// Sent to admin when a new enrollment is created (payment pending)
export const courseEnrollmentAdminEmail = (data: {
  id: number;
  name: string;
  email: string;
  phone: string;
}): { subject: string; html: string; text: string } => {
  const subject = `[New Enrollment] ${data.name} — ${data.phone} — Payment Pending`;

  const bodyHtml = `
    <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:800;color:${c.textDark};">
      New Course Enrollment Initiated
    </h1>
    <p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:${c.textMid};">
      A student has started the enrollment for the <strong>MeriDiet Professional Nutrition Course</strong>.
      Payment of <strong>${COURSE_FEE}</strong> is in progress via the website checkout.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="margin:0 0 24px 0;border:1px solid ${c.border};border-radius:10px;overflow:hidden;">
      <tr><td style="padding:13px 20px;border-bottom:1px solid ${c.border};background:${c.greenBg};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:13px;font-weight:600;color:${c.textMid};width:35%;">Enrollment #</td>
          <td style="font-size:14px;font-weight:700;color:${c.textDark};">#${data.id}</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:13px 20px;border-bottom:1px solid ${c.border};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:13px;font-weight:600;color:${c.textMid};width:35%;">Name</td>
          <td style="font-size:14px;font-weight:700;color:${c.textDark};">${data.name}</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:13px 20px;border-bottom:1px solid ${c.border};background:${c.greenBg};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:13px;font-weight:600;color:${c.textMid};width:35%;">Email</td>
          <td style="font-size:14px;font-weight:700;color:${c.textDark};">
            <a href="mailto:${data.email}" style="color:${c.green};text-decoration:none;">${data.email}</a>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:13px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:13px;font-weight:600;color:${c.textMid};width:35%;">Phone</td>
          <td style="font-size:14px;font-weight:700;color:${c.textDark};">
            <a href="tel:${data.phone}" style="color:${c.green};text-decoration:none;">${data.phone}</a>
          </td>
        </tr></table>
      </td></tr>
    </table>

    <p style="margin:0;font-size:13px;color:${c.textMid};">
      A payment confirmation email will be sent automatically once the payment is completed.
    </p>
  `;

  const html = emailLayout({
    preheader: `New enrollment from ${data.name} (${data.phone}). ${COURSE_FEE} payment in progress on website.`,
    bodyHtml,
  });

  const text = [
    `NEW COURSE ENROLLMENT #${data.id} — PAYMENT PENDING`,
    ``,
    `Name  : ${data.name}`,
    `Email : ${data.email}`,
    `Phone : ${data.phone}`,
    ``,
    `${COURSE_FEE} payment is in progress via website checkout.`,
    `You will receive a confirmation once payment is complete.`,
  ].join('\n');

  return { subject, html, text };
};
