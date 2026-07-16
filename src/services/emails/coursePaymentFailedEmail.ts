import { BRAND } from '../../config/brand';
import { c, emailLayout, footerText } from './layout';

const COURSE_NAME = 'MeriDiet Professional Nutrition Course';

export const coursePaymentFailedUserEmail = (
  name: string,
  details: {
    enrollmentId: number;
    amountAttempted: number;
  },
): { subject: string; html: string; text: string } => {
  const firstName = name.trim().split(/\s+/)[0] || 'there';
  const subject = `Payment Failed — Please Try Again | ${BRAND.name} Course`;
  const formattedAmount = `₹${details.amountAttempted.toLocaleString('en-IN')}`;

  const bodyHtml = `
    <h1 style="margin:0 0 16px 0;font-size:24px;font-weight:800;color:${c.textDark};line-height:1.3;">
      Hi ${firstName}, your payment was unsuccessful
    </h1>
    <p style="margin:0 0 24px 0;font-size:15px;line-height:1.7;color:${c.textMid};">
      Unfortunately, your payment of <strong>${formattedAmount}</strong> for the
      <strong style="color:${c.green};">${COURSE_NAME}</strong> could not be processed.
      Don't worry — your registration is still saved and your seat is reserved for a short time.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;">
      <tr>
        <td style="background:#FFF8F0;border-left:5px solid ${c.orange};border-radius:10px;padding:20px 24px;">
          <div style="font-size:15px;font-weight:700;color:#C0392B;text-transform:uppercase;letter-spacing:0.3px;">
            Payment Unsuccessful
          </div>
          <div style="font-size:14px;line-height:1.7;color:${c.textDark};margin-top:8px;">
            This can happen due to insufficient funds, a card block, or a network issue.
            Please try again with the same or a different payment method.
          </div>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 14px 0;font-size:14px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:${c.green};">
      Attempt Details
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="margin:0 0 28px 0;border:1px solid ${c.border};border-radius:10px;overflow:hidden;">
      <tr>
        <td style="padding:13px 20px;border-bottom:1px solid ${c.border};background:${c.greenBg};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="font-size:13px;font-weight:600;color:${c.textMid};width:45%;">Enrollment ID</td>
            <td style="font-size:14px;font-weight:700;color:${c.textDark};">#${details.enrollmentId}</td>
          </tr></table>
        </td>
      </tr>
      <tr>
        <td style="padding:13px 20px;border-bottom:1px solid ${c.border};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="font-size:13px;font-weight:600;color:${c.textMid};width:45%;">Name</td>
            <td style="font-size:14px;font-weight:700;color:${c.textDark};">${name}</td>
          </tr></table>
        </td>
      </tr>
      <tr>
        <td style="padding:13px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="font-size:13px;font-weight:600;color:${c.textMid};width:45%;">Amount Attempted</td>
            <td style="font-size:14px;font-weight:700;color:#C0392B;">${formattedAmount}</td>
          </tr></table>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 16px 0;font-size:14px;line-height:1.7;color:${c.textMid};">
      Return to the course page and click <strong>Proceed to Pay</strong> to try again.
      If the issue persists, contact us and we'll help you complete enrollment manually.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;">
      <tr>
        <td style="border-radius:8px;background:${c.green};">
          <a href="${BRAND.website}" target="_blank"
            style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:#ffffff;text-decoration:none;border-radius:8px;">
            Try Again
          </a>
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
    preheader: `Hi ${firstName}, your payment of ${formattedAmount} for the ${BRAND.name} Course was unsuccessful. Please try again.`,
    bodyHtml,
  });

  const text = [
    `Hi ${firstName}, your payment was unsuccessful.`,
    ``,
    `Your payment of ${formattedAmount} for the ${COURSE_NAME} could not be processed.`,
    `Your registration is still saved — return to the website and try again.`,
    ``,
    `ATTEMPT DETAILS`,
    `Enrollment ID     : #${details.enrollmentId}`,
    `Name              : ${name}`,
    `Amount Attempted  : ${formattedAmount}`,
    ``,
    `Return to ${BRAND.website} to try again.`,
    ``,
    `Need help? Call / WhatsApp ${BRAND.supportPhone} · ${BRAND.supportEmail}`,
    ``,
    ...footerText,
  ].join('\n');

  return { subject, html, text };
};
