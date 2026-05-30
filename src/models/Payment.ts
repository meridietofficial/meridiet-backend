import { query, execute } from '../config/database';

export interface Payment {
  id: number;
  razorpay_order_id: string;
  razorpay_payment_id: string | null;
  razorpay_signature: string | null;
  plan: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed';
  user_id: number | null;
  diet_form_id: number | null;
  created_at: Date;
  updated_at: Date;
}

export const createPayment = async (data: Pick<Payment, 'razorpay_order_id' | 'plan' | 'amount' | 'currency' | 'user_id'>) => {
  const result = await execute(
    `INSERT INTO payments (razorpay_order_id, plan, amount, currency, user_id) VALUES (?, ?, ?, ?, ?)`,
    [data.razorpay_order_id, data.plan, data.amount, data.currency, data.user_id],
  );
  return findPaymentById(result.insertId);
};

export const findPaymentById = async (id: number) => {
  const rows = await query<Payment>('SELECT * FROM payments WHERE id = ? LIMIT 1', [id]);
  return rows[0] ?? null;
};

export const findPaymentByOrderId = async (razorpay_order_id: string) => {
  const rows = await query<Payment>('SELECT * FROM payments WHERE razorpay_order_id = ? LIMIT 1', [razorpay_order_id]);
  return rows[0] ?? null;
};

export const markPaymentPaid = async (
  razorpay_order_id: string,
  razorpay_payment_id: string,
  razorpay_signature: string,
  diet_form_id: number,
) => {
  await execute(
    `UPDATE payments SET status = 'paid', razorpay_payment_id = ?, razorpay_signature = ?, diet_form_id = ? WHERE razorpay_order_id = ?`,
    [razorpay_payment_id, razorpay_signature, diet_form_id, razorpay_order_id],
  );
  return findPaymentByOrderId(razorpay_order_id);
};

export const markPaymentFailed = async (razorpay_order_id: string) => {
  await execute(
    `UPDATE payments SET status = 'failed' WHERE razorpay_order_id = ?`,
    [razorpay_order_id],
  );
};
