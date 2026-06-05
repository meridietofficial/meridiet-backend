import { query, execute } from '../config/database';

export interface Appointment {
  id: number;
  dietitian_id: number;
  user_id: number | null;
  name: string;
  email: string | null;
  phone: string | null;
  appointment_date: string; // YYYY-MM-DD
  slot: string;
  fee: number;
  currency: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  payment_status: 'unpaid' | 'paid' | 'refunded';
  payment_id: string | null;
  order_id: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateAppointmentData {
  dietitian_id: number;
  user_id?: number | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  appointment_date: string;
  slot: string;
  fee: number;
  currency?: string;
  notes?: string | null;
}

export const createAppointment = async (data: CreateAppointmentData) => {
  const result = await execute(
    `INSERT INTO appointments
       (dietitian_id, user_id, name, email, phone, appointment_date, slot, fee, currency, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.dietitian_id,
      data.user_id ?? null,
      data.name,
      data.email ?? null,
      data.phone ?? null,
      data.appointment_date,
      data.slot,
      data.fee,
      data.currency ?? 'INR',
      data.notes ?? null,
    ],
  );
  const rows = await query<Appointment>('SELECT * FROM appointments WHERE id = ? LIMIT 1', [result.insertId]);
  return rows[0] ?? null;
};

// Already-taken slots for a dietitian (to subtract from available_dates later)
export const getBookedSlots = async (dietitian_id: number, fromDate: string) => {
  return query<{ appointment_date: string; slot: string }>(
    `SELECT appointment_date, slot
       FROM appointments
      WHERE dietitian_id = ? AND appointment_date >= ?
        AND status <> 'cancelled'`,
    [dietitian_id, fromDate],
  );
};
