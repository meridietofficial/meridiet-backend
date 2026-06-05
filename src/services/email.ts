import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { mailer, MAIL_FROM } from '../config/mailer';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
}

/**
 * Send an email from support@meridiet.com via the configured SMTP transport.
 * Returns nodemailer's send result (contains messageId, accepted, rejected).
 */
export const sendEmail = async (
  options: SendEmailOptions,
): Promise<SMTPTransport.SentMessageInfo> => {
  return mailer.sendMail({
    from: MAIL_FROM,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
    cc: options.cc,
    bcc: options.bcc,
    replyTo: options.replyTo,
  });
};

/**
 * Verify the SMTP connection & credentials without sending a real email.
 * Useful to call once on server startup or from a health check.
 */
export const verifyEmailConnection = async (): Promise<boolean> => {
  await mailer.verify();
  return true;
};
