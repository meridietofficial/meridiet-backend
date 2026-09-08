import { BRAND } from '../../config/brand';
import { c, emailLayout, footerText } from './layout';

export const sponsorCohortAdminEmail = (data: {
  id: number;
  org: string;
  designation?: string | null;
  contact: string;
  org_type: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  cohort_size: string;
  message?: string | null;
}): { subject: string; html: string; text: string } => {
  const subject = `[New Sponsor Inquiry] ${data.org} — ${data.cohort_size}`;

  const row = (label: string, value: string, alt: boolean, last = false) => `
    <tr><td style="padding:13px 20px;${alt ? `background:${c.greenBg};` : ''}${last ? '' : `border-bottom:1px solid ${c.border};`}">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:13px;font-weight:600;color:${c.textMid};width:35%;vertical-align:top;">${label}</td>
        <td style="font-size:14px;font-weight:700;color:${c.textDark};">${value}</td>
      </tr></table>
    </td></tr>`;

  const bodyHtml = `
    <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:800;color:${c.textDark};">
      New Sponsor Cohort Inquiry
    </h1>
    <p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:${c.textMid};">
      A new sponsorship inquiry has been submitted on <strong style="color:${c.green};">${BRAND.name}</strong>.
      Please review the details and follow up promptly.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="margin:0 0 24px 0;border:1px solid ${c.border};border-radius:10px;overflow:hidden;">
      ${row('Inquiry #',        `#${data.id}`,                    true)}
      ${row('Organization',     data.org,                          false)}
      ${row('Organization Type', data.org_type,                   true)}
      ${row('Contact Person',   data.contact,                      false)}
      ${data.designation ? row('Designation', data.designation,    true) : ''}
      ${row('Email',
        `<a href="mailto:${data.email}" style="color:${c.green};text-decoration:none;">${data.email}</a>`,
        data.designation ? false : true)}
      ${row('Phone',
        `<a href="tel:${data.phone}" style="color:${c.green};text-decoration:none;">${data.phone}</a>`,
        data.designation ? true : false)}
      ${row('Location',         `${data.city}, ${data.state}`,    data.designation ? false : true)}
      ${row('Cohort Size',      data.cohort_size,                  data.designation ? true : false)}
      <tr><td style="padding:13px 20px;${data.designation ? '' : `background:${c.greenBg};`}">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:13px;font-weight:600;color:${c.textMid};width:35%;vertical-align:top;">Message</td>
          <td style="font-size:14px;color:${c.textDark};line-height:1.6;">${data.message || '—'}</td>
        </tr></table>
      </td></tr>
    </table>
  `;

  const html = emailLayout({
    preheader: `New sponsor inquiry from ${data.contact} at ${data.org} — ${data.cohort_size}.`,
    bodyHtml,
  });

  const text = [
    `NEW SPONSOR COHORT INQUIRY #${data.id}`,
    ``,
    `Organization  : ${data.org}`,
    `Org Type      : ${data.org_type}`,
    `Contact       : ${data.contact}`,
    data.designation ? `Designation   : ${data.designation}` : '',
    `Email         : ${data.email}`,
    `Phone         : ${data.phone}`,
    `Location      : ${data.city}, ${data.state}`,
    `Cohort Size   : ${data.cohort_size}`,
    data.message ? `Message       : ${data.message}` : '',
    ``,
    `Please follow up at your earliest convenience.`,
    ``,
    ...footerText,
  ].filter(Boolean).join('\n');

  return { subject, html, text };
};
