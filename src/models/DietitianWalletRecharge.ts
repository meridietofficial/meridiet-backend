import { query } from '../config/database';

export interface DietitianWalletRecharge {
  id: number;
  dietitian_id: number;
  amount: number;
  order_id: string;
  payment_id: string | null;
  signature: string | null;
  status: 'pending' | 'paid' | 'failed';
  created_at: Date;
  updated_at: Date;
}

export const createRechargeOrder = async (
  dietitianId: number,
  amount: number,
  orderId: string,
): Promise<number> => {
  const result = await query<{ insertId: number }>(
    `INSERT INTO dietitian_wallet_recharges (dietitian_id, amount, order_id, status)
     VALUES (?, ?, ?, 'pending')`,
    [dietitianId, amount, orderId],
  );
  return (result as unknown as { insertId: number }).insertId;
};

export const findRechargeByOrderId = async (orderId: string): Promise<DietitianWalletRecharge | null> => {
  const rows = await query<DietitianWalletRecharge>(
    'SELECT * FROM dietitian_wallet_recharges WHERE order_id = ? LIMIT 1',
    [orderId],
  );
  return rows[0] ?? null;
};

export const markRechargePaid = async (
  orderId: string,
  paymentId: string,
  signature: string,
): Promise<void> => {
  await query(
    `UPDATE dietitian_wallet_recharges
     SET status = 'paid', payment_id = ?, signature = ?
     WHERE order_id = ?`,
    [paymentId, signature, orderId],
  );
};

export const markRechargeFailed = async (orderId: string): Promise<void> => {
  await query(
    `UPDATE dietitian_wallet_recharges SET status = 'failed' WHERE order_id = ? AND status = 'pending'`,
    [orderId],
  );
};
