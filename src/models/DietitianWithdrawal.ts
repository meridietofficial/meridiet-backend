import { query, execute, withTransaction } from '../config/database';
import { getTransferStatus } from '../services/cashfree';

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

    const newBalance = balance - params.amount;

    const [result] = await conn.execute<import('mysql2/promise').ResultSetHeader>(
      `INSERT INTO dietitian_withdrawals (dietitian_id, account_id, amount, status)
       VALUES (?, ?, ?, 'pending')`,
      [params.dietitian_id, params.account_id, params.amount],
    );

    const withdrawalId = result.insertId;

    // Record the debit in the wallet transactions log so it appears in the UI
    await conn.execute(
      `INSERT INTO dietitian_wallet_transactions
         (dietitian_id, type, wallet, source, gross_amount, commission, net_amount, balance_after, description, reference_id)
       VALUES (?, 'debit', 'earnings', 'withdrawal', ?, 0, ?, ?, ?, ?)`,
      [
        params.dietitian_id,
        params.amount,
        params.amount,
        newBalance,
        `Withdrawal request — ₹${params.amount}`,
        `wd_${withdrawalId}`,
      ],
    );

    const [rows] = await conn.execute<import('mysql2/promise').RowDataPacket[]>(
      'SELECT * FROM dietitian_withdrawals WHERE id = ? LIMIT 1',
      [withdrawalId],
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
    const [balRows] = await conn.execute<import('mysql2/promise').RowDataPacket[]>(
      'SELECT earnings_balance FROM dietitians WHERE id = ? LIMIT 1',
      [dietitianId],
    );
    const newBalance = Number(balRows[0]?.earnings_balance ?? 0);
    await conn.execute(
      `INSERT INTO dietitian_wallet_transactions
         (dietitian_id, type, wallet, source, gross_amount, commission, net_amount, balance_after, description, reference_id)
       VALUES (?, 'credit', 'earnings', 'withdrawal', ?, 0, ?, ?, ?, ?)`,
      [
        dietitianId,
        amount,
        amount,
        newBalance,
        `Withdrawal failed — ₹${amount} refunded`,
        `wd_${withdrawalId}_refund`,
      ],
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

  // For success/failed/reversed — update wallet transaction description using real data
  if (status === 'processed' || status === 'reversed' || status === 'failed') {
    const rows = await query<{ id: number; dietitian_id: number; amount: number }>(
      'SELECT id, dietitian_id, amount FROM dietitian_withdrawals WHERE cashfree_transfer_id = ? LIMIT 1',
      [cashfreeTransferId],
    );
    if (rows[0]) {
      const { id: withdrawalId, dietitian_id, amount } = rows[0];

      if (status === 'processed') {
        const desc = params.utr
          ? `Withdrawal successful — ₹${amount} sent (UTR: ${params.utr})`
          : `Withdrawal successful — ₹${amount} sent`;
        await execute(
          `UPDATE dietitian_wallet_transactions SET description = ? WHERE reference_id = ?`,
          [desc, `wd_${withdrawalId}`],
        );
      } else {
        // reversed or failed — refund balance and insert credit entry
        await execute(
          'UPDATE dietitians SET earnings_balance = earnings_balance + ? WHERE id = ?',
          [amount, dietitian_id],
        );
        const balRows = await query<{ earnings_balance: number }>(
          'SELECT earnings_balance FROM dietitians WHERE id = ? LIMIT 1',
          [dietitian_id],
        );
        const newBalance = Number(balRows[0]?.earnings_balance ?? 0);
        const label = status === 'reversed' ? 'reversed' : 'failed';
        await execute(
          `INSERT INTO dietitian_wallet_transactions
             (dietitian_id, type, wallet, source, gross_amount, commission, net_amount, balance_after, description, reference_id)
           VALUES (?, 'credit', 'earnings', 'withdrawal', ?, 0, ?, ?, ?, ?)`,
          [
            dietitian_id,
            amount,
            amount,
            newBalance,
            `Withdrawal ${label} — ₹${amount} refunded`,
            `wd_${withdrawalId}_${label}`,
          ],
        );
      }
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

// Checks all processing withdrawals for a dietitian against Cashfree and updates their status.
// Returns a summary of what changed.
export async function syncProcessingWithdrawals(dietitianId: number): Promise<{
  checked: number; updated: { id: number; status: string }[]
}> {
  const processing = await query<{ id: number; cashfree_transfer_id: string; amount: number }>(
    `SELECT id, cashfree_transfer_id, amount FROM dietitian_withdrawals
     WHERE dietitian_id = ? AND status = 'processing' AND cashfree_transfer_id IS NOT NULL`,
    [dietitianId],
  );

  const updated: { id: number; status: string }[] = [];

  for (const w of processing) {
    const { status, utr, reason } = await getTransferStatus(`WD${w.id}`);

    if (status === 'SUCCESS') {
      await execute(
        `UPDATE dietitian_withdrawals SET status = 'processed', utr = ?, processed_at = NOW() WHERE id = ?`,
        [utr ?? null, w.id],
      );
      // Update wallet transaction description to reflect success
      const desc = utr
        ? `Withdrawal successful — ₹${w.amount} sent (UTR: ${utr})`
        : `Withdrawal successful — ₹${w.amount} sent`;
      await execute(
        `UPDATE dietitian_wallet_transactions SET description = ? WHERE reference_id = ?`,
        [desc, `wd_${w.id}`],
      );
      updated.push({ id: w.id, status: 'processed' });

    } else if (status === 'FAILED' || status === 'REVERSED' || status === 'CANCELLED') {
      const finalStatus = status === 'REVERSED' ? 'reversed' : status === 'CANCELLED' ? 'cancelled' : 'failed';
      // Refund balance
      await withTransaction(async (conn) => {
        await conn.execute(
          `UPDATE dietitian_withdrawals SET status = ?, failure_reason = ?, processed_at = NOW() WHERE id = ?`,
          [finalStatus, reason ?? status, w.id],
        );
        await conn.execute(
          'UPDATE dietitians SET earnings_balance = earnings_balance + ? WHERE id = ?',
          [w.amount, dietitianId],
        );
        const [balRows] = await conn.execute<import('mysql2/promise').RowDataPacket[]>(
          'SELECT earnings_balance FROM dietitians WHERE id = ? LIMIT 1',
          [dietitianId],
        );
        const newBalance = Number(balRows[0]?.earnings_balance ?? 0);
        // Update existing debit transaction to show it was refunded
        await conn.execute(
          `UPDATE dietitian_wallet_transactions SET description = ? WHERE reference_id = ?`,
          [`Withdrawal ${finalStatus} — ₹${w.amount} refunded`, `wd_${w.id}`],
        );
        // Insert a credit entry for the refund
        await conn.execute(
          `INSERT INTO dietitian_wallet_transactions
             (dietitian_id, type, wallet, source, gross_amount, commission, net_amount, balance_after, description, reference_id)
           VALUES (?, 'credit', 'earnings', 'withdrawal', ?, 0, ?, ?, ?, ?)`,
          [dietitianId, w.amount, w.amount, newBalance, `Withdrawal ${finalStatus} — ₹${w.amount} refunded`, `wd_${w.id}_${finalStatus}`],
        );
      });
      updated.push({ id: w.id, status: finalStatus });
    }
    // PENDING / RECEIVED / UNKNOWN — still in flight, skip
  }

  return { checked: processing.length, updated };
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
