import { BRAND } from '../../config/brand';
import { c, iconImg, stepRow, emailLayout, footerText } from './layout';

/**
 * Acknowledgment email sent to a dietitian right after they register.
 * Conveys that the application was received and is pending verification.
 */
export const dietitianWelcomeEmail = (fullName: string): { subject: string; html: string; text: string } => {
  const firstName = fullName.trim().split(/\s+/)[0] || 'there';
  const subject = `Welcome to ${BRAND.name} — your application has been received`;

  const bodyHtml = `
    <h1 style="margin:0 0 16px 0;font-size:24px;font-weight:800;color:${c.textDark};text-transform:uppercase;line-height:1.3;">Hi ${firstName}, welcome aboard! 🌿</h1>
    <p style="margin:0 0 22px 0;font-size:15px;line-height:1.7;color:${c.textMid};">
      Thank you for registering as a Dietitian Partner with <strong style="color:${c.green};">${BRAND.name}</strong>. We've successfully received your application.
    </p>

    <!-- Status callout -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 30px 0;">
      <tr>
        <td style="background:${c.greenBg};border-left:5px solid ${c.green};border-radius:10px;padding:22px 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td width="76" valign="middle">
                <div style="width:56px;height:56px;border-radius:50%;background:${c.white};text-align:center;line-height:56px;">${iconImg(BRAND.icons.clock, 40, 'Clock')}</div>
              </td>
              <td valign="middle">
                <div style="font-size:16px;font-weight:700;letter-spacing:0.3px;color:${c.green};text-transform:uppercase;">Your application is under review</div>
                <div style="font-size:14px;line-height:1.6;color:${c.textDark};margin-top:4px;">
                  Our team will verify your profile and documents within <strong>24&ndash;48 hours</strong>. You'll receive an email as soon as your account is approved.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- What happens next -->
    <p style="margin:0 0 18px 0;font-size:14px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:${c.green};">What happens next</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 26px 0;">
      ${stepRow(1, iconImg(BRAND.icons.mail, 26, 'Mail'), 'Application received', "We've received your details.", true)}
      ${stepRow(2, iconImg(BRAND.icons.search, 26, 'Search'), 'Verification (24–48 hours)', 'Our team reviews your profile and documents.', true)}
      ${stepRow(3, iconImg(BRAND.icons.person, 26, 'Person'), "You're live", `Start helping clients on ${BRAND.name}.`, false)}
    </table>

    <p style="margin:0 0 24px 0;font-size:15px;line-height:1.7;color:${c.textMid};">
      In the meantime, if you have any questions, simply reply to this email and we'll be happy to help.
    </p>

    <!-- CTA -->
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px 0;">
      <tr>
        <td style="border-radius:8px;background:${c.green};">
          <a href="${BRAND.website}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:${c.white};text-decoration:none;border-radius:8px;">Visit our website</a>
        </td>
      </tr>
    </table>
  `;

  const html = emailLayout({
    preheader: `Thanks for registering with ${BRAND.name}. Your application is under review.`,
    bodyHtml,
  });

  const text = [
    `Hi ${firstName}, welcome aboard!`,
    ``,
    `Thank you for registering as a Dietitian Partner with ${BRAND.name}. We've successfully received your application.`,
    ``,
    `YOUR APPLICATION IS UNDER REVIEW`,
    `Our team will verify your profile and documents within 24-48 hours. You'll receive an email as soon as your account is approved.`,
    ``,
    `What happens next:`,
    `1. Application received - we've received your details.`,
    `2. Verification (24-48 hours) - our team reviews your profile and documents.`,
    `3. You're live - start helping clients on ${BRAND.name}.`,
    ``,
    `In the meantime, if you have any questions, simply reply to this email and we'll be happy to help.`,
    ``,
    `Visit our website: ${BRAND.website}`,
    ``,
    ...footerText,
  ].join('\n');

  return { subject, html, text };
};
