import { BRAND } from '../../config/brand';
import { c, iconImg, stepRow, emailLayout, footerText } from './layout';

/**
 * Sent to a dietitian once an admin verifies/approves their account.
 * Confirms approval and points them to the dashboard login.
 */
export const dietitianApprovedEmail = (fullName: string): { subject: string; html: string; text: string } => {
  const firstName = fullName.trim().split(/\s+/)[0] || 'there';
  const subject = `You're verified — your ${BRAND.name} account is now active`;

  // Success badge: white check on a solid green circle (pure HTML, always renders).
  const checkBadge = `<div style="width:56px;height:56px;border-radius:50%;background:${c.green};text-align:center;line-height:56px;font-size:30px;color:${c.white};font-weight:700;">&#10003;</div>`;

  const bodyHtml = `
    <h1 style="margin:0 0 16px 0;font-size:24px;font-weight:800;color:${c.textDark};text-transform:uppercase;line-height:1.3;">Hi ${firstName}, you're verified! 🎉</h1>
    <p style="margin:0 0 22px 0;font-size:15px;line-height:1.7;color:${c.textMid};">
      Great news — our team has reviewed and approved your application. Your <strong style="color:${c.green};">${BRAND.name}</strong> Dietitian Partner account is now active.
    </p>

    <!-- Success callout -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 30px 0;">
      <tr>
        <td style="background:${c.greenBg};border-left:5px solid ${c.green};border-radius:10px;padding:22px 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td width="76" valign="middle">${checkBadge}</td>
              <td valign="middle">
                <div style="font-size:16px;font-weight:700;letter-spacing:0.3px;color:${c.green};text-transform:uppercase;">Your account is approved</div>
                <div style="font-size:14px;line-height:1.6;color:${c.textDark};margin-top:4px;">
                  You can now log in to your dashboard and start helping clients on ${BRAND.name}.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- What you can do now -->
    <p style="margin:0 0 18px 0;font-size:14px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:${c.green};">What you can do now</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 26px 0;">
      ${stepRow(1, iconImg(BRAND.icons.person, 26, 'Profile'), 'Complete your profile', 'Add your photo, bio and services so clients can find you.', true)}
      ${stepRow(2, iconImg(BRAND.icons.clock, 26, 'Availability'), 'Set your availability', 'Choose the days and times you can take appointments.', true)}
      ${stepRow(3, iconImg(BRAND.icons.heart, 26, 'Clients'), 'Start helping clients', 'Accept consultations and create personalized diet plans.', false)}
    </table>

    <p style="margin:0 0 24px 0;font-size:15px;line-height:1.7;color:${c.textMid};">
      If you have any questions, simply reply to this email and we'll be happy to help.
    </p>

    <!-- CTA -->
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px 0;">
      <tr>
        <td style="border-radius:8px;background:${c.green};">
          <a href="${BRAND.dashboardUrl}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:${c.white};text-decoration:none;border-radius:8px;">Login to dashboard</a>
        </td>
      </tr>
    </table>
  `;

  const html = emailLayout({
    preheader: `Your ${BRAND.name} account is verified. You can now log in to your dashboard.`,
    bodyHtml,
  });

  const text = [
    `Hi ${firstName}, you're verified!`,
    ``,
    `Great news — our team has reviewed and approved your application. Your ${BRAND.name} Dietitian Partner account is now active.`,
    ``,
    `YOUR ACCOUNT IS APPROVED`,
    `You can now log in to your dashboard and start helping clients on ${BRAND.name}.`,
    ``,
    `What you can do now:`,
    `1. Complete your profile - add your photo, bio and services so clients can find you.`,
    `2. Set your availability - choose the days and times you can take appointments.`,
    `3. Start helping clients - accept consultations and create personalized diet plans.`,
    ``,
    `If you have any questions, simply reply to this email and we'll be happy to help.`,
    ``,
    `Login to dashboard: ${BRAND.dashboardUrl}`,
    ``,
    ...footerText,
  ].join('\n');

  return { subject, html, text };
};
