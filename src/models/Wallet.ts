import { query, execute } from '../config/database';

export type WalletTransactionType = 'credit' | 'debit';
export type WalletTransactionSource = 'recharge' | 'admin_credit' | 'admin_debit' | 'reward' | 'purchase' | 'subscription';

export interface WalletTransaction {
  id: number;
  user_id: number;
  type: WalletTransactionType;
  source: WalletTransactionSource;
  amount: number;
  balance_after: number;
  description: string | null;
  reference_id: string | null;
  created_at: Date;
}

export interface CreditWalletData {
  user_id: number;
  source: WalletTransactionSource;
  amount: number;
  description?: string | null;
  reference_id?: string | null;
}

export interface DebitWalletData {
  user_id: number;
  source: WalletTransactionSource;
  amount: number;
  description?: string | null;
  reference_id?: string | null;
}

// Credit wallet — increments balance and logs the transaction atomically
export const creditWallet = async (data: CreditWalletData): Promise<WalletTransaction> => {
  await execute(
    'UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?',
    [data.amount, data.user_id],
  );

  const balanceRows = await query<{ wallet_balance: number }>(
    'SELECT wallet_balance FROM users WHERE id = ? LIMIT 1',
    [data.user_id],
  );
  const balanceAfter = balanceRows[0]?.wallet_balance ?? 0;

  const result = await execute(
    `INSERT INTO wallet_transactions (user_id, type, source, amount, balance_after, description, reference_id)
     VALUES (?, 'credit', ?, ?, ?, ?, ?)`,
    [data.user_id, data.source, data.amount, balanceAfter, data.description ?? null, data.reference_id ?? null],
  );

  const rows = await query<WalletTransaction>(
    'SELECT * FROM wallet_transactions WHERE id = ? LIMIT 1',
    [result.insertId],
  );
  return rows[0];
};

// Debit wallet — decrements balance and logs the transaction atomically
export const debitWallet = async (data: DebitWalletData): Promise<WalletTransaction> => {
  const balanceRows = await query<{ wallet_balance: number }>(
    'SELECT wallet_balance FROM users WHERE id = ? LIMIT 1',
    [data.user_id],
  );
  const currentBalance = Number(balanceRows[0]?.wallet_balance ?? 0);

  if (currentBalance < data.amount) {
    throw new Error('Insufficient wallet balance');
  }

  await execute(
    'UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?',
    [data.amount, data.user_id],
  );

  const balanceAfter = currentBalance - data.amount;

  const result = await execute(
    `INSERT INTO wallet_transactions (user_id, type, source, amount, balance_after, description, reference_id)
     VALUES (?, 'debit', ?, ?, ?, ?, ?)`,
    [data.user_id, data.source, data.amount, balanceAfter, data.description ?? null, data.reference_id ?? null],
  );

  const rows = await query<WalletTransaction>(
    'SELECT * FROM wallet_transactions WHERE id = ? LIMIT 1',
    [result.insertId],
  );
  return rows[0];
};

// Get paginated transaction history for a user
export const getWalletTransactions = async (user_id: number, page: number, limit: number) => {
  const safeLimit  = Math.floor(limit);
  const safeOffset = Math.floor((page - 1) * limit);
  const rows = await query<WalletTransaction>(
    `SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`,
    [user_id],
  );
  const countRows = await query<{ total: number }>(
    'SELECT COUNT(*) AS total FROM wallet_transactions WHERE user_id = ?',
    [user_id],
  );
  return { rows, total: countRows[0]?.total ?? 0 };
};
