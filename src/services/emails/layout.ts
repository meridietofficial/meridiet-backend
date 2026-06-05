import { BRAND } from '../../config/brand';

export const c = BRAND.colors;

// Lighter tint of the brand green used for icon circles / soft panels.
export const ICON_BG = '#E9F2E4';

// Render a hosted icon image at a given pixel size.
export const iconImg = (src: string, size: number, alt = ''): string =>
  `<img src="${src}" alt="${alt}" width="${size}" height="${size}" style="display:inline-block;border:0;outline:none;width:${size}px;height:${size}px;vertical-align:middle;" />`;

// Logo image when BRAND_LOGO_URL is set, otherwise a styled text wordmark so the
// email never renders a broken image.
export const renderLogo = (width = 180): string => {
  if (BRAND.logoUrl) {
    return `<img src="${BRAND.logoUrl}" alt="${BRAND.name}" width="${width}" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;height:auto;max-width:${width}px;" />`;
  }
  return `
    <div style="font-size:30px;font-weight:800;color:${c.greenDark};letter-spacing:0.5px;line-height:1;">${BRAND.name}</div>
    <div style="font-size:12px;color:${c.textMid};margin-top:4px;letter-spacing:1px;">${BRAND.tagline}</div>
  `;
};

// One row of a vertical timeline: numbered badge + icon circle + copy.
export const stepRow = (num: number, icon: string, title: string, body: string, withDivider: boolean): string => `
  <tr>
    <td width="44" valign="top" style="padding:0;">
      <div style="width:28px;height:28px;border-radius:50%;background:${c.green};color:${c.white};font-size:14px;font-weight:700;text-align:center;line-height:28px;">${num}</div>
    </td>
    <td width="64" valign="top" style="padding:0;">
      <div style="width:48px;height:48px;border-radius:50%;background:${ICON_BG};text-align:center;line-height:48px;">${icon}</div>
    </td>
    <td valign="top" style="padding:2px 0 0 0;">
      <div style="font-size:15px;font-weight:700;letter-spacing:0.3px;color:${c.textDark};text-transform:uppercase;">${title}</div>
      <div style="font-size:14px;line-height:1.5;color:${c.textMid};margin-top:3px;">${body}</div>
    </td>
  </tr>
  ${withDivider ? `<tr><td></td><td colspan="2" style="padding:14px 0;"><div style="border-top:1px solid ${c.border};"></div></td></tr>` : ''}
`;

// One feature in the footer strip: icon + two-line label.
const footerFeature = (iconSrc: string, line1: string, line2: string): string => `
  <table role="presentation" cellpadding="0" cellspacing="0" align="center">
    <tr>
      <td valign="middle" style="padding-right:9px;">${iconImg(iconSrc, 30, line1)}</td>
      <td valign="middle" style="font-size:12px;font-weight:600;line-height:1.35;color:${c.greenDark};">${line1}<br />${line2}</td>
    </tr>
  </table>
`;

// Shared header band (logo + brand promise lines).
const header = `
  <tr>
    <td align="center" style="background:${c.greenBg};padding:34px 32px 28px 32px;border-bottom:3px solid ${c.green};">
      ${renderLogo()}
      <div style="margin-top:20px;font-size:18px;font-weight:700;color:${c.green};line-height:1.4;">India's First AI-Powered Platform Blending<br />Intelligent Technology with Expert Dietitians.</div>
      <div style="margin-top:8px;font-size:13px;color:${c.textMid};line-height:1.5;">Smarter, personalized nutrition — thoughtfully crafted for complete well-being.</div>
    </td>
  </tr>
`;

// Shared footer (feature strip + legal/contact line).
const footer = `
  <tr>
    <td style="background:${c.greenBg};padding:22px 28px;border-top:1px solid ${c.border};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td valign="middle" style="padding-right:16px;border-right:1px solid #CFE0C6;">${renderLogo(120)}</td>
          <td valign="middle" align="center" style="padding:0 8px;">${footerFeature(BRAND.icons.aiChip, 'AI-Powered', 'Nutrition')}</td>
          <td valign="middle" align="center" style="padding:0 8px;">${footerFeature(BRAND.icons.dietitian, 'Dietitian', 'Expertise')}</td>
          <td valign="middle" align="center" style="padding:0 8px;">${footerFeature(BRAND.icons.heart, 'Personalized', 'Healthcare')}</td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:18px 40px 28px 40px;">
      <p style="margin:0;font-size:12px;line-height:1.7;color:#9AA0A6;text-align:center;">
        Need help? Call / WhatsApp <a href="tel:+919609606009" style="color:${c.green};text-decoration:none;">${BRAND.supportPhone}</a> &nbsp;·&nbsp; <a href="mailto:${BRAND.supportEmail}" style="color:${c.green};text-decoration:none;">${BRAND.supportEmail}</a><br />
        &copy; ${new Date().getFullYear()} ${BRAND.name}. ${BRAND.tagline}.
      </p>
    </td>
  </tr>
`;

/**
 * Wrap a body section in the shared MeriDiet email shell (header + footer).
 * `preheader` is the hidden inbox-preview snippet; `bodyHtml` is the unique
 * middle content for each email type.
 */
export const emailLayout = ({ preheader, bodyHtml }: { preheader: string; bodyHtml: string }): string => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
</head>
<body style="margin:0;padding:0;background:${c.bgMain};font-family:'Poppins',Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${c.textDark};">
  <span style="display:none;font-size:1px;color:${c.bgMain};max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${c.bgMain};padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:${c.white};border-radius:16px;overflow:hidden;border:1px solid ${c.border};">
          ${header}
          <tr><td style="padding:36px 40px 8px 40px;">${bodyHtml}</td></tr>
          ${footer}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

// Shared plain-text footer lines.
export const footerText: string[] = [
  `Need help? Call / WhatsApp ${BRAND.supportPhone} · ${BRAND.supportEmail}`,
  `© ${new Date().getFullYear()} ${BRAND.name}. ${BRAND.tagline}.`,
];
