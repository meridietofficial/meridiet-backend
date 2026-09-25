import { query, execute } from '../config/database';

export interface CourseEnrollment {
  id: number;
  name: string;
  email: string;
  phone: string;
  payment_plan: 'full' | 'emi';
  emi_installments_paid: number;
  coupon_id: number | null;
  coupon_code: string | null;
  original_fee: number | null;
  discount_applied: number;
  amount_paid: number | null;
  course_fee: number;
  payment_status: 'pending' | 'emi_partial' | 'paid' | 'failed';
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  razorpay_signature: string | null;
  payment_verified_at: Date | null;
  payment_failed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateCourseEnrollmentData {
  name: string;
  email: string;
  phone: string;
  payment_plan?: 'full' | 'emi';
}

export const createCourseEnrollment = async (data: CreateCourseEnrollmentData): Promise<CourseEnrollment | null> => {
  const result = await execute(
    `INSERT INTO course_enrollments (name, email, phone, payment_plan)
     VALUES (?, ?, ?, ?)`,
    [data.name, data.email, data.phone, data.payment_plan ?? 'full'],
  );
  const rows = await query<CourseEnrollment>('SELECT * FROM course_enrollments WHERE id = ? LIMIT 1', [result.insertId]);
  return rows[0] ?? null;
};

export const getCourseEnrollmentById = async (id: number): Promise<CourseEnrollment | null> => {
  const rows = await query<CourseEnrollment>('SELECT * FROM course_enrollments WHERE id = ? LIMIT 1', [id]);
  return rows[0] ?? null;
};

export const updateCourseEnrollmentPayment = async (
  id: number,
  data: {
    payment_status: 'paid' | 'failed' | 'emi_partial';
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
    payment_verified_at?: Date;
    payment_failed_at?: Date;
    emi_installments_paid?: number;
  },
): Promise<void> => {
  const fields: string[] = ['payment_status = ?'];
  const values: unknown[] = [data.payment_status];

  if (data.razorpay_order_id !== undefined)     { fields.push('razorpay_order_id = ?');     values.push(data.razorpay_order_id); }
  if (data.razorpay_payment_id !== undefined)   { fields.push('razorpay_payment_id = ?');   values.push(data.razorpay_payment_id); }
  if (data.razorpay_signature !== undefined)    { fields.push('razorpay_signature = ?');    values.push(data.razorpay_signature); }
  if (data.payment_verified_at !== undefined)   { fields.push('payment_verified_at = ?');   values.push(data.payment_verified_at); }
  if (data.payment_failed_at !== undefined)     { fields.push('payment_failed_at = ?');     values.push(data.payment_failed_at); }
  if (data.emi_installments_paid !== undefined) { fields.push('emi_installments_paid = ?'); values.push(data.emi_installments_paid); }

  values.push(id);
  await execute(`UPDATE course_enrollments SET ${fields.join(', ')} WHERE id = ?`, values);
};

export const getAllCourseEnrollments = async (): Promise<CourseEnrollment[]> => {
  return query<CourseEnrollment>('SELECT * FROM course_enrollments ORDER BY created_at DESC');
};
