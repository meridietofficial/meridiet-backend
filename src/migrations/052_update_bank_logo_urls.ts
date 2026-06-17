// Clearbit logo API was shut down (acquired by HubSpot).
// Switching to Google's favicon service — free, reliable, no rate limits.
// Format: https://www.google.com/s2/favicons?domain={domain}&sz=128

const LOGO_UPDATES: { ifsc_prefix: string; domain: string }[] = [
  { ifsc_prefix: 'HDFC', domain: 'hdfcbank.com' },
  { ifsc_prefix: 'SBIN', domain: 'sbi.co.in' },
  { ifsc_prefix: 'ICIC', domain: 'icicibank.com' },
  { ifsc_prefix: 'UTIB', domain: 'axisbank.com' },
  { ifsc_prefix: 'KKBK', domain: 'kotak.com' },
  { ifsc_prefix: 'PUNB', domain: 'pnbindia.in' },
  { ifsc_prefix: 'BARB', domain: 'bankofbaroda.in' },
  { ifsc_prefix: 'CNRB', domain: 'canarabank.in' },
  { ifsc_prefix: 'UBIN', domain: 'unionbankofindia.co.in' },
  { ifsc_prefix: 'INDB', domain: 'indusind.com' },
  { ifsc_prefix: 'YESB', domain: 'yesbank.in' },
  { ifsc_prefix: 'IDFB', domain: 'idfcfirstbank.com' },
  { ifsc_prefix: 'FDRL', domain: 'federalbank.co.in' },
  { ifsc_prefix: 'RATN', domain: 'rblbank.com' },
  { ifsc_prefix: 'BKID', domain: 'bankofindia.co.in' },
  { ifsc_prefix: 'IDIB', domain: 'indianbank.in' },
  { ifsc_prefix: 'CBIN', domain: 'centralbankofindia.co.in' },
  { ifsc_prefix: 'KARB', domain: 'karnatakabank.com' },
  { ifsc_prefix: 'SIBL', domain: 'southindianbank.com' },
  { ifsc_prefix: 'UCBA', domain: 'ucobank.com' },
  { ifsc_prefix: 'MAHB', domain: 'bankofmaharashtra.in' },
  { ifsc_prefix: 'PSIB', domain: 'psbindia.com' },
  { ifsc_prefix: 'IOBA', domain: 'iob.in' },
  { ifsc_prefix: 'BDBL', domain: 'bandhanbank.com' },
  { ifsc_prefix: 'AUBL', domain: 'aubank.in' },
  { ifsc_prefix: 'JSFB', domain: 'janabank.in' },
  { ifsc_prefix: 'UJVN', domain: 'ujjivansfb.in' },
  { ifsc_prefix: 'ESFB', domain: 'equitasbank.com' },
  { ifsc_prefix: 'ESAF', domain: 'esafbank.com' },
  { ifsc_prefix: 'AIRP', domain: 'airtel.in' },
  { ifsc_prefix: 'PYTM', domain: 'paytm.com' },
  { ifsc_prefix: 'IPPB', domain: 'ippbonline.com' },
  { ifsc_prefix: 'FINO', domain: 'finobank.com' },
  { ifsc_prefix: 'NSPB', domain: 'nsdlbank.com' },
  { ifsc_prefix: 'IDFC', domain: 'idfcfirstbank.com' },
  { ifsc_prefix: 'DCBL', domain: 'dcbbank.com' },
  { ifsc_prefix: 'SRCB', domain: 'saraswatbank.com' },
];

const updateStatements = LOGO_UPDATES.map(({ ifsc_prefix, domain }) =>
  `UPDATE banks SET logo_url = 'https://www.google.com/s2/favicons?domain=${domain}&sz=128' WHERE ifsc_prefix = '${ifsc_prefix}';`,
).join('\n  ');

export const up = `
  -- Clear old Clearbit URLs first
  UPDATE banks SET logo_url = NULL WHERE logo_url LIKE '%clearbit%';

  -- Set new Google favicon URLs for major banks
  ${updateStatements}
`;

export const down = `
  UPDATE banks SET logo_url = NULL WHERE logo_url LIKE '%google.com/s2/favicons%';
`;
