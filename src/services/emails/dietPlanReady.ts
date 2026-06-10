import { BRAND } from '../../config/brand';
import { c, iconImg, emailLayout, footerText } from './layout';

export const dietPlanReadyEmail = (
  fullName: string,
  pdfUrl: string,
  cashback: number | null,
): { subject: string; html: string; text: string } => {
  const firstName = fullName.trim().split(/\s+/)[0] || 'there';
  const subject = `🥗 Your Personalized Diet Plan is Ready — Download Now!`;

  const cashbackBanner = cashback && cashback > 0 ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
      <tr>
        <td style="background:#FFF3E0;border-left:5px solid ${c.orange};border-radius:10px;padding:14px 20px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td width="40" valign="middle" style="font-size:24px;">🎁</td>
              <td valign="middle">
                <div style="font-size:14px;font-weight:700;color:${c.orange};">
                  ₹${cashback.toFixed(2)} Cashback Credited to Your Wallet!
                </div>
                <div style="font-size:12px;color:${c.textMid};margin-top:2px;">
                  As a reward for choosing ${BRAND.name}, we've added ₹${cashback.toFixed(2)} to your wallet. Use it on your next plan!
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  ` : '';

  const bodyHtml = `
    <h1 style="margin:0 0 16px 0;font-size:24px;font-weight:800;color:${c.textDark};line-height:1.3;">
      Hi ${firstName}, your diet plan is ready! 🎉
    </h1>
    <p style="margin:0 0 24px 0;font-size:15px;line-height:1.7;color:${c.textMid};">
      Great news! Our AI engine and expert dietitians at <strong style="color:${c.green};">${BRAND.name}</strong>
      have crafted your fully personalized diet plan. It's packed with tailored meals, recipes, and tips
      designed specifically for your goals and lifestyle.
    </p>

    <!-- Status callout -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;">
      <tr>
        <td style="background:${c.greenBg};border-left:5px solid ${c.green};border-radius:10px;padding:20px 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td width="76" valign="middle">
                <div style="width:56px;height:56px;border-radius:50%;background:${c.white};text-align:center;line-height:56px;">
                  ${iconImg(BRAND.icons.heart, 40, 'Plan Ready')}
                </div>
              </td>
              <td valign="middle">
                <div style="font-size:15px;font-weight:700;color:${c.green};text-transform:uppercase;letter-spacing:0.3px;">
                  Your plan is ready to download
                </div>
                <div style="font-size:13px;line-height:1.6;color:${c.textDark};margin-top:4px;">
                  Click the button below to open or download your personalized diet chart PDF.
                  The link is permanent — you can access it anytime.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Cashback banner (conditional) -->
    ${cashbackBanner}

    <!-- Download CTA -->
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
      <tr>
        <td style="border-radius:10px;background:${c.green};">
          <a href="${pdfUrl}" target="_blank"
            style="display:inline-block;padding:16px 40px;font-size:16px;font-weight:700;letter-spacing:0.5px;color:${c.white};text-decoration:none;border-radius:10px;">
            📥 Download My Diet Plan
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 28px 0;font-size:12px;color:${c.textMid};">
      Or copy this link: <a href="${pdfUrl}" style="color:${c.green};word-break:break-all;">${pdfUrl}</a>
    </p>

    <!-- What's inside -->
    <p style="margin:0 0 14px 0;font-size:14px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:${c.green};">
      What's Inside Your Plan
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;">
      <tr>
        <td style="padding:0 8px 0 0;width:50%;vertical-align:top;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${[
              ['🍽', 'Personalized daily meals (Breakfast, Lunch, Snack, Dinner)'],
              ['📅', 'Week-by-week structured meal schedule'],
              ['🔄', 'Smart food swaps tailored to your preferences'],
            ].map(([icon, text]) => `
              <tr>
                <td style="padding:6px 0;font-size:13px;color:${c.textMid};">${icon} ${text}</td>
              </tr>
            `).join('')}
          </table>
        </td>
        <td style="padding:0 0 0 8px;width:50%;vertical-align:top;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${[
              ['💧', 'Hydration guide and daily water targets'],
              ['👨‍🍳', 'Featured Indian recipes with ingredients & steps'],
              ['📊', 'Calorie, protein, and macro breakdown per day'],
            ].map(([icon, text]) => `
              <tr>
                <td style="padding:6px 0;font-size:13px;color:${c.textMid};">${icon} ${text}</td>
              </tr>
            `).join('')}
          </table>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 4px 0;font-size:13px;line-height:1.7;color:${c.textMid};">
      Have questions about your plan? We're here to help. Reply to this email or reach us at
      <a href="tel:+919609606009" style="color:${c.green};text-decoration:none;">${BRAND.supportPhone}</a>.
    </p>
  `;

  const html = emailLayout({
    preheader: `Hi ${firstName}! Your personalized diet plan is ready. Download your diet chart PDF now and start your health journey.`,
    bodyHtml,
  });

  const text = [
    `Hi ${firstName}, your diet plan is ready!`,
    ``,
    `Your personalized diet chart has been prepared by our AI engine and expert dietitians at ${BRAND.name}.`,
    ``,
    `DOWNLOAD YOUR DIET PLAN`,
    pdfUrl,
    ``,
    cashback && cashback > 0 ? `CASHBACK: ₹${cashback.toFixed(2)} has been credited to your wallet!\n` : '',
    `WHAT'S INSIDE:`,
    `- Personalized daily meals (Breakfast, Lunch, Snack, Dinner)`,
    `- Week-by-week structured meal schedule`,
    `- Smart food swaps tailored to your preferences`,
    `- Hydration guide and daily water targets`,
    `- Featured Indian recipes with ingredients & steps`,
    `- Calorie, protein, and macro breakdown per day`,
    ``,
    `Need help? Reply to this email or call ${BRAND.supportPhone}`,
    ``,
    ...footerText,
  ].filter(Boolean).join('\n');

  return { subject, html, text };
};
