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

export const appointmentConfirmationEmail = (params: {
  userName: string;
  dietitianName: string;
  appointmentDate: string;
  slot: string;
  sessionType: 'video_call' | 'in_person';
  fee: number;
  currency: string;
}): { subject: string; html: string; text: string } => {
  const firstName = params.userName.trim().split(/\s+/)[0] || 'there';
  const formattedDate = formatDate(params.appointmentDate);
  const formattedTime = formatTime(params.slot);
  const sessionLabel = params.sessionType === 'video_call' ? 'Video Call' : 'In-Person';

  const subject = `Your appointment with ${BRAND.name} is confirmed!`;

  const checkBadge = `<div style="width:56px;height:56px;border-radius:50%;background:${c.green};text-align:center;line-height:56px;font-size:28px;color:${c.white};font-weight:700;">&#10003;</div>`;

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
    <h1 style="margin:0 0 16px 0;font-size:24px;font-weight:800;color:${c.textDark};text-transform:uppercase;line-height:1.3;">Hi ${firstName}, you're all set! 🎉</h1>
    <p style="margin:0 0 22px 0;font-size:15px;line-height:1.7;color:${c.textMid};">
      Your appointment with <strong style="color:${c.green};">${BRAND.name}</strong> has been successfully booked. Our expert dietitian will connect with you as scheduled.
    </p>

    <!-- Confirmation callout -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;">
      <tr>
        <td style="background:${c.greenBg};border-left:5px solid ${c.green};border-radius:10px;padding:22px 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td width="76" valign="middle">${checkBadge}</td>
              <td valign="middle">
                <div style="font-size:16px;font-weight:700;letter-spacing:0.3px;color:${c.green};text-transform:uppercase;">Booking Confirmed</div>
                <div style="font-size:14px;line-height:1.6;color:${c.textDark};margin-top:4px;">
                  Your session with <strong>${params.dietitianName}</strong> is confirmed and ready.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Appointment details -->
    <p style="margin:0 0 12px 0;font-size:14px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:${c.green};">Appointment Details</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;border-top:1px solid ${c.border};">
      ${detailRow('📅 Date', formattedDate)}
      ${detailRow('⏰ Time', formattedTime)}
      ${detailRow('👩‍⚕️ Dietitian', params.dietitianName)}
      ${detailRow('📋 Session Type', sessionLabel)}
      ${detailRow('💰 Amount Paid', `${params.currency} ${params.fee.toLocaleString('en-IN')}`)}
    </table>

    <p style="margin:0 0 24px 0;font-size:15px;line-height:1.7;color:${c.textMid};">
      Please be available a few minutes before your scheduled time. If you need to reschedule or have any questions, reach us on WhatsApp or email.
    </p>

    <!-- CTA -->
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px 0;">
      <tr>
        <td style="border-radius:8px;background:${c.green};">
          <a href="${BRAND.website}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:${c.white};text-decoration:none;border-radius:8px;">Join Your Consultation</a>
        </td>
      </tr>
    </table>
  `;

  const html = emailLayout({
    preheader: `Your appointment on ${formattedDate} at ${formattedTime} with ${params.dietitianName} is confirmed!`,
    bodyHtml,
  });

  const text = [
    `Hi ${firstName}, your appointment is confirmed!`,
    ``,
    `Your appointment with ${BRAND.name} has been successfully booked.`,
    ``,
    `APPOINTMENT DETAILS`,
    `Date: ${formattedDate}`,
    `Time: ${formattedTime}`,
    `Dietitian: ${params.dietitianName}`,
    `Session Type: ${sessionLabel}`,
    `Amount Paid: ${params.currency} ${params.fee}`,
    ``,
    `Please be available a few minutes before your scheduled time.`,
    ``,
    `Join your consultation: ${BRAND.website}`,
    ``,
    ...footerText,
  ].join('\n');

  return { subject, html, text };
};
