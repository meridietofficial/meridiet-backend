import { BRAND } from '../../config/brand';
import { c, iconImg, stepRow, emailLayout, footerText } from './layout';

export const userWelcomeEmail = (fullName: string): { subject: string; html: string; text: string } => {
  const firstName = fullName.trim().split(/\s+/)[0] || 'there';
  const subject = `Welcome to ${BRAND.name} — your journey to a healthier you starts now!`;

  const bodyHtml = `
    <h1 style="margin:0 0 16px 0;font-size:24px;font-weight:800;color:${c.textDark};text-transform:uppercase;line-height:1.3;">Hi ${firstName}, welcome to ${BRAND.name}! 🌿</h1>
    <p style="margin:0 0 22px 0;font-size:15px;line-height:1.7;color:${c.textMid};">
      We're thrilled to have you on board. <strong style="color:${c.green};">${BRAND.name}</strong> connects you with expert dietitians and AI-powered nutrition plans — all personalised for your health goals.
    </p>

    <!-- Welcome callout -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 30px 0;">
      <tr>
        <td style="background:${c.greenBg};border-left:5px solid ${c.green};border-radius:10px;padding:22px 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td width="76" valign="middle">
                <div style="width:56px;height:56px;border-radius:50%;background:${c.white};text-align:center;line-height:56px;">${iconImg(BRAND.icons.heart, 40, 'Heart')}</div>
              </td>
              <td valign="middle">
                <div style="font-size:16px;font-weight:700;letter-spacing:0.3px;color:${c.green};text-transform:uppercase;">Your account is ready</div>
                <div style="font-size:14px;line-height:1.6;color:${c.textDark};margin-top:4px;">
                  You can now browse diet plans, fill in your health form, and connect with a verified dietitian — all in one place.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Getting started steps -->
    <p style="margin:0 0 18px 0;font-size:14px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:${c.green};">Get started in 3 easy steps</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 26px 0;">
      ${stepRow(1, iconImg(BRAND.icons.person, 26, 'Person'), 'Complete your health profile', 'Tell us about your goals, lifestyle, and dietary preferences.', true)}
      ${stepRow(2, iconImg(BRAND.icons.aiChip, 26, 'AI'), 'Get your personalised diet plan', 'Our AI + expert dietitians craft a plan tailored just for you.', true)}
      ${stepRow(3, iconImg(BRAND.icons.heart, 26, 'Heart'), 'Start your healthy journey', 'Track progress and stay connected with your dietitian.', false)}
    </table>

    <p style="margin:0 0 24px 0;font-size:15px;line-height:1.7;color:${c.textMid};">
      Have questions? We're always here to help — just reply to this email or reach us on WhatsApp.
    </p>

    <!-- CTA -->
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px 0;">
      <tr>
        <td style="border-radius:8px;background:${c.green};">
          <a href="${BRAND.website}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:${c.white};text-decoration:none;border-radius:8px;">Explore ${BRAND.name}</a>
        </td>
      </tr>
    </table>
  `;

  const html = emailLayout({
    preheader: `Welcome to ${BRAND.name}! Your account is ready — start your personalised nutrition journey today.`,
    bodyHtml,
  });

  const text = [
    `Hi ${firstName}, welcome to ${BRAND.name}!`,
    ``,
    `We're thrilled to have you on board. ${BRAND.name} connects you with expert dietitians and AI-powered nutrition plans — all personalised for your health goals.`,
    ``,
    `YOUR ACCOUNT IS READY`,
    `You can now browse diet plans, fill in your health form, and connect with a verified dietitian — all in one place.`,
    ``,
    `Get started in 3 easy steps:`,
    `1. Complete your health profile — tell us about your goals, lifestyle, and dietary preferences.`,
    `2. Get your personalised diet plan — our AI + expert dietitians craft a plan tailored just for you.`,
    `3. Start your healthy journey — track progress and stay connected with your dietitian.`,
    ``,
    `Have questions? We're always here to help — just reply to this email or reach us on WhatsApp.`,
    ``,
    `Explore ${BRAND.name}: ${BRAND.website}`,
    ``,
    ...footerText,
  ].join('\n');

  return { subject, html, text };
};
