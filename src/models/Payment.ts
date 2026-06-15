import { query, execute } from '../config/database';

export interface Payment {
  id: number;
  razorpay_order_id: string;
  razorpay_payment_id: string | null;
  razorpay_signature: string | null;
  plan: string;
  amount: number;
  months_total: number;
  months_generated: number;
  per_month_amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed';
  user_id: number | null;
  diet_form_id: number | null;
  created_at: Date;
  updated_at: Date;
}

export const createPayment = async (data: Pick<Payment, 'razorpay_order_id' | 'plan' | 'amount' | 'currency' | 'user_id' | 'months_total' | 'per_month_amount'> & { diet_form_id?: number | null }) => {
  const result = await execute(
    `INSERT INTO payments (razorpay_order_id, plan, amount, months_total, per_month_amount, currency, user_id, diet_form_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.razorpay_order_id, data.plan, data.amount, data.months_total, data.per_month_amount, data.currency, data.user_id, data.diet_form_id ?? null],
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

export const findPaidPaymentByDietFormId = async (diet_form_id: number) => {
  const rows = await query<Payment>(
    `SELECT * FROM payments WHERE diet_form_id = ? AND status = 'paid' LIMIT 1`,
    [diet_form_id],
  );
  return rows[0] ?? null;
};

// Find the most recent 3-month subscription that still has months remaining
export const findActiveSubscriptionByUserId = async (user_id: number) => {
  const rows = await query<Payment>(
    `SELECT * FROM payments
     WHERE user_id = ? AND plan = '3_months' AND status = 'paid' AND months_generated < months_total
     ORDER BY created_at DESC LIMIT 1`,
    [user_id],
  );
  return rows[0] ?? null;
};

export const incrementMonthsGenerated = async (payment_id: number) => {
  await execute(
    'UPDATE payments SET months_generated = months_generated + 1 WHERE id = ?',
    [payment_id],
  );
};
