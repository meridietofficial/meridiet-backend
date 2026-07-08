import { BRAND } from '../../config/brand';
import { c, emailLayout, footerText } from './layout';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const formatDate = (dateStr: string): string => {
  const [yr, mo, dy] = dateStr.split('-').map(Number);
  const d = new Date(yr, mo - 1, dy);
  return `${DAY_NAMES[d.getDay()]}, ${dy} ${MONTH_NAMES[mo - 1]} ${yr}`;
};

const formatTime = (slot: string): string => {
  const [h, m] = slot.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour   = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${suffix}`;
};

export const appointmentCompletedEmail = (params: {
  userName: string;
  dietitianName: string;
  appointmentDate: string;
  slot: string;
  rateUrl: string;
}): { subject: string; html: string; text: string } => {
  const firstName     = params.userName.trim().split(/\s+/)[0] || 'there';
  const formattedDate = formatDate(params.appointmentDate);
  const formattedTime = formatTime(params.slot);

  const subject = `How was your consultation with ${BRAND.name}?`;

  const starRow = `
    <tr>
      <td align="center" style="padding:20px 0 8px 0;">
        <span style="font-size:32px;letter-spacing:6px;">⭐⭐⭐⭐⭐</span>
      </td>
    </tr>
  `;

  const detailRow = (label: string, value: string) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid ${c.border};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:13px;font-weight:600;color:${c.textMid};text-transform:uppercase;letter-spacing:0.4px;width:40%;">${label}</td>
            <td style="font-size:14px;font-weight:700;color:${c.textDark};text-align:right;">${value}</td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  const bodyHtml = `
    <h1 style="margin:0 0 16px 0;font-size:24px;font-weight:800;color:${c.textDark};line-height:1.3;">
      Hi ${firstName}, your consultation is complete! 🎉
    </h1>
    <p style="margin:0 0 22px 0;font-size:15px;line-height:1.7;color:${c.textMid};">
      We hope you had a great experience with <strong style="color:${c.green};">${params.dietitianName}</strong>.
      Your health journey matters to us, and your feedback helps us serve you better.
    </p>

    <!-- Session summary -->
    <p style="margin:0 0 12px 0;font-size:14px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:${c.green};">Session Summary</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;border-top:1px solid ${c.border};">
      ${detailRow('📅 Date', formattedDate)}
      ${detailRow('⏰ Time', formattedTime)}
      ${detailRow('👩‍⚕️ Dietitian', params.dietitianName)}
    </table>

    <!-- Rating prompt -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;">
      <tr>
        <td style="background:${c.greenBg};border-left:5px solid ${c.green};border-radius:10px;padding:22px 24px;text-align:center;">
          <div style="font-size:16px;font-weight:700;color:${c.textDark};margin-bottom:6px;">How was your experience?</div>
          <div style="font-size:14px;color:${c.textMid};margin-bottom:16px;">
            Rate your dietitian and share your feedback — it only takes a minute.
          </div>
          ${starRow}
        </td>
      </tr>
    </table>

    <!-- CTA -->
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 12px 0;">
      <tr>
        <td style="border-radius:8px;background:${c.green};">
          <a href="${params.rateUrl}" target="_blank"
             style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;
                    letter-spacing:0.5px;text-transform:uppercase;color:#fff;text-decoration:none;border-radius:8px;">
            ⭐ Rate Your Dietitian
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 24px 0;font-size:12px;color:${c.textMid};">
      Or copy this link: <a href="${params.rateUrl}" style="color:${c.green};word-break:break-all;">${params.rateUrl}</a>
    </p>

    <p style="margin:0;font-size:14px;line-height:1.7;color:${c.textMid};">
      Thank you for choosing ${BRAND.name}. We look forward to supporting your health journey! 💚
    </p>
  `;

  const html = emailLayout({
    preheader: `Your consultation on ${formattedDate} with ${params.dietitianName} is complete — share your feedback!`,
    bodyHtml,
  });

  const text = [
    `Hi ${firstName}, your consultation is complete!`,
    ``,
    `We hope you had a great experience with ${params.dietitianName}.`,
    ``,
    `SESSION SUMMARY`,
    `Date: ${formattedDate}`,
    `Time: ${formattedTime}`,
    `Dietitian: ${params.dietitianName}`,
    ``,
    `How was your experience? Rate your dietitian here:`,
    params.rateUrl,
    ``,
    ...footerText,
  ].join('\n');

  return { subject, html, text };
};
