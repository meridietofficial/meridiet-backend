import { BRAND } from '../../config/brand';
import { c, emailLayout, footerText } from './layout';

export const partnershipInquiryAdminEmail = (data: {
  id: number;
  org: string;
  name: string;
  email: string;
  phone: string;
  city?: string | null;
  state?: string | null;
  area?: string | null;
  message?: string | null;
}): { subject: string; html: string; text: string } => {
  const subject = `[New Partnership Inquiry] ${data.org} — ${data.name}`;

  const row = (label: string, value: string, alt: boolean) => `
    <tr><td style="padding:13px 20px;${alt ? `background:${c.greenBg};` : ''}border-bottom:1px solid ${c.border};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:13px;font-weight:600;color:${c.textMid};width:35%;">${label}</td>
        <td style="font-size:14px;font-weight:700;color:${c.textDark};">${value}</td>
      </tr></table>
    </td></tr>`;

  const location = [data.city, data.state].filter(Boolean).join(', ') || '—';

  const bodyHtml = `
    <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:800;color:${c.textDark};">
      New Partnership Inquiry
    </h1>
    <p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:${c.textMid};">
      A new partnership inquiry has been submitted on <strong style="color:${c.green};">${BRAND.name}</strong>.
      Please review the details below and follow up at your earliest convenience.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="margin:0 0 24px 0;border:1px solid ${c.border};border-radius:10px;overflow:hidden;">
      ${row('Inquiry #',       `#${data.id}`,  true)}
      ${row('Organization',    data.org,        false)}
      ${row('Contact Person',  data.name,       true)}
      ${row('Email',           `<a href="mailto:${data.email}" style="color:${c.green};text-decoration:none;">${data.email}</a>`, false)}
      ${row('Phone',           `<a href="tel:${data.phone}" style="color:${c.green};text-decoration:none;">${data.phone}</a>`, true)}
      ${row('Location',        location,        false)}
      ${row('Area of Interest', data.area || '—', true)}
      ${data.message ? `
      <tr><td style="padding:13px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:13px;font-weight:600;color:${c.textMid};width:35%;vertical-align:top;">Message</td>
          <td style="font-size:14px;color:${c.textDark};line-height:1.6;">${data.message}</td>
        </tr></table>
      </td></tr>` : `
      <tr><td style="padding:13px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:13px;font-weight:600;color:${c.textMid};width:35%;">Message</td>
          <td style="font-size:14px;color:${c.textDark};">—</td>
        </tr></table>
      </td></tr>`}
    </table>
  `;

  const html = emailLayout({
    preheader: `New partnership inquiry from ${data.name} at ${data.org} — ${data.area || 'General'}.`,
    bodyHtml,
  });

  const text = [
    `NEW PARTNERSHIP INQUIRY #${data.id}`,
    ``,
    `Organization  : ${data.org}`,
    `Contact       : ${data.name}`,
    `Email         : ${data.email}`,
    `Phone         : ${data.phone}`,
    `Location      : ${location}`,
    `Area          : ${data.area || '—'}`,
    data.message ? `Message       : ${data.message}` : '',
    ``,
    `Please follow up at your earliest convenience.`,
    ``,
    ...footerText,
  ].filter(Boolean).join('\n');

  return { subject, html, text };
};
