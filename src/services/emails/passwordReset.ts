import { BRAND } from '../../config/brand';
import { c, iconImg, emailLayout, footerText } from './layout';

/**
 * Password-reset email containing a time-limited link to the new-password form.
 * `resetUrl` already includes the ?token=... query param.
 */
export const passwordResetEmail = (
  fullName: string,
  resetUrl: string,
  expiryMinutes: number,
): { subject: string; html: string; text: string } => {
  const firstName = fullName.trim().split(/\s+/)[0] || 'there';
  const subject = `Reset your ${BRAND.name} password`;
  const expiryText = expiryMinutes >= 60 ? `${Math.round(expiryMinutes / 60)} hour(s)` : `${expiryMinutes} minutes`;

  const bodyHtml = `
    <h1 style="margin:0 0 16px 0;font-size:24px;font-weight:800;color:${c.textDark};text-transform:uppercase;line-height:1.3;">Hi ${firstName}, reset your password 🔒</h1>
    <p style="margin:0 0 22px 0;font-size:15px;line-height:1.7;color:${c.textMid};">
      We received a request to reset the password for your <strong style="color:${c.green};">${BRAND.name}</strong> account. Click the button below to choose a new password.
    </p>

    <!-- Expiry callout -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;">
      <tr>
        <td style="background:${c.greenBg};border-left:5px solid ${c.green};border-radius:10px;padding:22px 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td width="76" valign="middle">
                <div style="width:56px;height:56px;border-radius:50%;background:${c.white};text-align:center;line-height:56px;">${iconImg(BRAND.icons.clock, 40, 'Clock')}</div>
              </td>
              <td valign="middle">
                <div style="font-size:16px;font-weight:700;letter-spacing:0.3px;color:${c.green};text-transform:uppercase;">This link expires soon</div>
                <div style="font-size:14px;line-height:1.6;color:${c.textDark};margin-top:4px;">
                  For your security, this reset link is valid for <strong>${expiryText}</strong>. After that you'll need to request a new one.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- CTA -->
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 22px 0;">
      <tr>
        <td style="border-radius:8px;background:${c.green};">
          <a href="${resetUrl}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:${c.white};text-decoration:none;border-radius:8px;">Reset password</a>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 10px 0;font-size:13px;line-height:1.6;color:${c.textMid};">
      If the button doesn't work, copy and paste this link into your browser:
    </p>
    <p style="margin:0 0 24px 0;font-size:13px;line-height:1.6;word-break:break-all;">
      <a href="${resetUrl}" style="color:${c.green};text-decoration:none;">${resetUrl}</a>
    </p>

    <p style="margin:0;font-size:14px;line-height:1.7;color:${c.textMid};">
      Didn't request this? You can safely ignore this email — your password won't change unless you click the link above and set a new one.
    </p>
  `;

  const html = emailLayout({
    preheader: `Reset your ${BRAND.name} password. This link expires in ${expiryText}.`,
    bodyHtml,
  });

  const text = [
    `Hi ${firstName}, reset your password`,
    ``,
    `We received a request to reset the password for your ${BRAND.name} account.`,
    `Open this link to choose a new password (valid for ${expiryText}):`,
    resetUrl,
    ``,
    `Didn't request this? You can safely ignore this email — your password won't change.`,
    ``,
    ...footerText,
  ].join('\n');

  return { subject, html, text };
};
