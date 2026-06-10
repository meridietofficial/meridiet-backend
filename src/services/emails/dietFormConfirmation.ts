import { BRAND } from '../../config/brand';
import { c, iconImg, stepRow, emailLayout, footerText } from './layout';

export const dietFormConfirmationEmail = (
  fullName: string,
  details: {
    goals: string[];
    dietType: string | null;
    planDuration: string;
  },
): { subject: string; html: string; text: string } => {
  const firstName = fullName.trim().split(/\s+/)[0] || 'there';
  const subject = `Your Diet Form is Received — We're Preparing Your Plan! 🥗`;

  const formatLabel = (val: string) =>
    val.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const goalsText = details.goals?.length
    ? details.goals.map(formatLabel).join(', ')
    : 'Healthy Lifestyle';

  const dietTypeText = details.dietType ? formatLabel(details.dietType) : 'N/A';

  const bodyHtml = `
    <h1 style="margin:0 0 16px 0;font-size:24px;font-weight:800;color:${c.textDark};line-height:1.3;">
      Hi ${firstName}, your form is submitted! 🥗
    </h1>
    <p style="margin:0 0 24px 0;font-size:15px;line-height:1.7;color:${c.textMid};">
      Thank you for trusting <strong style="color:${c.green};">${BRAND.name}</strong> with your health journey.
      We've successfully received your diet form and our team is already working on your personalized plan.
    </p>

    <!-- Status callout -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 30px 0;">
      <tr>
        <td style="background:${c.greenBg};border-left:5px solid ${c.green};border-radius:10px;padding:22px 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td width="76" valign="middle">
                <div style="width:56px;height:56px;border-radius:50%;background:${c.white};text-align:center;line-height:56px;">
                  ${iconImg(BRAND.icons.aiChip, 40, 'AI')}
                </div>
              </td>
              <td valign="middle">
                <div style="font-size:16px;font-weight:700;letter-spacing:0.3px;color:${c.green};text-transform:uppercase;">
                  AI + Expert Dietitians are on it!
                </div>
                <div style="font-size:14px;line-height:1.6;color:${c.textDark};margin-top:4px;">
                  Our intelligent AI engine and certified dietitian experts are crafting your
                  personalized diet chart. Expect it within <strong>24 hours</strong>.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Submitted details summary -->
    <p style="margin:0 0 14px 0;font-size:14px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:${c.green};">
      Your Submitted Details
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="margin:0 0 30px 0;border:1px solid ${c.border};border-radius:10px;overflow:hidden;">
      <tr>
        <td style="padding:14px 20px;border-bottom:1px solid ${c.border};background:${c.greenBg};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:13px;font-weight:600;color:${c.textMid};width:40%;">Name</td>
              <td style="font-size:14px;font-weight:700;color:${c.textDark};">${fullName}</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:14px 20px;border-bottom:1px solid ${c.border};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:13px;font-weight:600;color:${c.textMid};width:40%;">Goals</td>
              <td style="font-size:14px;font-weight:700;color:${c.textDark};">${goalsText}</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:14px 20px;border-bottom:1px solid ${c.border};background:${c.greenBg};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:13px;font-weight:600;color:${c.textMid};width:40%;">Diet Type</td>
              <td style="font-size:14px;font-weight:700;color:${c.textDark};">${dietTypeText}</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:14px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:13px;font-weight:600;color:${c.textMid};width:40%;">Plan Duration</td>
              <td style="font-size:14px;font-weight:700;color:${c.textDark};">${details.planDuration}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- What happens next -->
    <p style="margin:0 0 18px 0;font-size:14px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:${c.green};">
      What Happens Next
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;">
      ${stepRow(1, iconImg(BRAND.icons.mail, 26, 'Received'), 'Form Received', "We've received all your health details and goals.", true)}
      ${stepRow(2, iconImg(BRAND.icons.aiChip, 26, 'AI'), 'AI + Dietitian Analysis', 'Our AI engine analyses your data while our expert dietitians review and refine it for you.', true)}
      ${stepRow(3, iconImg(BRAND.icons.heart, 26, 'Plan'), 'Diet Plan Delivered', 'Your personalized diet chart will be ready and delivered within <strong>24 hours</strong>.', false)}
    </table>

    <!-- Note -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;">
      <tr>
        <td style="background:#FFF8F0;border-left:5px solid ${c.orange};border-radius:10px;padding:16px 20px;">
          <div style="font-size:13px;line-height:1.6;color:${c.textMid};">
            📌 <strong>Tip:</strong> Keep an eye on this email address and your WhatsApp for your diet chart delivery.
            If you have any questions in the meantime, we're just a message away.
          </div>
        </td>
      </tr>
    </table>

    <!-- CTA -->
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 12px 0;">
      <tr>
        <td style="border-radius:8px;background:${c.green};">
          <a href="${BRAND.website}" target="_blank"
            style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:${c.white};text-decoration:none;border-radius:8px;">
            Visit MeriDiet
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:16px 0 0 0;font-size:13px;line-height:1.6;color:${c.textMid};">
      Questions? Reply to this email or reach us at
      <a href="tel:+919609606009" style="color:${c.green};text-decoration:none;">${BRAND.supportPhone}</a>.
      We're here to help!
    </p>
  `;

  const html = emailLayout({
    preheader: `Hi ${firstName}, your diet form is received. Our AI + Dietitian experts are preparing your personalized plan — ready within 24 hours!`,
    bodyHtml,
  });

  const text = [
    `Hi ${firstName}, your diet form is submitted!`,
    ``,
    `Thank you for trusting ${BRAND.name}. We've received your diet form and our team is working on your personalized plan.`,
    ``,
    `AI + EXPERT DIETITIANS ARE ON IT!`,
    `Our intelligent AI engine and certified dietitian experts are crafting your personalized diet chart. Expect it within 24 hours.`,
    ``,
    `YOUR SUBMITTED DETAILS`,
    `Name         : ${fullName}`,
    `Goals        : ${goalsText}`,
    `Diet Type    : ${dietTypeText}`,
    `Plan Duration: ${details.planDuration}`,
    ``,
    `WHAT HAPPENS NEXT`,
    `1. Form Received        — We've received all your health details and goals.`,
    `2. AI + Dietitian Review — Our AI engine analyses your data while our experts refine it.`,
    `3. Diet Plan Delivered  — Your personalized diet chart will be ready within 24 hours.`,
    ``,
    `Tip: Keep an eye on this email address and your WhatsApp for your diet chart delivery.`,
    ``,
    `Visit us: ${BRAND.website}`,
    ``,
    ...footerText,
  ].join('\n');

  return { subject, html, text };
};
