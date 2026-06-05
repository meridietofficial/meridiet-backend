// Central brand constants used in transactional emails and other outward-facing
// content. Colours mirror the MeriDiet website theme (see :root CSS variables).
export const BRAND = {
  name: 'MeriDiet',
  tagline: 'Way to healthy life',
  website: 'https://www.meridiet.com',

  // Where a verified dietitian logs in. Override with DASHBOARD_URL if needed.
  dashboardUrl: process.env.DASHBOARD_URL ?? 'https://www.meridiet.com/for-dietitians',

  // Frontend page that shows the new-password / confirm-password form. The reset
  // token is appended as ?token=... Override with RESET_PASSWORD_URL if needed.
  resetPasswordUrl: process.env.RESET_PASSWORD_URL ?? 'https://www.meridiet.com/reset-password',

  // Hosted logo shown in email headers. Override with BRAND_LOGO_URL if needed.
  // When empty, templates fall back to a styled text wordmark.
  logoUrl:
    process.env.BRAND_LOGO_URL ??
    'https://meridiet.s3.ap-south-1.amazonaws.com/dietitians/profile-photos/1780637969441-6z2k74jp677.png',

  // Contact details shown in email footers.
  supportEmail: 'support@meridiet.com',
  supportPhone: '+91 960 960 6009',

  // Hosted email icons (green line-art PNGs on S3).
  icons: {
    clock: 'https://meridiet.s3.ap-south-1.amazonaws.com/email-assets/clock.png',
    mail: 'https://meridiet.s3.ap-south-1.amazonaws.com/email-assets/mail.png',
    search: 'https://meridiet.s3.ap-south-1.amazonaws.com/email-assets/search.png',
    person: 'https://meridiet.s3.ap-south-1.amazonaws.com/email-assets/person.png',
    aiChip: 'https://meridiet.s3.ap-south-1.amazonaws.com/email-assets/ai-chip.png',
    dietitian: 'https://meridiet.s3.ap-south-1.amazonaws.com/email-assets/dietitian.png',
    heart: 'https://meridiet.s3.ap-south-1.amazonaws.com/email-assets/heart.png',
  },

  // Theme palette (hex) from the website CSS.
  colors: {
    green: '#1E8E3E',
    greenDark: '#166C31',
    greenBg: '#EEF4E8',
    orange: '#f4842c',
    textDark: '#111111',
    textMid: '#5F6368',
    border: '#E5E7EB',
    bgMain: '#F8F8F4',
    white: '#ffffff',
  },
} as const;
