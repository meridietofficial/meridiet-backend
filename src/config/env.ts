import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  API_VERSION: z.string().default('v1'),
  API_PREFIX: z.string().default('/api'),
  // Public base URL of this server — used to build meeting join links
  APP_BASE_URL: z.string().default('http://localhost:5000'),
  // Public URL of the frontend web app — used to build user-facing deep links (e.g. appointment page)
  APP_FRONTEND_URL: z.string().default('https://meridiet.com'),

  // MySQL Database
  DB_HOST: z.string().min(1, 'DB_HOST is required'),
  DB_PORT: z.coerce.number().default(3306),
  DB_USERNAME: z.string().min(1, 'DB_USERNAME is required'),
  DB_PASSWORD: z.string().min(1, 'DB_PASSWORD is required'),
  DB_NAME: z.string().min(1, 'DB_NAME is required'),
  DB_SYNC: z.coerce.boolean().default(false),
  DB_LOGGING: z.coerce.boolean().default(false),

  // JWT
  JWT_SECRET: z.string().min(20, 'JWT_SECRET must be at least 20 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(20, 'JWT_REFRESH_SECRET must be at least 20 characters'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // CORS
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900_000),
  RATE_LIMIT_MAX: z.coerce.number().default(500),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().default(20),

  // Razorpay — payment gateway
  RAZORPAY_KEY_ID: z.string().min(1, 'RAZORPAY_KEY_ID is required'),
  RAZORPAY_KEY_SECRET: z.string().min(1, 'RAZORPAY_KEY_SECRET is required'),

  // Razorpay X — payouts (separate product, separate keys)
  RAZORPAY_X_KEY_ID: z.string().default(''),
  RAZORPAY_X_KEY_SECRET: z.string().default(''),
  RAZORPAY_X_WEBHOOK_SECRET: z.string().default(''),
  RAZORPAY_X_ACCOUNT_NUMBER: z.string().default(''),

  // Plans
  PLAN_1_WEEK_LABEL: z.string().default('1 Week'),
  PLAN_1_WEEK_AMOUNT: z.coerce.number().default(199),
  PLAN_1_MONTH_LABEL: z.string().default('1 Month'),
  PLAN_1_MONTH_AMOUNT: z.coerce.number().default(499),
  PLAN_3_MONTHS_LABEL: z.string().default('3 Months'),
  PLAN_3_MONTHS_AMOUNT: z.coerce.number().default(999),

  // AWS S3
  AWS_REGION: z.string().min(1, 'AWS_REGION is required'),
  AWS_ACCESS_KEY_ID: z.string().min(1, 'AWS_ACCESS_KEY_ID is required'),
  AWS_SECRET_ACCESS_KEY: z.string().min(1, 'AWS_SECRET_ACCESS_KEY is required'),
  AWS_S3_BUCKET: z.string().min(1, 'AWS_S3_BUCKET is required'),
  AWS_S3_BASE_URL: z.string().url('AWS_S3_BASE_URL must be a valid URL'),

  // AWS Key Reveal
  AWS_REVEAL_SECRET: z.string().min(8, 'AWS_REVEAL_SECRET must be at least 8 characters'),

  // OpenAI
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),

  // SMTP / Email (BigRock mailbox: support@meridiet.com)
  SMTP_HOST: z.string().min(1, 'SMTP_HOST is required'),
  SMTP_PORT: z.coerce.number().default(465),
  SMTP_USER: z.string().email('SMTP_USER must be a valid email'),
  SMTP_PASS: z.string().min(1, 'SMTP_PASS is required'),
  MAIL_FROM_NAME: z.string().default('Meri Diet'),

  // MSG91 (mobile OTP)
  MSG91_AUTH_KEY: z.string().min(1, 'MSG91_AUTH_KEY is required'),
  MSG91_OTP_TEMPLATE_ID: z.string().min(1, 'MSG91_OTP_TEMPLATE_ID is required'),
  MSG91_OTP_EXPIRY_MINUTES: z.coerce.number().default(5),
  MSG91_OTP_LENGTH: z.coerce.number().default(4),

  // MSG91 WhatsApp
  MSG91_WHATSAPP_INTEGRATED_NUMBER: z.string().default(''),
  MSG91_WHATSAPP_CONFIRMATION_TEMPLATE: z.string().default('meri_diet_form_received'),
  MSG91_WHATSAPP_DIET_PLAN_TEMPLATE: z.string().default('meri_diet_plan_ready'),
  MSG91_WHATSAPP_APPOINTMENT_TEMPLATE: z.string().default('consultation_booked'),
  MSG91_WHATSAPP_DIETITIAN_APPOINTMENT_TEMPLATE: z.string().default('dietitian_new_booking'),
  MSG91_WHATSAPP_CONFIRMED_TEMPLATE: z.string().default('consultation_confirmed'),
  MSG91_WHATSAPP_FOLLOW_UP_TEMPLATE: z.string().default('follow_up_booked'),
  MSG91_WHATSAPP_REMINDER_1H_TEMPLATE: z.string().default('consultation_reminder_1h'),
  MSG91_WHATSAPP_REMINDER_10MIN_TEMPLATE: z.string().default('consultation_reminder_10min'),
  MSG91_WHATSAPP_DIETITIAN_REMINDER_15MIN_TEMPLATE: z.string().default('dietitian_reminder_15min'),
  MSG91_WHATSAPP_RESCHEDULE_TEMPLATE: z.string().default('consultation_rescheduled'),
  MSG91_WHATSAPP_DIETITIAN_RESCHEDULE_TEMPLATE: z.string().default('dietitian_appointment_rescheduled'),
  MSG91_WHATSAPP_COMPLETED_TEMPLATE: z.string().default('consultation_completed'),
  MSG91_WHATSAPP_PAYMENT_REMINDER_1_TEMPLATE: z.string().default('md_payment_reminder_1'),
  MSG91_WHATSAPP_PAYMENT_REMINDER_2_TEMPLATE: z.string().default('md_payment_reminder_2'),
  MSG91_WHATSAPP_PAYMENT_REMINDER_3_TEMPLATE: z.string().default('md_payment_reminder_3'),

  // Encryption — AES-256-GCM key for sensitive fields (account numbers)
  // Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ACCOUNT_ENCRYPTION_KEY: z
    .string()
    .length(64, 'ACCOUNT_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)'),

  // Admin notification email — receives course enquiry and enrollment alerts
  ADMIN_EMAIL: z.string().email().default('meridietofficial@gmail.com'),

  // GST Invoice — company registration details
  COMPANY_GSTIN: z.string().default('27AABCM1234A1Z5'),
  COMPANY_PAN:   z.string().default('AABCM1234A'),

  // Razorpay GST tax ID — copy from Razorpay Dashboard → Settings → Tax
  RAZORPAY_GST_TAX_ID: z.string().default(''),

  // Agora — 1-to-1 video calls with cloud recording
  AGORA_APP_ID: z.string().default(''),
  AGORA_APP_CERTIFICATE: z.string().default(''),
  AGORA_CUSTOMER_ID: z.string().default(''),       // RESTful API key
  AGORA_CUSTOMER_SECRET: z.string().default(''),   // RESTful API secret
  AGORA_WEBHOOK_SECRET: z.string().default(''),    // optional: verifies Agora webhook calls

});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
