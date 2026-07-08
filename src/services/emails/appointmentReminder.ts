import { BRAND } from '../../config/brand';
import { c, emailLayout, footerText } from './layout';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const formatDate = (dateStr: string): string => {
  const [yr, mo, dy] = dateStr.split('-').map(Number);
  const d = new Date(yr, mo - 1, dy);
  return `${DAY_NAMES[d.getDay()]}, ${dy} ${MONTH_NAMES[mo - 1]} ${yr}`;
};

const formatTime = (slot: string): string => {
  const [h, m] = slot.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${suffix}`;
};

// User 1h reminder email
export const appointmentReminderEmail = (params: {
  userName: string;
  dietitianName: string;
  appointmentDate: string;
  slot: string;
  sessionType: 'video_call' | 'in_person';
  joinUrl?: string;
}): { subject: string; html: string; text: string } => {
  const firstName = params.userName.trim().split(/\s+/)[0] || 'there';
  const formattedDate = formatDate(params.appointmentDate);
  const formattedTime = formatTime(params.slot);
  const sessionLabel = params.sessionType === 'video_call' ? 'Video Call' : 'In-Person';

  const subject = `Reminder: Your consultation is in 1 hour — ${formattedTime}`;

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
    <h1 style="margin:0 0 16px 0;font-size:24px;font-weight:800;color:${c.textDark};text-transform:uppercase;line-height:1.3;">Hi ${firstName}, your consultation is in 1 hour! ⏰</h1>
    <p style="margin:0 0 22px 0;font-size:15px;line-height:1.7;color:${c.textMid};">
      Just a reminder — your session with <strong style="color:${c.green};">${params.dietitianName}</strong> starts in about <strong>1 hour</strong>. Please be ready a few minutes early.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;">
      <tr>
        <td style="background:${c.greenBg};border-left:5px solid ${c.green};border-radius:10px;padding:22px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${c.border};">
            ${detailRow('📅 Date', formattedDate)}
            ${detailRow('⏰ Time', formattedTime)}
            ${detailRow('👩‍⚕️ Dietitian', params.dietitianName)}
            ${detailRow('📋 Session', sessionLabel)}
          </table>
        </td>
      </tr>
    </table>

    ${params.sessionType === 'video_call' && params.joinUrl ? `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 12px 0;">
      <tr>
        <td style="border-radius:8px;background:${c.green};">
          <a href="${params.joinUrl}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:#fff;text-decoration:none;border-radius:8px;">🎥 Join Video Consultation</a>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 8px 0;font-size:12px;color:${c.textMid};">Or copy this link: <a href="${params.joinUrl}" style="color:${c.green};word-break:break-all;">${params.joinUrl}</a></p>
    ` : `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px 0;">
      <tr>
        <td style="border-radius:8px;background:${c.green};">
          <a href="${BRAND.website}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:#fff;text-decoration:none;border-radius:8px;">Visit MeriDiet</a>
        </td>
      </tr>
    </table>
    `}
  `;

  const html = emailLayout({
    preheader: `Your consultation with ${params.dietitianName} starts at ${formattedTime} today.`,
    bodyHtml,
  });

  const text = [
    `Hi ${firstName}, your consultation is in 1 hour!`,
    ``,
    `Session with: ${params.dietitianName}`,
    `Date: ${formattedDate}`,
    `Time: ${formattedTime}`,
    `Session Type: ${sessionLabel}`,
    ``,
    params.joinUrl ? `Join your consultation: ${params.joinUrl}` : `Visit MeriDiet: ${BRAND.website}`,
    ``,
    ...footerText,
  ].join('\n');

  return { subject, html, text };
};
