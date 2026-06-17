import { query, execute, withTransaction } from '../config/database';
import { encrypt, decrypt, maskAccountNumber } from '../utils/encrypt';

const GITHUB_LOGO_BASE =
  'https://raw.githubusercontent.com/praveenpuglia/indian-banks/main/assets/logos';

const GITHUB_LOGO_BANKS = new Set([
  'AIRP', 'AUBL', 'BARB', 'BDBL', 'BKID', 'CBIN', 'CIUB', 'CNRB', 'CSBK', 'DCBL',
  'DLXB', 'ESMF', 'FDRL', 'FINO', 'HDFC', 'IBKL', 'ICIC', 'IDFB', 'IDIB', 'INDB',
  'IOBA', 'JAKA', 'JIOP', 'KARB', 'KKBK', 'KVBL', 'MAHB', 'NTBL', 'PSIB', 'PUNB',
  'PYTM', 'RATN', 'SBIN', 'SCBL', 'SIBL', 'TMBL', 'UBIN', 'UCBA', 'UJVN', 'UTIB',
  'YESB',
]);

function resolveBankLogoUrl(ifscCode: string, bankName: string): string {
  const prefix = ifscCode.slice(0, 4).toUpperCase();
  if (GITHUB_LOGO_BANKS.has(prefix)) {
    return `${GITHUB_LOGO_BASE}/${prefix.toLowerCase()}/logo.png`;
  }
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(bankName)}&background=1E3A5F&color=fff&size=128&bold=true&format=png`;
}

export interface DietitianPaymentAccount {
  id: number;
  dietitian_id: number;
  type: 'upi' | 'bank';
  is_primary: boolean;
  upi_id: string | null;
  account_holder: string | null;
  account_number: string | null;        // masked (****6789) — never the raw value
  ifsc_code: string | null;
  bank_name: string | null;
  bank_logo_url: string | null;
  razorpay_contact_id: string | null;
  razorpay_fund_account_id: string | null;
  created_at: Date;
  updated_at: Date;
}

type RawAccount = Omit<DietitianPaymentAccount, 'is_primary'> & { is_primary: number | bigint };

const normalize = (r: RawAccount): DietitianPaymentAccount => {
  let maskedNumber: string | null = null;
  if (r.account_number) {
    try {
      const plain = decrypt(r.account_number);
      maskedNumber = maskAccountNumber(plain);
    } catch {
      // If somehow stored unencrypted (legacy), mask directly
      maskedNumber = maskAccountNumber(r.account_number);
    }
  }
  return {
    ...r,
    is_primary: Boolean(r.is_primary),
    account_number: maskedNumber,
  };
};

export const getAccountsByDietitianId = async (
  dietitianId: number,
): Promise<DietitianPaymentAccount[]> => {
  const rows = await query<RawAccount>(
    `SELECT * FROM dietitian_payment_accounts
     WHERE dietitian_id = ?
     ORDER BY is_primary DESC, created_at ASC`,
    [dietitianId],
  );
  return rows.map(normalize);
};

export const getAccountById = async (
  id: number,
  dietitianId: number,
): Promise<DietitianPaymentAccount | null> => {
  const rows = await query<RawAccount>(
    `SELECT * FROM dietitian_payment_accounts
     WHERE id = ? AND dietitian_id = ? LIMIT 1`,
    [id, dietitianId],
  );
  return rows[0] ? normalize(rows[0]) : null;
};

export const getPrimaryAccount = async (
  dietitianId: number,
): Promise<DietitianPaymentAccount | null> => {
  const rows = await query<RawAccount>(
    `SELECT * FROM dietitian_payment_accounts
     WHERE dietitian_id = ? AND is_primary = 1 LIMIT 1`,
    [dietitianId],
  );
  return rows[0] ? normalize(rows[0]) : null;
};

export interface CreateUpiAccountData {
  dietitian_id: number;
  upi_id: string;
  set_primary?: boolean;
}

export interface CreateBankAccountData {
  dietitian_id: number;
  account_holder: string;
  account_number: string;
  ifsc_code: string;
  bank_name: string;
  set_primary?: boolean;
}

export const addUpiAccount = async (
  data: CreateUpiAccountData,
): Promise<DietitianPaymentAccount> => {
  // If first account, auto-set as primary
  const existing = await query<{ id: number }>(
    'SELECT id FROM dietitian_payment_accounts WHERE dietitian_id = ? LIMIT 1',
    [data.dietitian_id],
  );
  const isPrimary = data.set_primary || existing.length === 0 ? 1 : 0;

  return withTransaction(async (conn) => {
    if (isPrimary) {
      await conn.execute(
        'UPDATE dietitian_payment_accounts SET is_primary = 0 WHERE dietitian_id = ?',
        [data.dietitian_id],
      );
    }

    const [result] = await conn.execute<import('mysql2/promise').ResultSetHeader>(
      `INSERT INTO dietitian_payment_accounts (dietitian_id, type, is_primary, upi_id)
       VALUES (?, 'upi', ?, ?)`,
      [data.dietitian_id, isPrimary, data.upi_id],
    );

    const [rows] = await conn.execute<import('mysql2/promise').RowDataPacket[]>(
      'SELECT * FROM dietitian_payment_accounts WHERE id = ? LIMIT 1',
      [result.insertId],
    );
    return normalize(rows[0] as RawAccount);
  });
};

export const addBankAccount = async (
  data: CreateBankAccountData,
): Promise<DietitianPaymentAccount> => {
  const existing = await query<{ id: number }>(
    'SELECT id FROM dietitian_payment_accounts WHERE dietitian_id = ? LIMIT 1',
    [data.dietitian_id],
  );
  const isPrimary = data.set_primary || existing.length === 0 ? 1 : 0;

  return withTransaction(async (conn) => {
    if (isPrimary) {
      await conn.execute(
        'UPDATE dietitian_payment_accounts SET is_primary = 0 WHERE dietitian_id = ?',
        [data.dietitian_id],
      );
    }

    const logoUrl         = resolveBankLogoUrl(data.ifsc_code, data.bank_name);
    const encryptedAccNo  = encrypt(data.account_number);

    const [result] = await conn.execute<import('mysql2/promise').ResultSetHeader>(
      `INSERT INTO dietitian_payment_accounts
         (dietitian_id, type, is_primary, account_holder, account_number, ifsc_code, bank_name, bank_logo_url)
       VALUES (?, 'bank', ?, ?, ?, ?, ?, ?)`,
      [
        data.dietitian_id,
        isPrimary,
        data.account_holder,
        encryptedAccNo,
        data.ifsc_code,
        data.bank_name,
        logoUrl,
      ],
    );

    const [rows] = await conn.execute<import('mysql2/promise').RowDataPacket[]>(
      'SELECT * FROM dietitian_payment_accounts WHERE id = ? LIMIT 1',
      [result.insertId],
    );
    return normalize(rows[0] as RawAccount);
  });
};

// Sets the given account as primary and unsets all others atomically
export const setPrimaryAccount = async (
  id: number,
  dietitianId: number,
): Promise<DietitianPaymentAccount | null> => {
  return withTransaction(async (conn) => {
    // Verify account belongs to this dietitian
    const [rows] = await conn.execute<import('mysql2/promise').RowDataPacket[]>(
      'SELECT id FROM dietitian_payment_accounts WHERE id = ? AND dietitian_id = ? LIMIT 1',
      [id, dietitianId],
    );
    if (!rows[0]) return null;

    // Unset all, then set the target
    await conn.execute(
      'UPDATE dietitian_payment_accounts SET is_primary = 0 WHERE dietitian_id = ?',
      [dietitianId],
    );
    await conn.execute(
      'UPDATE dietitian_payment_accounts SET is_primary = 1 WHERE id = ?',
      [id],
    );

    const updated = await query<RawAccount>(
      'SELECT * FROM dietitian_payment_accounts WHERE id = ? LIMIT 1',
      [id],
    );
    return updated[0] ? normalize(updated[0]) : null;
  });
};

// Cannot delete the primary account if it's the only one — must set another primary first
export const deleteAccount = async (
  id: number,
  dietitianId: number,
): Promise<{ deleted: boolean; reason?: string }> => {
  const account = await getAccountById(id, dietitianId);
  if (!account) return { deleted: false, reason: 'not_found' };

  if (account.is_primary) {
    const allAccounts = await query<{ id: number }>(
      'SELECT id FROM dietitian_payment_accounts WHERE dietitian_id = ?',
      [dietitianId],
    );
    if (allAccounts.length > 1) {
      return { deleted: false, reason: 'primary_account' };
    }
  }

  await execute(
    'DELETE FROM dietitian_payment_accounts WHERE id = ? AND dietitian_id = ?',
    [id, dietitianId],
  );
  return { deleted: true };
};
