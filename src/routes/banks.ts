import { Router } from 'express';
import { query } from '../config/database';
import { successResponse, errorResponse } from '../utils/response';

export const banksRouter = Router();

// 41 major Indian banks that have real logos in praveenpuglia/indian-banks
// Keys are IFSC prefixes (uppercase). Logo URL: BASE/{prefix_lower}/logo.png
const GITHUB_LOGO_BASE =
  'https://raw.githubusercontent.com/praveenpuglia/indian-banks/main/assets/logos';

const GITHUB_LOGO_BANKS = new Set([
  'AIRP', 'AUBL', 'BARB', 'BDBL', 'BKID', 'CBIN', 'CIUB', 'CNRB', 'CSBK', 'DCBL',
  'DLXB', 'ESMF', 'FDRL', 'FINO', 'HDFC', 'IBKL', 'ICIC', 'IDFB', 'IDIB', 'INDB',
  'IOBA', 'JAKA', 'JIOP', 'KARB', 'KKBK', 'KVBL', 'MAHB', 'NTBL', 'PSIB', 'PUNB',
  'PYTM', 'RATN', 'SBIN', 'SCBL', 'SIBL', 'TMBL', 'UBIN', 'UCBA', 'UJVN', 'UTIB',
  'YESB',
]);

// Colors for generated initials avatars (smaller/co-op banks)
const AVATAR_COLORS = [
  '1E3A5F', '2C5F8A', '0D6E6E', '1B5E20', '4A148C',
  '880E4F', 'BF360C', '37474F', '4E342E', '1A237E',
];

function buildAvatarUrl(name: string, index: number): string {
  const bg = AVATAR_COLORS[index % AVATAR_COLORS.length];
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${bg}&color=fff&size=128&bold=true&format=png`;
}

function resolveLogoUrl(ifscPrefix: string | null, name: string, index: number): string {
  if (ifscPrefix && GITHUB_LOGO_BANKS.has(ifscPrefix)) {
    return `${GITHUB_LOGO_BASE}/${ifscPrefix.toLowerCase()}/logo.png`;
  }
  return buildAvatarUrl(name, index);
}

// GET /api/v1/banks?search=hdfc
// Public — no auth required
banksRouter.get('/', async (req, res) => {
  try {
    const search = req.query.search ? String(req.query.search).trim() : null;

    const rows = await query<{
      id: number;
      name: string;
      ifsc_prefix: string | null;
      sort_order: number;
    }>(
      `SELECT id, name, ifsc_prefix, sort_order
       FROM banks
       WHERE is_active = 1
         ${search ? 'AND name LIKE ?' : ''}
       ORDER BY sort_order ASC, name ASC`,
      search ? [`%${search}%`] : [],
    );

    const banks = rows.map((row, i) => ({
      id: row.id,
      name: row.name,
      ifsc_prefix: row.ifsc_prefix,
      logo_url: resolveLogoUrl(row.ifsc_prefix, row.name, i),
    }));

    return successResponse(res, 200, 'Banks fetched', { banks });
  } catch (err) {
    console.error('getBanks error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
});
