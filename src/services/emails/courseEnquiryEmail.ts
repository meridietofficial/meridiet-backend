import { BRAND } from '../../config/brand';
import { c, emailLayout, footerText } from './layout';

const COURSE_FEE = '₹24,999';
const COURSE_NAME = 'MeriDiet Professional Nutrition Course';

export const courseEnquiryUserEmail = (
  name: string,
  details: { email: string; phone: string; qualification?: string | null; message?: string | null },
): { subject: string; html: string; text: string } => {
  const firstName = name.trim().split(/\s+/)[0] || 'there';
  const subject = `We received your enquiry — ${BRAND.name} Course`;

  const bodyHtml = `
    <h1 style="margin:0 0 16px 0;font-size:24px;font-weight:800;color:${c.textDark};line-height:1.3;">
      Hi ${firstName}, we got your enquiry!
    </h1>
    <p style="margin:0 0 24px 0;font-size:15px;line-height:1.7;color:${c.textMid};">
      Thank you for your interest in the <strong style="color:${c.green};">${COURSE_NAME}</strong>.
      Our team has received your enquiry and will get back to you shortly.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;">
      <tr>
        <td style="background:${c.greenBg};border-left:5px solid ${c.green};border-radius:10px;padding:20px 24px;">
          <div style="font-size:16px;font-weight:700;color:${c.green};text-transform:uppercase;letter-spacing:0.3px;">
            What's Next?
          </div>
          <div style="font-size:14px;line-height:1.7;color:${c.textDark};margin-top:8px;">
            Our counsellor will call you within <strong>24 hours</strong> to explain the course details,
            answer all your questions, and guide you through the enrollment process.
          </div>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 14px 0;font-size:14px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:${c.green};">
      Your Enquiry Details
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="margin:0 0 28px 0;border:1px solid ${c.border};border-radius:10px;overflow:hidden;">
      <tr>
        <td style="padding:13px 20px;border-bottom:1px solid ${c.border};background:${c.greenBg};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:13px;font-weight:600;color:${c.textMid};width:40%;">Name</td>
              <td style="font-size:14px;font-weight:700;color:${c.textDark};">${name}</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:13px 20px;border-bottom:1px solid ${c.border};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:13px;font-weight:600;color:${c.textMid};width:40%;">Phone</td>
              <td style="font-size:14px;font-weight:700;color:${c.textDark};">${details.phone}</td>
            </tr>
          </table>
        </td>
      </tr>
      ${details.qualification ? `
      <tr>
        <td style="padding:13px 20px;border-bottom:1px solid ${c.border};background:${c.greenBg};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:13px;font-weight:600;color:${c.textMid};width:40%;">Qualification</td>
              <td style="font-size:14px;font-weight:700;color:${c.textDark};">${details.qualification}</td>
            </tr>
          </table>
        </td>
      </tr>` : ''}
      <tr>
        <td style="padding:13px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:13px;font-weight:600;color:${c.textMid};width:40%;">Course Fee</td>
              <td style="font-size:14px;font-weight:700;color:${c.green};">${COURSE_FEE}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 24px 0;font-size:14px;line-height:1.7;color:${c.textMid};">
      If you have any immediate questions, feel free to reach us directly.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 12px 0;">
      <tr>
        <td style="border-radius:8px;background:${c.green};">
          <a href="tel:${BRAND.supportPhone.replace(/\s/g, '')}" target="_blank"
            style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:#ffffff;text-decoration:none;border-radius:8px;">
            Call Us Now
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:16px 0 0 0;font-size:13px;line-height:1.6;color:${c.textMid};">
      Or WhatsApp us at <a href="https://wa.me/${BRAND.supportPhone.replace(/\D/g, '')}" style="color:${c.green};text-decoration:none;">${BRAND.supportPhone}</a>
    </p>
  `;

  const html = emailLayout({
    preheader: `Hi ${firstName}, we've received your course enquiry and our counsellor will contact you within 24 hours.`,
    bodyHtml,
  });

  const text = [
    `Hi ${firstName}, we got your course enquiry!`,
    ``,
    `Thank you for your interest in the ${COURSE_NAME}.`,
    `Our counsellor will call you within 24 hours to explain the course details.`,
    ``,
    `YOUR ENQUIRY DETAILS`,
    `Name          : ${name}`,
    `Phone         : ${details.phone}`,
    details.qualification ? `Qualification : ${details.qualification}` : '',
    `Course Fee    : ${COURSE_FEE}`,
    ``,
    `Need to reach us? Call / WhatsApp ${BRAND.supportPhone}`,
    ``,
    ...footerText,
  ].filter(Boolean).join('\n');

  return { subject, html, text };
};

export const courseEnquiryAdminEmail = (data: {
  name: string;
  email: string;
  phone: string;
  qualification?: string | null;
  message?: string | null;
  id: number;
}): { subject: string; html: string; text: string } => {
  const subject = `[New Course Enquiry] ${data.name} — ${data.phone}`;

  const bodyHtml = `
    <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:800;color:${c.textDark};">
      New Course Enquiry Received
    </h1>
    <p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:${c.textMid};">
      A new enquiry has been submitted for the <strong>${BRAND.name} Professional Nutrition Course</strong>.
      Please reach out to the lead within 24 hours.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="margin:0 0 24px 0;border:1px solid ${c.border};border-radius:10px;overflow:hidden;">
      <tr><td style="padding:13px 20px;border-bottom:1px solid ${c.border};background:${c.greenBg};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:13px;font-weight:600;color:${c.textMid};width:35%;">Enquiry #</td>
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
      <tr><td style="padding:13px 20px;border-bottom:1px solid ${c.border};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:13px;font-weight:600;color:${c.textMid};width:35%;">Phone</td>
          <td style="font-size:14px;font-weight:700;color:${c.textDark};">
            <a href="tel:${data.phone}" style="color:${c.green};text-decoration:none;">${data.phone}</a>
          </td>
        </tr></table>
      </td></tr>
      ${data.qualification ? `
      <tr><td style="padding:13px 20px;border-bottom:1px solid ${c.border};background:${c.greenBg};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:13px;font-weight:600;color:${c.textMid};width:35%;">Qualification</td>
          <td style="font-size:14px;font-weight:700;color:${c.textDark};">${data.qualification}</td>
        </tr></table>
      </td></tr>` : ''}
      ${data.message ? `
      <tr><td style="padding:13px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:13px;font-weight:600;color:${c.textMid};width:35%;">Message</td>
          <td style="font-size:14px;color:${c.textDark};">${data.message}</td>
        </tr></table>
      </td></tr>` : ''}
    </table>
  `;

  const html = emailLayout({
    preheader: `New course enquiry from ${data.name} (${data.phone}) — follow up within 24 hrs.`,
    bodyHtml,
  });

  const text = [
    `NEW COURSE ENQUIRY #${data.id}`,
    ``,
    `Name          : ${data.name}`,
    `Email         : ${data.email}`,
    `Phone         : ${data.phone}`,
    data.qualification ? `Qualification : ${data.qualification}` : '',
    data.message ? `Message       : ${data.message}` : '',
    ``,
    `Please follow up within 24 hours.`,
  ].filter(Boolean).join('\n');

  return { subject, html, text };
};
