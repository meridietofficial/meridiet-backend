import mysql from 'mysql2/promise';
import { query, withTransaction } from '../config/database';
import { getSetting } from './Setting';

export interface DietitianWalletTransaction {
  id: number;
  dietitian_id: number;
  type: 'credit' | 'debit';
  wallet: 'earnings' | 'plan';
  source: 'appointment_completion' | 'withdrawal' | 'admin_credit' | 'admin_debit' | 'no_show_compensation' | 'diet_plan_generation' | 'no_show_penalty' | 'recharge' | 'admin_plan_credit';
  gross_amount: number;
  commission: number;
  net_amount: number;
  balance_after: number;
  description: string | null;
  reference_id: string | null;
  appointment_id: number | null;
  approved_by: number | null;
  created_at: Date;
}

const runCreditTransaction = async (params: {
  dietitianId: number;
  appointmentId: number;
  grossAmount: number;
  commission: number;
  netAmount: number;
  source: 'appointment_completion' | 'no_show_compensation';
  description: string;
  approvedBy?: number;
}): Promise<CreditResult> => {
  try {
    const transaction = await withTransaction(async (conn) => {
      const [dietitianRows] = await conn.execute<mysql.RowDataPacket[]>(
        'SELECT id, earnings_balance, wallet_suspended, user_id FROM dietitians WHERE id = ? FOR UPDATE',
        [params.dietitianId],
      );
      if (!dietitianRows[0]) throw new Error('DIETITIAN_NOT_FOUND');

      await conn.execute(
        'UPDATE dietitians SET earnings_balance = earnings_balance + ? WHERE id = ?',
        [params.netAmount, params.dietitianId],
      );

      const newBalance = Number(dietitianRows[0].earnings_balance) + params.netAmount;

      // Auto-restore: if dietitian was suspended due to negative wallet and balance is now >= 0, lift suspension
      if (dietitianRows[0].wallet_suspended && newBalance >= 0) {
        await conn.execute(
          'UPDATE dietitians SET wallet_suspended = 0 WHERE id = ?',
          [params.dietitianId],
        );
        await conn.execute(
          'UPDATE users SET is_active = 1 WHERE id = ?',
          [dietitianRows[0].user_id],
        );
      }

      // UNIQUE constraint on (appointment_id, source) prevents double-crediting
      const [insertResult] = await conn.execute<mysql.ResultSetHeader>(
        `INSERT INTO dietitian_wallet_transactions
           (dietitian_id, type, source, gross_amount, commission, net_amount, balance_after, description, appointment_id, approved_by)
         VALUES (?, 'credit', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          params.dietitianId,
          params.source,
          params.grossAmount,
          params.commission,
          params.netAmount,
          newBalance,
          params.description,
          params.appointmentId,
          params.approvedBy ?? null,
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
    if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
      return { credited: false, reason: 'already_credited' };
    }
    if (err instanceof Error && err.message === 'DIETITIAN_NOT_FOUND') {
      return { credited: false, reason: 'dietitian_not_found' };
    }
    throw err;
  }
};

export interface AppointmentCreditDetails {
  grossAmount: number;
  commission: number;
  netAmount: number;
  commPct: number;
}

export type CreditResult =
  | { credited: true;  transaction: DietitianWalletTransaction }
  | { credited: false; reason: 'already_credited' | 'zero_amount' | 'dietitian_not_found' };

export const creditDietitianForAppointment = async (
  dietitianId: number,
  appointmentId: number,
  grossAmount: number,
  approvedBy?: number,
): Promise<CreditResult & { details?: AppointmentCreditDetails }> => {
  if (grossAmount <= 0) return { credited: false, reason: 'zero_amount' };

  const commPctRaw = await getSetting('platform_commission_pct');
  const commPct    = commPctRaw !== null ? Number(commPctRaw) : 20;
  const commission = Math.round(grossAmount * (commPct / 100));
  const netAmount  = grossAmount - commission;

  const result = await runCreditTransaction({
    dietitianId,
    appointmentId,
    grossAmount,
    commission,
    netAmount,
    source: 'appointment_completion',
    description: `Appointment #${appointmentId} completed`,
    approvedBy,
  });

  if (result.credited) {
    return { ...result, details: { grossAmount, commission, netAmount, commPct } };
  }
  return result;
};

export const creditDietitianForNoShow = async (
  dietitianId: number,
  appointmentId: number,
  grossAmount: number,
  approvedBy?: number,
): Promise<CreditResult & { details?: AppointmentCreditDetails }> => {
  if (grossAmount <= 0) return { credited: false, reason: 'zero_amount' };

  const commPctRaw = await getSetting('platform_commission_pct');
  const commPct    = commPctRaw !== null ? Number(commPctRaw) : 20;
  const commission = Math.round(grossAmount * (commPct / 100));
  const netAfterCommission = grossAmount - commission;
  const netAmount  = Math.round(netAfterCommission * 0.5); // 50% for no-show

  const result = await runCreditTransaction({
    dietitianId,
    appointmentId,
    grossAmount,
    commission,
    netAmount,
    source: 'no_show_compensation',
    description: `Appointment #${appointmentId} — patient no-show (50% of net)`,
    approvedBy,
  });

  if (result.credited) {
    return { ...result, details: { grossAmount, commission, netAmount, commPct } };
  }
  return result;
};

export const getDietitianEarningsBalance = async (dietitianId: number): Promise<number> => {
  const rows = await query<{ earnings_balance: number }>(
    'SELECT earnings_balance FROM dietitians WHERE id = ? LIMIT 1',
    [dietitianId],
  );
  return Number(rows[0]?.earnings_balance ?? 0);
};

export const getDietitianPlanCreditsBalance = async (dietitianId: number): Promise<number> => {
  const rows = await query<{ plan_credits: number }>(
    'SELECT plan_credits FROM dietitians WHERE id = ? LIMIT 1',
    [dietitianId],
  );
  return Number(rows[0]?.plan_credits ?? 0);
};

export const getDietitianWalletTransactions = async (
  dietitianId: number,
  page = 1,
  limit = 10,
  wallet?: 'earnings' | 'plan',
) => {
  const offset     = (page - 1) * limit;
  const walletCond = wallet ? `AND wallet = '${wallet}'` : '';
  const [rows, countRows] = await Promise.all([
    query<DietitianWalletTransaction>(
      `SELECT * FROM dietitian_wallet_transactions
       WHERE dietitian_id = ? ${walletCond}
       ORDER BY created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      [dietitianId],
    ),
    query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM dietitian_wallet_transactions
       WHERE dietitian_id = ? ${walletCond}`,
      [dietitianId],
    ),
  ]);
  return { transactions: rows, total: Number(countRows[0]?.total ?? 0) };
};

export type AdminWalletCreditResult =
  | { credited: true; new_balance: number }
  | { credited: false; reason: 'dietitian_not_found' };

export const adminCreditEarningsWallet = async (
  dietitianId: number,
  amount: number,
  adminUserId: number,
  description?: string,
): Promise<AdminWalletCreditResult> => {
  const refId = `admin_credit_${dietitianId}_${Date.now()}`;

  try {
    const newBalance = await withTransaction(async (conn) => {
      const [rows] = await conn.execute<mysql.RowDataPacket[]>(
        'SELECT id, earnings_balance, wallet_suspended, user_id FROM dietitians WHERE id = ? FOR UPDATE',
        [dietitianId],
      );
      if (!rows[0]) throw new Error('DIETITIAN_NOT_FOUND');

      await conn.execute(
        'UPDATE dietitians SET earnings_balance = earnings_balance + ? WHERE id = ?',
        [amount, dietitianId],
      );

      const newBal = Number(rows[0].earnings_balance) + amount;

      // Auto-restore suspension if balance goes non-negative
      if (rows[0].wallet_suspended && newBal >= 0) {
        await conn.execute('UPDATE dietitians SET wallet_suspended = 0 WHERE id = ?', [dietitianId]);
        await conn.execute('UPDATE users SET is_active = 1 WHERE id = ?', [rows[0].user_id]);
      }

      await conn.execute(
        `INSERT INTO dietitian_wallet_transactions
           (dietitian_id, type, wallet, source, gross_amount, commission, net_amount,
            balance_after, description, reference_id, appointment_id, approved_by)
         VALUES (?, 'credit', 'earnings', 'admin_credit', ?, 0, ?, ?, ?, ?, NULL, ?)`,
        [dietitianId, amount, amount, newBal,
          description ?? `Admin earnings credit — ₹${amount}`, refId, adminUserId],
      );

      return newBal;
    });

    return { credited: true, new_balance: newBalance };
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'DIETITIAN_NOT_FOUND') {
      return { credited: false, reason: 'dietitian_not_found' };
    }
    throw err;
  }
};

export type AdminPlanCreditResult =
  | { credited: true; new_balance: number }
  | { credited: false; reason: 'dietitian_not_found' };

export const adminCreditPlanCredits = async (
  dietitianId: number,
  amount: number,
  adminUserId: number,
  description?: string,
): Promise<AdminPlanCreditResult> => {
  const refId = `admin_plan_credit_${dietitianId}_${Date.now()}`;

  try {
    const newBalance = await withTransaction(async (conn) => {
      const [rows] = await conn.execute<mysql.RowDataPacket[]>(
        'SELECT id, plan_credits FROM dietitians WHERE id = ? FOR UPDATE',
        [dietitianId],
      );
      if (!rows[0]) throw new Error('DIETITIAN_NOT_FOUND');

      await conn.execute(
        'UPDATE dietitians SET plan_credits = plan_credits + ? WHERE id = ?',
        [amount, dietitianId],
      );

      const newBal = Number(rows[0].plan_credits) + amount;

      await conn.execute(
        `INSERT INTO dietitian_wallet_transactions
           (dietitian_id, type, wallet, source, gross_amount, commission, net_amount,
            balance_after, description, reference_id, appointment_id, approved_by)
         VALUES (?, 'credit', 'plan', 'admin_plan_credit', ?, 0, ?, ?, ?, ?, NULL, ?)`,
        [
          dietitianId, amount, amount, newBal,
          description ?? `Admin plan credit — ₹${amount}`,
          refId, null, adminUserId,
        ],
      );

      return newBal;
    });

    return { credited: true, new_balance: newBalance };
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'DIETITIAN_NOT_FOUND') {
      return { credited: false, reason: 'dietitian_not_found' };
    }
    throw err;
  }
};

