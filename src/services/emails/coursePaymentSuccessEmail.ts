import { BRAND } from '../../config/brand';
import { c, iconImg, emailLayout, footerText } from './layout';

const COURSE_NAME = 'MeriDiet Professional Nutrition Course';

export const coursePaymentSuccessUserEmail = (
  name: string,
  details: {
    enrollmentId: number;
    email: string;
    phone: string;
    amountPaid: number;
    razorpayPaymentId: string;
  },
): { subject: string; html: string; text: string } => {
  const firstName = name.trim().split(/\s+/)[0] || 'there';
  const subject = `Payment Confirmed — Welcome to ${BRAND.name} Course!`;
  const formattedAmount = `₹${details.amountPaid.toLocaleString('en-IN')}`;

  const bodyHtml = `
    <h1 style="margin:0 0 16px 0;font-size:24px;font-weight:800;color:${c.textDark};line-height:1.3;">
      Welcome aboard, ${firstName}!
    </h1>
    <p style="margin:0 0 24px 0;font-size:15px;line-height:1.7;color:${c.textMid};">
      Your payment for the <strong style="color:${c.green};">${COURSE_NAME}</strong> has been successfully received.
      You are now officially enrolled! Our team will reach out within <strong>24 hours</strong> with your course access details.
    </p>

    <!-- Success callout -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;">
      <tr>
        <td style="background:${c.greenBg};border-left:5px solid ${c.green};border-radius:10px;padding:22px 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td width="76" valign="middle">
                <div style="width:56px;height:56px;border-radius:50%;background:${c.white};text-align:center;line-height:56px;">
                  ${iconImg(BRAND.icons.heart, 38, 'Welcome')}
                </div>
              </td>
              <td valign="middle">
                <div style="font-size:16px;font-weight:700;letter-spacing:0.3px;color:${c.green};text-transform:uppercase;">
                  Payment Successful — Seat Confirmed!
                </div>
                <div style="font-size:14px;line-height:1.6;color:${c.textDark};margin-top:4px;">
                  Amount paid: <strong style="color:${c.green};">${formattedAmount}</strong>.
                  Our team will contact you within 24 hours with your course access.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Payment receipt -->
    <p style="margin:0 0 14px 0;font-size:14px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:${c.green};">
      Payment Receipt
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
        <td style="padding:13px 20px;border-bottom:1px solid ${c.border};background:${c.greenBg};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="font-size:13px;font-weight:600;color:${c.textMid};width:45%;">Course</td>
            <td style="font-size:14px;font-weight:700;color:${c.textDark};">${COURSE_NAME}</td>
          </tr></table>
        </td>
      </tr>
      <tr>
        <td style="padding:13px 20px;border-bottom:1px solid ${c.border};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="font-size:13px;font-weight:600;color:${c.textMid};width:45%;">Amount Paid</td>
            <td style="font-size:16px;font-weight:800;color:${c.green};">${formattedAmount}</td>
          </tr></table>
        </td>
      </tr>
      <tr>
        <td style="padding:13px 20px;background:${c.greenBg};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="font-size:13px;font-weight:600;color:${c.textMid};width:45%;">Transaction ID</td>
            <td style="font-size:13px;font-weight:600;color:${c.textDark};word-break:break-all;">${details.razorpayPaymentId}</td>
          </tr></table>
        </td>
      </tr>
    </table>

    <!-- What happens next -->
    <p style="margin:0 0 14px 0;font-size:14px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:${c.green};">
      What Happens Next
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;">
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid ${c.border};">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
            <td width="36" valign="top">
              <div style="width:26px;height:26px;border-radius:50%;background:${c.green};color:#fff;font-size:13px;font-weight:700;text-align:center;line-height:26px;">1</div>
            </td>
            <td valign="top" style="padding-left:8px;">
              <div style="font-size:14px;font-weight:700;color:${c.textDark};">Enrollment Confirmed</div>
              <div style="font-size:13px;color:${c.textMid};margin-top:2px;">Your seat in the course is officially secured.</div>
            </td>
          </tr></table>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid ${c.border};">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
            <td width="36" valign="top">
              <div style="width:26px;height:26px;border-radius:50%;background:${c.green};color:#fff;font-size:13px;font-weight:700;text-align:center;line-height:26px;">2</div>
            </td>
            <td valign="top" style="padding-left:8px;">
              <div style="font-size:14px;font-weight:700;color:${c.textDark};">Team Will Contact You</div>
              <div style="font-size:13px;color:${c.textMid};margin-top:2px;">Our team will reach out within 24 hours on your phone / WhatsApp with course access details.</div>
            </td>
          </tr></table>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
            <td width="36" valign="top">
              <div style="width:26px;height:26px;border-radius:50%;background:${c.green};color:#fff;font-size:13px;font-weight:700;text-align:center;line-height:26px;">3</div>
            </td>
            <td valign="top" style="padding-left:8px;">
              <div style="font-size:14px;font-weight:700;color:${c.textDark};">Start Learning</div>
              <div style="font-size:13px;color:${c.textMid};margin-top:2px;">Get full access to the ${COURSE_NAME} curriculum and begin your nutrition journey.</div>
            </td>
          </tr></table>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:13px;line-height:1.6;color:${c.textMid};">
      Questions? Call / WhatsApp
      <a href="tel:${BRAND.supportPhone.replace(/\s/g, '')}" style="color:${c.green};text-decoration:none;">${BRAND.supportPhone}</a>
      or email <a href="mailto:${BRAND.supportEmail}" style="color:${c.green};text-decoration:none;">${BRAND.supportEmail}</a>.
    </p>
  `;

  const html = emailLayout({
    preheader: `Payment confirmed! Welcome to the ${BRAND.name} Course. ${formattedAmount} received. Our team will contact you within 24 hours.`,
    bodyHtml,
  });

  const text = [
    `Welcome aboard, ${firstName}! Payment Confirmed.`,
    ``,
    `Your payment for the ${COURSE_NAME} has been successfully received.`,
    `Our team will contact you within 24 hours with your course access details.`,
    ``,
    `PAYMENT RECEIPT`,
    `Enrollment ID  : #${details.enrollmentId}`,
    `Name           : ${name}`,
    `Course         : ${COURSE_NAME}`,
    `Amount Paid    : ${formattedAmount}`,
    `Transaction ID : ${details.razorpayPaymentId}`,
    ``,
    `WHAT HAPPENS NEXT`,
    `1. Enrollment Confirmed — Your seat is officially secured.`,
    `2. Team Will Contact You — Within 24 hours on phone / WhatsApp.`,
    `3. Start Learning — Full course access provided.`,
    ``,
    `Need help? Call / WhatsApp ${BRAND.supportPhone} · ${BRAND.supportEmail}`,
    ``,
    ...footerText,
  ].join('\n');

  return { subject, html, text };
};

