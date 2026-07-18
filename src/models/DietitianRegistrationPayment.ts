import { query, execute } from '../config/database';

export interface DietitianRegistrationPayment {
  id: number;
  email: string;
  registration_data: string; // JSON string from DB
  amount: number;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  razorpay_signature: string | null;
  status: 'pending' | 'paid' | 'failed';
  payment_verified_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export const upsertPendingRegistration = async (
  email: string,
  registrationData: object,
  fee: number,
): Promise<number> => {
  // Replace any previous pending or failed attempt for this email
  await execute("DELETE FROM dietitian_registration_payments WHERE email = ? AND status IN ('pending', 'failed')", [email]);
  const result = await execute(
    `INSERT INTO dietitian_registration_payments (email, registration_data, amount)
     VALUES (?, ?, ?)`,
    [email, JSON.stringify(registrationData), fee],
  );
  return result.insertId;
};

export const setOrderId = async (id: number, orderId: string): Promise<void> => {
  await execute('UPDATE dietitian_registration_payments SET razorpay_order_id = ? WHERE id = ?', [orderId, id]);
};

export const findByOrderId = async (orderId: string): Promise<DietitianRegistrationPayment | null> => {
  const rows = await query<DietitianRegistrationPayment>(
    'SELECT * FROM dietitian_registration_payments WHERE razorpay_order_id = ? LIMIT 1',
    [orderId],
  );
  return rows[0] ?? null;
};

export const markRegistrationPaid = async (
  id: number,
  paymentId: string,
  signature: string,
): Promise<void> => {
  await execute(
    `UPDATE dietitian_registration_payments
     SET status = 'paid', razorpay_payment_id = ?, razorpay_signature = ?, payment_verified_at = NOW()
     WHERE id = ?`,
    [paymentId, signature, id],
  );
};

export const markRegistrationFailed = async (orderId: string): Promise<void> => {
  await execute(
    `UPDATE dietitian_registration_payments SET status = 'failed' WHERE razorpay_order_id = ?`,
    [orderId],
  );
};