export const PLAN_COST_1_WEEK  = 50;
export const PLAN_COST_1_MONTH = 100;
export const NO_SHOW_PENALTY   = 100; // ₹100 deducted from dietitian wallet on no-show

export type DebitResult =
  | { debited: true;  transaction: DietitianWalletTransaction; deducted_from: 'plan_credits' | 'earnings' }
  | { debited: false; reason: 'insufficient_balance' | 'already_charged' | 'dietitian_not_found' };

// Deducts the plan generation cost from plan_credits first.
// If plan_credits are insufficient, falls back to earnings_balance.
// If both are insufficient, returns insufficient_balance.
export const debitDietitianForDietPlanGeneration = async (
  dietitianId: number,
  planId: number,
  cost: number,
): Promise<DebitResult> => {
  const refId = `dp_${planId}`;

  // Idempotency — if already charged for this plan, skip
  const existing = await query<{ id: number }>(
    `SELECT id FROM dietitian_wallet_transactions
     WHERE dietitian_id = ? AND source = 'diet_plan_generation' AND reference_id = ? LIMIT 1`,
    [dietitianId, refId],
  );
  if (existing.length > 0) return { debited: false, reason: 'already_charged' };

  try {
    const { transaction, deductedFrom } = await withTransaction(async (conn) => {
      const [rows] = await conn.execute<mysql.RowDataPacket[]>(
        'SELECT id, plan_credits, earnings_balance FROM dietitians WHERE id = ? FOR UPDATE',
        [dietitianId],
      );
      if (!rows[0]) throw new Error('DIETITIAN_NOT_FOUND');

      const planCredits     = Number(rows[0].plan_credits);
      const earningsBalance = Number(rows[0].earnings_balance);

      let walletColumn: 'plan_credits' | 'earnings_balance';
      let walletTag:    'plan' | 'earnings';
      let newBalance:   number;

      if (planCredits >= cost) {
        walletColumn = 'plan_credits';
        walletTag    = 'plan';
        newBalance   = planCredits - cost;
      } else if (earningsBalance >= cost) {
        walletColumn = 'earnings_balance';
        walletTag    = 'earnings';
        newBalance   = earningsBalance - cost;
      } else {
        throw new Error('INSUFFICIENT_BALANCE');
      }

      await conn.execute(
        `UPDATE dietitians SET ${walletColumn} = ${walletColumn} - ? WHERE id = ?`,
        [cost, dietitianId],
      );

      const [insertResult] = await conn.execute<mysql.ResultSetHeader>(
        `INSERT INTO dietitian_wallet_transactions
           (dietitian_id, type, wallet, source, gross_amount, commission, net_amount,
            balance_after, description, reference_id, appointment_id, approved_by)
         VALUES (?, 'debit', ?, 'diet_plan_generation', ?, 0, ?, ?, ?, ?, NULL, NULL)`,
        [dietitianId, walletTag, cost, cost, newBalance,
          `Manual diet plan generation — Plan #${planId}`, refId],
      );

      const [txRows] = await conn.execute<mysql.RowDataPacket[]>(
        'SELECT * FROM dietitian_wallet_transactions WHERE id = ? LIMIT 1',
        [insertResult.insertId],
      );
      return {
        transaction:  txRows[0] as DietitianWalletTransaction,
        deductedFrom: (walletColumn === 'plan_credits' ? 'plan_credits' : 'earnings') as 'plan_credits' | 'earnings',
      };
    });

    return { debited: true, transaction, deducted_from: deductedFrom };
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'INSUFFICIENT_BALANCE') {
      return { debited: false, reason: 'insufficient_balance' };
    }
    if (err instanceof Error && err.message === 'DIETITIAN_NOT_FOUND') {
      return { debited: false, reason: 'dietitian_not_found' };
    }
    throw err;
  }
};

