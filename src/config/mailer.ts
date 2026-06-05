import nodemailer from 'nodemailer';
import { env } from './env';

// SMTP transport for the support@meridiet.com mailbox (BigRock).
// secure=true for port 465 (SSL), false for 587 (STARTTLS).
export const mailer = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

// The "From" header shown to recipients, e.g. "Meri Diet" <support@meridiet.com>
export const MAIL_FROM = `"${env.MAIL_FROM_NAME}" <${env.SMTP_USER}>`;