export const coursePaymentSuccessAdminEmail = (data: {
  enrollmentId: number;
  name: string;
  email: string;
  phone: string;
  amountPaid: number;
  razorpayPaymentId: string;
  razorpayOrderId: string;
}): { subject: string; html: string; text: string } => {
  const subject = `[Payment Received] ${data.name} — ₹${data.amountPaid.toLocaleString('en-IN')} — Course Enrollment #${data.enrollmentId}`;
  const formattedAmount = `₹${data.amountPaid.toLocaleString('en-IN')}`;

  const bodyHtml = `
    <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:800;color:${c.textDark};">
      Course Payment Received
    </h1>
    <p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:${c.textMid};">
      A student has successfully paid for the <strong>${COURSE_NAME}</strong>.
      Please reach out within 24 hours to provide course access.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="margin:0 0 24px 0;border:1px solid ${c.border};border-radius:10px;overflow:hidden;">
      <tr><td style="padding:13px 20px;border-bottom:1px solid ${c.border};background:${c.greenBg};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:13px;font-weight:600;color:${c.textMid};width:40%;">Enrollment #</td>
          <td style="font-size:14px;font-weight:700;color:${c.textDark};">#${data.enrollmentId}</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:13px 20px;border-bottom:1px solid ${c.border};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:13px;font-weight:600;color:${c.textMid};width:40%;">Name</td>
          <td style="font-size:14px;font-weight:700;color:${c.textDark};">${data.name}</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:13px 20px;border-bottom:1px solid ${c.border};background:${c.greenBg};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:13px;font-weight:600;color:${c.textMid};width:40%;">Email</td>
          <td style="font-size:14px;font-weight:700;color:${c.textDark};">
            <a href="mailto:${data.email}" style="color:${c.green};text-decoration:none;">${data.email}</a>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:13px 20px;border-bottom:1px solid ${c.border};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:13px;font-weight:600;color:${c.textMid};width:40%;">Phone</td>
          <td style="font-size:14px;font-weight:700;color:${c.textDark};">
            <a href="tel:${data.phone}" style="color:${c.green};text-decoration:none;">${data.phone}</a>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:13px 20px;border-bottom:1px solid ${c.border};background:${c.greenBg};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:13px;font-weight:600;color:${c.textMid};width:40%;">Amount Paid</td>
          <td style="font-size:16px;font-weight:800;color:${c.green};">${formattedAmount}</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:13px 20px;border-bottom:1px solid ${c.border};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:13px;font-weight:600;color:${c.textMid};width:40%;">Payment ID</td>
          <td style="font-size:13px;font-weight:600;color:${c.textDark};word-break:break-all;">${data.razorpayPaymentId}</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:13px 20px;background:${c.greenBg};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:13px;font-weight:600;color:${c.textMid};width:40%;">Order ID</td>
          <td style="font-size:13px;font-weight:600;color:${c.textDark};word-break:break-all;">${data.razorpayOrderId}</td>
        </tr></table>
      </td></tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="background:#FFF8F0;border-left:5px solid ${c.orange};border-radius:10px;padding:16px 20px;">
          <div style="font-size:14px;font-weight:600;line-height:1.6;color:${c.textDark};">
            Action: Contact <strong>${data.name}</strong> within 24 hours to provide course access details.
          </div>
        </td>
      </tr>
    </table>
  `;

  const html = emailLayout({
    preheader: `${data.name} paid ${formattedAmount} for the MeriDiet Course. Provide access within 24 hours.`,
    bodyHtml,
  });

  const text = [
    `COURSE PAYMENT RECEIVED — ENROLLMENT #${data.enrollmentId}`,
    ``,
    `Name          : ${data.name}`,
    `Email         : ${data.email}`,
    `Phone         : ${data.phone}`,
    `Amount Paid   : ${formattedAmount}`,
    `Payment ID    : ${data.razorpayPaymentId}`,
    `Order ID      : ${data.razorpayOrderId}`,
    ``,
    `ACTION: Contact ${data.name} within 24 hours to provide course access.`,
  ].join('\n');

  return { subject, html, text };
};
