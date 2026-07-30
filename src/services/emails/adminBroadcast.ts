import { BRAND } from '../../config/brand';
import { c, emailLayout, footerText } from './layout';

export const adminBroadcastEmail = (opts: {
  recipientName: string;
  subject: string;
  message: string;
}): { subject: string; html: string; text: string } => {
  const firstName = opts.recipientName.trim().split(/\s+/)[0] || 'there';

  // Escape HTML entities then convert line breaks to HTML
  const escaped = opts.message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Double newlines become paragraphs; single newlines become <br>
  const htmlMessage = escaped
    .split(/\n{2,}/)
    .map(
      (para) =>
        `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;color:${c.textMid};">${para.replace(/\n/g, '<br />')}</p>`,
    )
    .join('');

  const bodyHtml = `
    <h1 style="margin:0 0 20px 0;font-size:22px;font-weight:800;color:${c.textDark};line-height:1.3;">Hi ${firstName},</h1>
    ${htmlMessage}
    <p style="margin:24px 0 0 0;font-size:14px;color:#9AA0A6;font-style:italic;">
      — The ${BRAND.name} Team
    </p>
  `;

  const html = emailLayout({
    preheader: opts.message.slice(0, 120).replace(/\n/g, ' '),
    bodyHtml,
  });

  const text = [
    `Hi ${firstName},`,
    ``,
    opts.message,
    ``,
    `— The ${BRAND.name} Team`,
    ``,
    ...footerText,
  ].join('\n');

  return { subject: opts.subject, html, text };
};