export type PenaltyDebitResult =
  | { debited: true; transaction: DietitianWalletTransaction; new_balance: number; suspended: boolean }
  | { debited: false; reason: 'already_charged' | 'dietitian_not_found' };

// Deducts ₹100 no-show penalty from dietitian wallet.
// Unlike diet plan debit, this ALLOWS the balance to go negative.
// If balance drops below 0: sets dietitian offline + inactive + wallet_suspended = 1.
// When a future credit brings balance back >= 0, runCreditTransaction auto-lifts the suspension.
export const debitDietitianForNoShowPenalty = async (
  dietitianId: number,
  appointmentId: number,
  adminUserId: number,
  missedType: 'dietitian_no_show' | 'both_no_show',
): Promise<PenaltyDebitResult> => {
  const refId = `nsp_${appointmentId}`;

  const existing = await query<{ id: number }>(
    `SELECT id FROM dietitian_wallet_transactions
     WHERE dietitian_id = ? AND source = 'no_show_penalty' AND reference_id = ? LIMIT 1`,
    [dietitianId, refId],
  );
  if (existing.length > 0) return { debited: false, reason: 'already_charged' };

  const reason = missedType === 'both_no_show'
    ? `Appointment #${appointmentId} — both parties no-show penalty`
    : `Appointment #${appointmentId} — dietitian no-show penalty`;

  try {
    const { transaction, newBalance, suspended } = await withTransaction(async (conn) => {
      const [rows] = await conn.execute<mysql.RowDataPacket[]>(
        'SELECT id, user_id, earnings_balance FROM dietitians WHERE id = ? FOR UPDATE',
        [dietitianId],
      );
      if (!rows[0]) throw new Error('DIETITIAN_NOT_FOUND');

      const balance    = Number(rows[0].earnings_balance);
      const newBal     = balance - NO_SHOW_PENALTY;
      const willSuspend = newBal < 0;

      await conn.execute(
        'UPDATE dietitians SET earnings_balance = earnings_balance - ? WHERE id = ?',
        [NO_SHOW_PENALTY, dietitianId],
      );

      if (willSuspend) {
        await conn.execute(
          'UPDATE dietitians SET wallet_suspended = 1, is_online = 0 WHERE id = ?',
          [dietitianId],
        );
        await conn.execute(
          'UPDATE users SET is_active = 0 WHERE id = ?',
          [rows[0].user_id],
        );
      }

      const [insertResult] = await conn.execute<mysql.ResultSetHeader>(
        `INSERT INTO dietitian_wallet_transactions
           (dietitian_id, type, source, gross_amount, commission, net_amount,
            balance_after, description, reference_id, appointment_id, approved_by)
         VALUES (?, 'debit', 'no_show_penalty', ?, 0, ?, ?, ?, ?, ?, ?)`,
        [dietitianId, NO_SHOW_PENALTY, NO_SHOW_PENALTY, newBal, reason, refId, appointmentId, adminUserId],
      );

      const [txRows] = await conn.execute<mysql.RowDataPacket[]>(
        'SELECT * FROM dietitian_wallet_transactions WHERE id = ? LIMIT 1',
        [insertResult.insertId],
      );
      return { transaction: txRows[0] as DietitianWalletTransaction, newBalance: newBal, suspended: willSuspend };
    });

    return { debited: true, transaction, new_balance: newBalance, suspended };
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'DIETITIAN_NOT_FOUND') {
      return { debited: false, reason: 'dietitian_not_found' };
    }
    throw err;
  }
};

