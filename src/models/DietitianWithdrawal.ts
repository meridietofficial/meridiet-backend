import { query, execute, withTransaction } from '../config/database';

export type WithdrawalStatus =
  | 'pending'
  | 'processing'
  | 'processed'
  | 'failed'
  | 'reversed'
  | 'cancelled';

export interface DietitianWithdrawal {
  id: number;
  dietitian_id: number;
  account_id: number;
  amount: number;
  status: WithdrawalStatus;
  cashfree_transfer_id: string | null;
  utr: string | null;
  failure_reason: string | null;
  requested_at: Date;
  processed_at: Date | null;
}

// Creates a withdrawal record and deducts from earnings_balance atomically.
export async function createWithdrawal(params: {
  dietitian_id: number;
  account_id: number;
  amount: number;
}): Promise<DietitianWithdrawal> {
  return withTransaction(async (conn) => {
    const [dietRows] = await conn.execute<import('mysql2/promise').RowDataPacket[]>(
      'SELECT earnings_balance FROM dietitians WHERE id = ? FOR UPDATE',
      [params.dietitian_id],
    );
    if (!dietRows[0]) throw new Error('DIETITIAN_NOT_FOUND');

    const balance = Number(dietRows[0].earnings_balance);
    if (balance < params.amount) throw new Error('INSUFFICIENT_BALANCE');

    await conn.execute(
      'UPDATE dietitians SET earnings_balance = earnings_balance - ? WHERE id = ?',
      [params.amount, params.dietitian_id],
    );

    const [result] = await conn.execute<import('mysql2/promise').ResultSetHeader>(
      `INSERT INTO dietitian_withdrawals (dietitian_id, account_id, amount, status)
       VALUES (?, ?, ?, 'pending')`,
      [params.dietitian_id, params.account_id, params.amount],
    );

    const [rows] = await conn.execute<import('mysql2/promise').RowDataPacket[]>(
      'SELECT * FROM dietitian_withdrawals WHERE id = ? LIMIT 1',
      [result.insertId],
    );
    return rows[0] as DietitianWithdrawal;
  });
}

// Called after Cashfree transfer is successfully created — stores transfer ID
export async function markWithdrawalProcessing(
  withdrawalId: number,
  cashfreeTransferId: string,
): Promise<void> {
  await execute(
    `UPDATE dietitian_withdrawals
     SET status = 'processing', cashfree_transfer_id = ?
     WHERE id = ?`,
    [cashfreeTransferId, withdrawalId],
  );
}

// Called when transfer creation fails — refunds balance and marks failed
export async function failWithdrawal(
  withdrawalId: number,
  dietitianId: number,
  amount: number,
  reason: string,
): Promise<void> {
  await withTransaction(async (conn) => {
    await conn.execute(
      `UPDATE dietitian_withdrawals SET status = 'failed', failure_reason = ? WHERE id = ?`,
      [reason, withdrawalId],
    );
    await conn.execute(
      'UPDATE dietitians SET earnings_balance = earnings_balance + ? WHERE id = ?',
      [amount, dietitianId],
    );
  });
}

// Called by Cashfree webhook to update final transfer status
export async function updateWithdrawalFromWebhook(
  cashfreeTransferId: string,
  status: WithdrawalStatus,
  params: { utr?: string; failure_reason?: string },
): Promise<void> {
  await execute(
    `UPDATE dietitian_withdrawals
     SET status = ?,
         utr = COALESCE(?, utr),
         failure_reason = COALESCE(?, failure_reason),
         processed_at = CASE WHEN ? IN ('processed', 'failed', 'reversed', 'cancelled')
                             THEN NOW() ELSE processed_at END
     WHERE cashfree_transfer_id = ?`,
    [
      status,
      params.utr ?? null,
      params.failure_reason ?? null,
      status,
      cashfreeTransferId,
    ],
  );

  // If transfer reversed/failed — refund the balance
  if (status === 'reversed' || status === 'failed') {
    const rows = await query<{ dietitian_id: number; amount: number }>(
      'SELECT dietitian_id, amount FROM dietitian_withdrawals WHERE cashfree_transfer_id = ? LIMIT 1',
      [cashfreeTransferId],
    );
    if (rows[0]) {
      await execute(
        'UPDATE dietitians SET earnings_balance = earnings_balance + ? WHERE id = ?',
        [rows[0].amount, rows[0].dietitian_id],
      );
    }
  }
}

export async function getWithdrawalsByDietitian(
  dietitianId: number,
  page = 1,
  limit = 10,
): Promise<{ withdrawals: DietitianWithdrawal[]; total: number }> {
  const offset = (page - 1) * limit;

  const [totals] = await query<{ total: number }>(
    'SELECT COUNT(*) AS total FROM dietitian_withdrawals WHERE dietitian_id = ?',
    [dietitianId],
  );

  const withdrawals = await query<DietitianWithdrawal>(
    `SELECT dw.*, dpa.type AS account_type, dpa.upi_id, dpa.bank_name,
            dpa.ifsc_code, dpa.bank_logo_url
     FROM dietitian_withdrawals dw
     JOIN dietitian_payment_accounts dpa ON dpa.id = dw.account_id
     WHERE dw.dietitian_id = ?
     ORDER BY dw.requested_at DESC
     LIMIT ? OFFSET ?`,
    [dietitianId, limit, offset],
  );

  return { withdrawals, total: totals.total };
}

// Saves Cashfree beneficiary ID on the payment account row to avoid re-creating on future withdrawals
export async function cacheCashfreeBeneId(
  accountId: number,
  beneId: string,
): Promise<void> {
  await execute(
    `UPDATE dietitian_payment_accounts SET cashfree_bene_id = ? WHERE id = ?`,
    [beneId, accountId],
  );
}
