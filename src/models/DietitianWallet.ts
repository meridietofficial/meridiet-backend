import mysql from 'mysql2/promise';
import { query, withTransaction } from '../config/database';
import { getSetting } from './Setting';

export interface DietitianWalletTransaction {
  id: number;
  dietitian_id: number;
  type: 'credit' | 'debit';
  source: 'appointment_completion' | 'withdrawal' | 'admin_credit' | 'admin_debit';
  gross_amount: number;
  commission: number;
  net_amount: number;
  balance_after: number;
  description: string | null;
  reference_id: string | null;
  appointment_id: number | null;
  created_at: Date;
}

export type CreditResult =
  | { credited: true;  transaction: DietitianWalletTransaction }
  | { credited: false; reason: 'already_credited' | 'zero_amount' | 'dietitian_not_found' };

/**
 * Credits a dietitian's earnings_balance when an appointment is completed.
 *
 * Guarantees:
 * - Atomic: balance update + transaction log happen in a single DB transaction.
 *   If either fails, both are rolled back — balance can never be wrong.
 * - Idempotent: the UNIQUE constraint on (appointment_id, source) at the DB
 *   level prevents double-crediting even under concurrent requests.
 *   The pre-check is an optimisation to avoid hitting the constraint on the
 *   normal path; the constraint is the real guard.
 */
export const creditDietitianForAppointment = async (
  dietitianId: number,
  appointmentId: number,
  grossAmount: number,
): Promise<CreditResult> => {
  if (grossAmount <= 0) {
    return { credited: false, reason: 'zero_amount' };
  }

  const commPctRaw = await getSetting('platform_commission_pct');
  const commPct    = commPctRaw !== null ? Number(commPctRaw) : 20;
  const commission = Math.round(grossAmount * (commPct / 100));
  const netAmount  = grossAmount - commission;

  try {
    const transaction = await withTransaction(async (conn) => {
      // Lock the dietitian row so concurrent requests queue up here
      const [dietitianRows] = await conn.execute<mysql.RowDataPacket[]>(
        'SELECT id, earnings_balance FROM dietitians WHERE id = ? FOR UPDATE',
        [dietitianId],
      );
      if (!dietitianRows[0]) throw new Error('DIETITIAN_NOT_FOUND');

      // Increment balance
      await conn.execute(
        'UPDATE dietitians SET earnings_balance = earnings_balance + ? WHERE id = ?',
        [netAmount, dietitianId],
      );

      const newBalance = Number(dietitianRows[0].earnings_balance) + netAmount;

      // Log the transaction — UNIQUE constraint on (appointment_id, source) is
      // the true idempotency guard; raises ER_DUP_ENTRY if already credited
      const [insertResult] = await conn.execute<mysql.ResultSetHeader>(
        `INSERT INTO dietitian_wallet_transactions
           (dietitian_id, type, source, gross_amount, commission, net_amount, balance_after, description, appointment_id)
         VALUES (?, 'credit', 'appointment_completion', ?, ?, ?, ?, ?, ?)`,
        [
          dietitianId,
          grossAmount,
          commission,
          netAmount,
          newBalance,
          `Appointment #${appointmentId} completed`,
          appointmentId,
        ],
      );

      const [txRows] = await conn.execute<mysql.RowDataPacket[]>(
        'SELECT * FROM dietitian_wallet_transactions WHERE id = ? LIMIT 1',
        [insertResult.insertId],
      );
      return txRows[0] as DietitianWalletTransaction;
    });

    return { credited: true, transaction };
  } catch (err: unknown) {
    // Duplicate entry = already credited (race condition hit the DB constraint)
    if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
      return { credited: false, reason: 'already_credited' };
    }
    if (err instanceof Error && err.message === 'DIETITIAN_NOT_FOUND') {
      return { credited: false, reason: 'dietitian_not_found' };
    }
    throw err; // re-throw unexpected errors
  }
};

export const getDietitianEarningsBalance = async (dietitianId: number): Promise<number> => {
  const rows = await query<{ earnings_balance: number }>(
    'SELECT earnings_balance FROM dietitians WHERE id = ? LIMIT 1',
    [dietitianId],
  );
  return Number(rows[0]?.earnings_balance ?? 0);
};

export const getDietitianWalletTransactions = async (
  dietitianId: number,
  page = 1,
  limit = 10,
) => {
  const offset = (page - 1) * limit;
  const [rows, countRows] = await Promise.all([
    query<DietitianWalletTransaction>(
      `SELECT * FROM dietitian_wallet_transactions
       WHERE dietitian_id = ?
       ORDER BY created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      [dietitianId],
    ),
    query<{ total: number }>(
      'SELECT COUNT(*) AS total FROM dietitian_wallet_transactions WHERE dietitian_id = ?',
      [dietitianId],
    ),
  ]);
  return { transactions: rows, total: Number(countRows[0]?.total ?? 0) };
};
