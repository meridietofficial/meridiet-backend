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

// ── User reschedule email ─────────────────────────────────────────────────────

export const appointmentRescheduledUserEmail = (params: {
  userName: string;
  dietitianName: string;
  previousDate: string;
  previousSlot: string;
  newDate: string;
  newSlot: string;
  sessionType: 'video_call' | 'in_person';
  reason?: string | null;
  joinUrl?: string;
}): { subject: string; html: string; text: string } => {
  const firstName = params.userName.trim().split(/\s+/)[0] || 'there';
  const oldDate = formatDate(params.previousDate);
  const oldTime = formatTime(params.previousSlot);
  const newDate = formatDate(params.newDate);
  const newTime = formatTime(params.newSlot);
  const sessionLabel = params.sessionType === 'video_call' ? 'Video Call' : 'In-Person';

  const subject = `Your appointment has been rescheduled — ${newDate}`;

  const detailRow = (label: string, value: string, highlight = false) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid ${c.border};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:13px;font-weight:600;color:${c.textMid};text-transform:uppercase;letter-spacing:0.4px;width:40%;">${label}</td>
            <td style="font-size:14px;font-weight:700;color:${highlight ? c.green : c.textDark};text-align:right;">${value}</td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  const bodyHtml = `
    <h1 style="margin:0 0 16px 0;font-size:24px;font-weight:800;color:${c.textDark};text-transform:uppercase;line-height:1.3;">Hi ${firstName}, your appointment has been rescheduled 📅</h1>
    <p style="margin:0 0 22px 0;font-size:15px;line-height:1.7;color:${c.textMid};">
      Your consultation with <strong style="color:${c.green};">${params.dietitianName}</strong> has been moved to a new date and time. Please note the updated schedule below.
    </p>

    <!-- Previous slot -->
    <p style="margin:0 0 12px 0;font-size:14px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:${c.textMid};">Previous Schedule</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;border-top:1px solid ${c.border};opacity:0.6;">
      ${detailRow('📅 Date', oldDate)}
      ${detailRow('⏰ Time', oldTime)}
    </table>

    <!-- New slot callout -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;">
      <tr>
        <td style="background:${c.greenBg};border-left:5px solid ${c.green};border-radius:10px;padding:22px 24px;">
          <div style="font-size:13px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:${c.green};margin-bottom:12px;">New Schedule</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${c.border};">
            ${detailRow('📅 Date', newDate, true)}
            ${detailRow('⏰ Time', newTime, true)}
            ${detailRow('👩‍⚕️ Dietitian', params.dietitianName)}
            ${detailRow('📋 Session Type', sessionLabel)}
          </table>
        </td>
      </tr>
    </table>

    ${params.reason ? `
    <p style="margin:0 0 12px 0;font-size:14px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:${c.green};">Reason for Reschedule</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;">
      <tr>
        <td style="background:#FFF8F0;border-left:5px solid #f4842c;border-radius:8px;padding:14px 18px;font-size:14px;line-height:1.6;color:${c.textDark};">
          ${params.reason}
        </td>
      </tr>
    </table>` : ''}

    <p style="margin:0 0 24px 0;font-size:15px;line-height:1.7;color:${c.textMid};">
      Please be available a few minutes before your new scheduled time. If you have any questions, reach us on WhatsApp or email.
    </p>

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
    preheader: `Your appointment has been moved to ${newDate} at ${newTime}.`,
    bodyHtml,
  });

  const text = [
    `Hi ${firstName}, your appointment has been rescheduled.`,
    ``,
    `Your consultation with ${params.dietitianName} has been moved.`,
    ``,
    `PREVIOUS SCHEDULE`,
    `Date: ${oldDate}`,
    `Time: ${oldTime}`,
    ``,
    `NEW SCHEDULE`,
    `Date: ${newDate}`,
    `Time: ${newTime}`,
    `Dietitian: ${params.dietitianName}`,
    `Session Type: ${sessionLabel}`,
    ...(params.reason ? [`Reason: ${params.reason}`] : []),
    ``,
    params.joinUrl ? `Join your consultation: ${params.joinUrl}` : `Visit MeriDiet: ${BRAND.website}`,
    ``,
    ...footerText,
  ].join('\n');

  return { subject, html, text };
};

// ── Dietitian reschedule confirmation email ───────────────────────────────────

export const appointmentRescheduledDietitianEmail = (params: {
  dietitianName: string;
  patientName: string;
  previousDate: string;
  previousSlot: string;
  newDate: string;
  newSlot: string;
  sessionType: 'video_call' | 'in_person';
}): { subject: string; html: string; text: string } => {
  const firstName = params.dietitianName.trim().split(/\s+/)[0] || 'there';
  const oldDate = formatDate(params.previousDate);
  const oldTime = formatTime(params.previousSlot);
  const newDate = formatDate(params.newDate);
  const newTime = formatTime(params.newSlot);
  const sessionLabel = params.sessionType === 'video_call' ? 'Video Call' : 'In-Person';

  const subject = `Appointment rescheduled — ${params.patientName} on ${newDate}`;

  const detailRow = (label: string, value: string, highlight = false) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid ${c.border};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:13px;font-weight:600;color:${c.textMid};text-transform:uppercase;letter-spacing:0.4px;width:40%;">${label}</td>
            <td style="font-size:14px;font-weight:700;color:${highlight ? c.green : c.textDark};text-align:right;">${value}</td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  const bodyHtml = `
    <h1 style="margin:0 0 16px 0;font-size:24px;font-weight:800;color:${c.textDark};text-transform:uppercase;line-height:1.3;">Hi ${firstName}, appointment rescheduled ✅</h1>
    <p style="margin:0 0 22px 0;font-size:15px;line-height:1.7;color:${c.textMid};">
      The appointment with <strong style="color:${c.green};">${params.patientName}</strong> has been successfully rescheduled. The patient has been notified.
    </p>

    <!-- Previous slot -->
    <p style="margin:0 0 12px 0;font-size:14px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:${c.textMid};">Previous Schedule</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;border-top:1px solid ${c.border};opacity:0.6;">
      ${detailRow('📅 Date', oldDate)}
      ${detailRow('⏰ Time', oldTime)}
    </table>

    <!-- New slot callout -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;">
      <tr>
        <td style="background:${c.greenBg};border-left:5px solid ${c.green};border-radius:10px;padding:22px 24px;">
          <div style="font-size:13px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:${c.green};margin-bottom:12px;">New Schedule</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${c.border};">
            ${detailRow('👤 Patient', params.patientName)}
            ${detailRow('📅 Date', newDate, true)}
            ${detailRow('⏰ Time', newTime, true)}
            ${detailRow('📋 Session Type', sessionLabel)}
          </table>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 24px 0;font-size:15px;line-height:1.7;color:${c.textMid};">
      Log in to your dashboard to view and manage the updated appointment.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px 0;">
      <tr>
        <td style="border-radius:8px;background:${c.green};">
          <a href="${BRAND.dashboardUrl}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:#fff;text-decoration:none;border-radius:8px;">View in Dashboard</a>
        </td>
      </tr>
    </table>
  `;

  const html = emailLayout({
    preheader: `${params.patientName}'s appointment has been moved to ${newDate} at ${newTime}.`,
    bodyHtml,
  });

  const text = [
    `Hi ${firstName}, the appointment has been rescheduled.`,
    ``,
    `${params.patientName}'s appointment has been successfully moved.`,
    ``,
    `PREVIOUS SCHEDULE`,
    `Date: ${oldDate}`,
    `Time: ${oldTime}`,
    ``,
    `NEW SCHEDULE`,
    `Patient: ${params.patientName}`,
    `Date: ${newDate}`,
    `Time: ${newTime}`,
    `Session Type: ${sessionLabel}`,
    ``,
    `Log in to manage your appointments: ${BRAND.dashboardUrl}`,
    ``,
    ...footerText,
  ].join('\n');

  return { subject, html, text };
};