export type RechargeResult =
  | { credited: true; transaction: DietitianWalletTransaction; new_balance: number }
  | { credited: false; reason: 'dietitian_not_found' | 'already_credited' };

export const creditDietitianWalletRecharge = async (
  dietitianId: number,
  amount: number,
  rechargeId: number,
): Promise<RechargeResult> => {
  const numAmount = Number(amount); // DECIMAL columns come back as strings from mysql2
  const refId = `recharge_${rechargeId}`;

  const existing = await query<{ id: number }>(
    `SELECT id FROM dietitian_wallet_transactions
     WHERE dietitian_id = ? AND source = 'recharge' AND reference_id = ? LIMIT 1`,
    [dietitianId, refId],
  );
  if (existing.length > 0) return { credited: false, reason: 'already_credited' };

  try {
    const { transaction, newBalance } = await withTransaction(async (conn) => {
      const [rows] = await conn.execute<mysql.RowDataPacket[]>(
        'SELECT id, plan_credits FROM dietitians WHERE id = ? FOR UPDATE',
        [dietitianId],
      );
      if (!rows[0]) throw new Error('DIETITIAN_NOT_FOUND');

      await conn.execute(
        'UPDATE dietitians SET plan_credits = plan_credits + ? WHERE id = ?',
        [numAmount, dietitianId],
      );

      const newBal = Number(rows[0].plan_credits) + numAmount;

      const [insertResult] = await conn.execute<mysql.ResultSetHeader>(
        `INSERT INTO dietitian_wallet_transactions
           (dietitian_id, type, wallet, source, gross_amount, commission, net_amount,
            balance_after, description, reference_id, appointment_id, approved_by)
         VALUES (?, 'credit', 'plan', 'recharge', ?, 0, ?, ?, ?, ?, NULL, NULL)`,
        [dietitianId, numAmount, numAmount, newBal, `Plan credits recharge — ₹${numAmount}`, refId],
      );

      const [txRows] = await conn.execute<mysql.RowDataPacket[]>(
        'SELECT * FROM dietitian_wallet_transactions WHERE id = ? LIMIT 1',
        [insertResult.insertId],
      );
      return { transaction: txRows[0] as DietitianWalletTransaction, newBalance: newBal };
    });

    return { credited: true, transaction, new_balance: newBalance };
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'DIETITIAN_NOT_FOUND') {
      return { credited: false, reason: 'dietitian_not_found' };
    }
    throw err;
  }
};
