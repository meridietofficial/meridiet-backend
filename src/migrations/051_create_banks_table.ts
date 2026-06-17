// Bank names sourced from the Razorpay IFSC npm package (1510 banks)
// Logo URLs use Clearbit for major banks — null for smaller/co-op banks

// Known logo domains for major banks — uses Google favicon service
// Format: https://www.google.com/s2/favicons?domain={domain}&sz=128
const LOGO_MAP: Record<string, string> = {
  HDFC: 'hdfcbank.com',
  SBIN: 'sbi.co.in',
  ICIC: 'icicibank.com',
  UTIB: 'axisbank.com',
  KKBK: 'kotak.com',
  PUNB: 'pnbindia.in',
  BARB: 'bankofbaroda.in',
  CNRB: 'canarabank.in',
  UBIN: 'unionbankofindia.co.in',
  INDB: 'indusind.com',
  YESB: 'yesbank.in',
  IDFB: 'idfcfirstbank.com',
  FDRL: 'federalbank.co.in',
  RATN: 'rblbank.com',
  BKID: 'bankofindia.co.in',
  IDIB: 'indianbank.in',
  CBIN: 'centralbankofindia.co.in',
  KARB: 'karnatakabank.com',
  SIBL: 'southindianbank.com',
  UCBA: 'ucobank.com',
  MAHB: 'bankofmaharashtra.in',
  PSIB: 'psbindia.com',
  IOBA: 'iob.in',
  BDBL: 'bandhanbank.com',
  AUBL: 'aubank.in',
  JSFB: 'janabank.in',
  UJVN: 'ujjivansfb.in',
  ESFB: 'equitasbank.com',
  ESAF: 'esafbank.com',
  AIRP: 'airtel.in',
  PYTM: 'paytm.com',
  IPPB: 'ippbonline.com',
  FINO: 'finobank.com',
  NSPB: 'nsdlbank.com',
  IDFC: 'idfcfirstbank.com',
  LAVB: 'laxmivilas.com',
  DLXB: 'dhanlaxmibank.com',
  DCBL: 'dcbbank.com',
  SRCB: 'saraswatbank.com',
  PMCB: 'pmcbank.co.in',
  COSB: 'cosb.in',
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const banknames: Record<string, string> = require('ifsc/src/banknames.json');

function buildInsertRows(): string {
  const entries = Object.entries(banknames);
  const rows = entries.map(([prefix, name], i) => {
    const domain  = LOGO_MAP[prefix] ?? null;
    const logoVal = domain ? `'https://www.google.com/s2/favicons?domain=${domain}&sz=128'` : 'NULL';
    const safeName = name.replace(/'/g, "''"); // escape single quotes
    return `('${safeName}', '${prefix}', ${logoVal}, ${i + 1})`;
  });

  // Add "Other" at the end
  rows.push(`('Other', NULL, NULL, 9999)`);

  return rows.join(',\n    ');
}

export const up = `
  CREATE TABLE IF NOT EXISTS banks (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(150) NOT NULL,
    ifsc_prefix VARCHAR(10)  NULL,
    logo_url    VARCHAR(255) NULL,
    sort_order  INT          NOT NULL DEFAULT 0,
    is_active   TINYINT(1)   NOT NULL DEFAULT 1,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_ifsc_prefix (ifsc_prefix)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

  INSERT INTO banks (name, ifsc_prefix, logo_url, sort_order) VALUES
    ${buildInsertRows()};
`;

export const down = `
  DROP TABLE IF EXISTS banks;
`;
