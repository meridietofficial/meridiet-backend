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

const formatAmount = (amount: number, currency = 'INR'): string =>
  currency === 'INR' ? `₹${amount.toLocaleString('en-IN')}` : `${currency} ${amount}`;

export const appointmentPaymentApprovedEmail = (params: {
  dietitianName: string;
  patientName: string;
  appointmentDate: string;
  slot: string;
  grossAmount: number;
  commission: number;
  netAmount: number;
  commPct: number;
  currency?: string;
  isNoShow: boolean;
}): { subject: string; html: string; text: string } => {
  const firstName     = params.dietitianName.trim().split(/\s+/)[0] || 'there';
  const formattedDate = formatDate(params.appointmentDate);
  const formattedTime = formatTime(params.slot);
  const currency      = params.currency ?? 'INR';

  const subject = params.isNoShow
    ? `No-Show Compensation Credited — ₹${params.netAmount} for ${params.patientName}`
    : `Payment Credited — ₹${params.netAmount} for ${params.patientName}`;

  const detailRow = (label: string, value: string, highlight = false) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid ${c.border};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:13px;font-weight:600;color:${c.textMid};text-transform:uppercase;letter-spacing:0.4px;width:55%;">${label}</td>
            <td style="font-size:14px;font-weight:${highlight ? '800' : '700'};color:${highlight ? c.green : c.textDark};text-align:right;">${value}</td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  const noShowExplanation = params.isNoShow ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;">
      <tr>
        <td style="background:#FFF8E1;border-left:5px solid #F59E0B;border-radius:10px;padding:20px 24px;">
          <div style="font-size:14px;font-weight:700;color:#92400E;margin-bottom:8px;">Why did you receive 50%?</div>
          <div style="font-size:13px;line-height:1.7;color:#78350F;">
            When a patient doesn't attend their scheduled appointment, ${BRAND.name}'s
            no-show policy compensates you for your reserved time at <strong>50% of the net
            consultation fee</strong> (after platform commission). The remaining 50% is retained
            by ${BRAND.name} to cover platform and operational costs.
          </div>
        </td>
      </tr>
    </table>
  ` : '';

  const bodyHtml = `
    <h1 style="margin:0 0 16px 0;font-size:24px;font-weight:800;color:${c.textDark};line-height:1.3;">
      Hi ${firstName}, your payment has been credited! 💰
    </h1>
    <p style="margin:0 0 22px 0;font-size:15px;line-height:1.7;color:${c.textMid};">
      ${params.isNoShow
        ? `The appointment with <strong style="color:${c.green};">${params.patientName}</strong> was marked as a <strong>patient no-show</strong>. You have received partial compensation as per our no-show policy.`
        : `The appointment with <strong style="color:${c.green};">${params.patientName}</strong> has been marked as completed and your earnings have been credited to your wallet.`
      }
    </p>

    <!-- Appointment info -->
    <p style="margin:0 0 12px 0;font-size:14px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:${c.green};">Appointment Details</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;border-top:1px solid ${c.border};">
      ${detailRow('📅 Date', formattedDate)}
      ${detailRow('⏰ Time', formattedTime)}
      ${detailRow('👤 Patient', params.patientName)}
    </table>

    <!-- Payment breakdown -->
    <p style="margin:0 0 12px 0;font-size:14px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:${c.green};">Payment Breakdown</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;border-top:1px solid ${c.border};">
      ${detailRow('Consultation Fee', formatAmount(params.grossAmount, currency))}
      ${detailRow(`${BRAND.name} Commission (${params.commPct}%)`, `− ${formatAmount(params.commission, currency)}`)}
      ${params.isNoShow ? detailRow('After Commission', formatAmount(params.grossAmount - params.commission, currency)) : ''}
      ${params.isNoShow ? detailRow('No-Show Compensation (50%)', formatAmount(params.netAmount, currency), true) : detailRow('Amount Credited to Wallet', formatAmount(params.netAmount, currency), true)}
    </table>

    <!-- Credited badge -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;">
      <tr>
        <td style="background:${c.greenBg};border-left:5px solid ${c.green};border-radius:10px;padding:20px 24px;text-align:center;">
          <div style="font-size:13px;font-weight:600;color:${c.textMid};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Amount Credited</div>
          <div style="font-size:32px;font-weight:800;color:${c.green};">${formatAmount(params.netAmount, currency)}</div>
        </td>
      </tr>
    </table>

    ${noShowExplanation}

    <p style="margin:0;font-size:14px;line-height:1.7;color:${c.textMid};">
      Thank you for your dedication to your patients. Keep up the great work! 💚
    </p>
  `;

  const html = emailLayout({
    preheader: `${formatAmount(params.netAmount, currency)} credited for your appointment with ${params.patientName} on ${formattedDate}`,
    bodyHtml,
  });

  const netAfterCommission = params.grossAmount - params.commission;
  const text = [
    `Hi ${firstName}, your payment has been credited!`,
    ``,
    `Appointment: ${formattedDate} at ${formattedTime}`,
    `Patient: ${params.patientName}`,
    params.isNoShow ? `Status: Patient No-Show` : `Status: Completed`,
    ``,
    `PAYMENT BREAKDOWN`,
    `Consultation Fee:              ${formatAmount(params.grossAmount, currency)}`,
    `${BRAND.name} Commission (${params.commPct}%): − ${formatAmount(params.commission, currency)}`,
    ...(params.isNoShow ? [
      `After Commission:              ${formatAmount(netAfterCommission, currency)}`,
      `No-Show Compensation (50%):    ${formatAmount(params.netAmount, currency)}`,
    ] : []),
    `Amount Credited to Wallet:     ${formatAmount(params.netAmount, currency)}`,
    ``,
    ...(params.isNoShow ? [
      `WHY DID YOU RECEIVE 50%?`,
      `When a patient doesn't attend their appointment, ${BRAND.name}'s no-show policy`,
      `compensates you at 50% of the net fee for your reserved time.`,
      ``,
    ] : []),
    ...footerText,
  ].join('\n');

  return { subject, html, text };
};
