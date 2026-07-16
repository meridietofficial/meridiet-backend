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

const formatAmount = (amount: number): string =>
  `₹${Math.abs(amount).toLocaleString('en-IN')}`;

const detailRow = (label: string, value: string, highlight = false) => `
  <tr>
    <td style="padding:8px 0;color:${c.textMid};font-size:14px;border-bottom:1px solid #f0f0f0;">${label}</td>
    <td style="padding:8px 0;text-align:right;font-size:14px;font-weight:${highlight ? '700' : '500'};color:${highlight ? '#e53e3e' : c.textDark};border-bottom:1px solid #f0f0f0;">${value}</td>
  </tr>`;

export type NoShowPenaltyReason = 'dietitian_no_show' | 'both_no_show';

export const noShowPenaltyEmail = (params: {
  dietitianName: string;
  patientName: string;
  appointmentDate: string;
  slot: string;
  penaltyAmount: number;
  walletBalanceAfter: number;
  missedType: NoShowPenaltyReason;
  currency?: string;
  isSuspended: boolean;
}) => {
  const { dietitianName, patientName, appointmentDate, slot, penaltyAmount, walletBalanceAfter, missedType, isSuspended } = params;

  const isDietitianNoShow = missedType === 'dietitian_no_show';

  const subject = isDietitianNoShow
    ? `₹${penaltyAmount} Deducted — You Missed Appointment on ${formatDate(appointmentDate)}`
    : `₹${penaltyAmount} Penalty — Both Parties Missed Appointment on ${formatDate(appointmentDate)}`;

  const reasonText = isDietitianNoShow
    ? `You did not attend your scheduled appointment with <strong>${patientName}</strong>. As per ${BRAND.name}'s no-show policy, a penalty of <strong style="color:#e53e3e;">₹${penaltyAmount}</strong> has been deducted from your wallet.`
    : `Neither you nor the patient attended the scheduled appointment with <strong>${patientName}</strong>. As per ${BRAND.name}'s no-show policy, a penalty of <strong style="color:#e53e3e;">₹${penaltyAmount}</strong> has been deducted from your wallet.`;

  const suspensionNotice = isSuspended ? `
    <div style="margin:24px 0;padding:16px 20px;background:#fff5f5;border:1.5px solid #feb2b2;border-radius:10px;">
      <div style="font-size:15px;font-weight:700;color:#c53030;margin-bottom:6px;">⚠️ Account Suspended</div>
      <div style="font-size:14px;color:#742a2a;line-height:1.6;">
        Your wallet balance has gone below ₹0. Your account has been marked <strong>offline and inactive</strong> and will not accept new bookings.<br /><br />
        To restore your account, please add funds to bring your wallet balance to ₹0 or above. Once your balance is positive, your account will be automatically reactivated.
      </div>
    </div>` : '';

  const balanceColor = walletBalanceAfter < 0 ? '#e53e3e' : c.textDark;

  const bodyHtml = `
    <div style="padding:32px 40px;">
      <h2 style="margin:0 0 6px;font-size:22px;color:${c.textDark};font-weight:700;">No-Show Penalty Notice</h2>
      <p style="margin:0 0 24px;font-size:15px;color:${c.textMid};">Hi ${dietitianName},</p>

      <div style="margin-bottom:20px;padding:16px 20px;background:#fff5f5;border-left:4px solid #e53e3e;border-radius:0 8px 8px 0;">
        <p style="margin:0;font-size:14px;color:#742a2a;line-height:1.6;">${reasonText}</p>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
        ${detailRow('Appointment Date', formatDate(appointmentDate))}
        ${detailRow('Time', formatTime(slot))}
        ${detailRow('Patient', patientName)}
        ${detailRow('Reason', isDietitianNoShow ? 'Dietitian did not attend' : 'Both parties did not attend')}
        ${detailRow('Penalty Deducted', `- ${formatAmount(penaltyAmount)}`, true)}
        <tr>
          <td style="padding:10px 0;font-size:14px;font-weight:600;color:${c.textDark};">Wallet Balance After</td>
          <td style="padding:10px 0;text-align:right;font-size:15px;font-weight:700;color:${balanceColor};">${walletBalanceAfter < 0 ? '- ' : ''}${formatAmount(walletBalanceAfter)}</td>
        </tr>
      </table>

      ${suspensionNotice}

      <div style="margin-top:20px;padding:14px 18px;background:#f7fafc;border-radius:8px;font-size:13px;color:${c.textMid};line-height:1.6;">
        <strong>No-Show Policy:</strong><br />
        ${isDietitianNoShow
          ? `If a dietitian does not attend a confirmed appointment, a ₹${penaltyAmount} penalty is deducted from their wallet and the patient receives a full refund. Repeated no-shows may lead to account suspension.`
          : `If both parties miss an appointment, a ₹${penaltyAmount} penalty is applied to the dietitian's wallet. No refund is issued to the patient.`
        }
      </div>

      <p style="margin:24px 0 0;font-size:14px;color:${c.textMid};">
        If you believe this was an error, please contact our support team.<br />
        <a href="mailto:${BRAND.supportEmail}" style="color:${c.green};text-decoration:none;font-weight:600;">${BRAND.supportEmail}</a>
      </p>
    </div>`;

  return {
    subject,
    html: emailLayout({ preheader: subject, bodyHtml }),
    text: [
      `No-Show Penalty Notice — ${BRAND.name}`,
      `Hi ${dietitianName},`,
      '',
      reasonText.replace(/<[^>]+>/g, ''),
      '',
      `Appointment Date:   ${formatDate(appointmentDate)}`,
      `Time:               ${formatTime(slot)}`,
      `Patient:            ${patientName}`,
      `Penalty Deducted:   -₹${penaltyAmount}`,
      `Wallet Balance After: ${walletBalanceAfter < 0 ? '-' : ''}₹${Math.abs(walletBalanceAfter)}`,
      '',
      ...(isSuspended ? [
        'ACCOUNT SUSPENDED',
        'Your wallet balance has gone below ₹0. Your account is now offline and inactive.',
        'Add funds to restore your account.',
        '',
      ] : []),
      `Questions? Contact ${BRAND.supportEmail}`,
      ...footerText,
    ].join('\n'),
  };
};
