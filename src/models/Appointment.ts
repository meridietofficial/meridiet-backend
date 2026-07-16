import { query, execute } from '../config/database';

export interface Appointment {
  id: number;
  dietitian_id: number;
  user_id: number | null;
  name: string;
  email: string | null;
  phone: string | null;
  appointment_date: string; // YYYY-MM-DD
  slot: string;             // HH:MM
  duration: number;         // minutes
  session_type: 'video_call' | 'in_person';
  fee: number;
  currency: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'missed';
  payment_status: 'unpaid' | 'paid' | 'refunded';
  payment_approved_at: Date | null;
  payment_approved_by: number | null;
  payment_id: string | null;
  order_id: string | null;
  coupon_id: number | null;
  discount_applied: number | null;
  final_amount: number | null;
  notes: string | null;
  dietitian_notes: string | null;
  missed_reason: string | null;
  missed_type: 'patient_no_show' | 'dietitian_no_show' | 'technical_issue' | 'network_issue' | 'other' | 'both_no_show' | null;
  user_rating: number | null;
  user_review: string | null;
  user_reviewed_at: Date | null;
  dietitian_rating: number | null;
  dietitian_review: string | null;
  dietitian_reviewed_at: Date | null;
  parent_appointment_id: number | null;
  is_follow_up: boolean;
  follow_up_type?: string | null;
  // Agora video call fields
  agora_channel_name: string | null;
  agora_resource_id: string | null;
  agora_recording_sid: string | null;
  agora_recording_uid: string | null;
  video_call_status: 'not_started' | 'ongoing' | 'ended';
  recording_url: string | null;
  call_started_at: Date | null;
  call_ended_at: Date | null;
  call_duration_seconds: number | null;
  user_joined_at: Date | null;
  dietitian_joined_at: Date | null;
  reminder_1h_sent_at: Date | null;
  reminder_10min_sent_at: Date | null;
  reminder_dietitian_15min_sent_at: Date | null;
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
  duration?: number;
  session_type?: 'video_call' | 'in_person';
  fee: number;
  currency?: string;
  order_id?: string | null;
  coupon_id?: number | null;
  discount_applied?: number | null;
  final_amount?: number | null;
  notes?: string | null;
  parent_appointment_id?: number | null;
  is_follow_up?: boolean;
  follow_up_type?: string | null;
}

// Columns selected in every read query — normalises TIME -> "HH:MM" and DATE -> "YYYY-MM-DD"
const APPOINTMENT_SELECT = `
  id, dietitian_id, user_id, name, email, phone,
  DATE_FORMAT(appointment_date, '%Y-%m-%d') AS appointment_date,
  TIME_FORMAT(slot, '%H:%i')                AS slot,
  duration, session_type,
  fee, currency, status, payment_status, payment_approved_at, payment_approved_by, payment_id, order_id, coupon_id, discount_applied, final_amount, notes, dietitian_notes, missed_reason, missed_type,
  user_rating, user_review, user_reviewed_at,
  dietitian_rating, dietitian_review, dietitian_reviewed_at,
  parent_appointment_id, is_follow_up, follow_up_type,
  agora_channel_name, agora_resource_id, agora_recording_sid, agora_recording_uid,
  video_call_status, recording_url,
  call_started_at, call_ended_at, call_duration_seconds,
  user_joined_at, dietitian_joined_at,
  created_at, updated_at
`;

export const createAppointment = async (data: CreateAppointmentData) => {
  const result = await execute(
    `INSERT INTO appointments
       (dietitian_id, user_id, name, email, phone, appointment_date, slot, duration, session_type,
        fee, currency, order_id, coupon_id, discount_applied, final_amount,
        notes, parent_appointment_id, is_follow_up, follow_up_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.dietitian_id,
      data.user_id ?? null,
      data.name,
      data.email ?? null,
      data.phone ?? null,
      data.appointment_date,
      data.slot,
      data.duration ?? 30,
      data.session_type ?? 'video_call',
      data.fee,
      data.currency ?? 'INR',
      data.order_id ?? null,
      data.coupon_id ?? null,
      data.discount_applied ?? null,
      data.final_amount ?? null,
      data.notes ?? null,
      data.parent_appointment_id ?? null,
      data.is_follow_up ? 1 : 0,
      data.follow_up_type ?? null,
    ],
  );
  const rows = await query<Appointment>(
    `SELECT ${APPOINTMENT_SELECT} FROM appointments WHERE id = ? LIMIT 1`,
    [result.insertId],
  );
  return rows[0] ?? null;
};

export interface AppointmentDetail extends Omit<Appointment, 'email' | 'phone'> {
  avatar_url: string | null;
  user_review_done: boolean;
  dietitian_review_done: boolean;
}

type AppointmentDetailRaw = Omit<AppointmentDetail, 'user_review_done' | 'dietitian_review_done'> & {
  user_review_done: number;
  dietitian_review_done: number;
};

export const findAppointmentDetailById = async (id: number) => {
  const rows = await query<AppointmentDetailRaw>(
    `SELECT
       a.id, a.dietitian_id, a.user_id, a.name,
       DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointment_date,
       TIME_FORMAT(a.slot, '%H:%i')                AS slot,
       a.duration, a.session_type,
       a.fee, a.currency, a.status, a.payment_status, a.payment_id, a.order_id,
       a.notes, a.dietitian_notes, a.missed_reason, a.missed_type,
       a.user_rating, a.user_review, a.user_reviewed_at,
       a.dietitian_rating, a.dietitian_review, a.dietitian_reviewed_at,
       a.parent_appointment_id, a.is_follow_up, a.follow_up_type,
       a.agora_channel_name, a.agora_resource_id, a.agora_recording_sid, a.agora_recording_uid,
       a.video_call_status, a.recording_url,
       a.call_started_at, a.call_ended_at, a.call_duration_seconds,
       a.created_at, a.updated_at,
       COALESCE(u.avatar_url, '')                   AS avatar_url,
       IF(a.user_rating IS NOT NULL, 1, 0)          AS user_review_done,
       IF(a.dietitian_rating IS NOT NULL, 1, 0)     AS dietitian_review_done,
       (SELECT fu.id FROM appointments fu
        WHERE fu.parent_appointment_id = a.id
          AND fu.status <> 'cancelled'
        ORDER BY fu.appointment_date ASC, fu.slot ASC
        LIMIT 1)                                    AS follow_up_id,
       (SELECT DATE_FORMAT(fu.appointment_date, '%Y-%m-%d') FROM appointments fu
        WHERE fu.parent_appointment_id = a.id
          AND fu.status <> 'cancelled'
        ORDER BY fu.appointment_date ASC, fu.slot ASC
        LIMIT 1)                                    AS follow_up_date,
       (SELECT TIME_FORMAT(fu.slot, '%H:%i') FROM appointments fu
        WHERE fu.parent_appointment_id = a.id
          AND fu.status <> 'cancelled'
        ORDER BY fu.appointment_date ASC, fu.slot ASC
        LIMIT 1)                                    AS follow_up_slot,
       (SELECT fu.status FROM appointments fu
        WHERE fu.parent_appointment_id = a.id
          AND fu.status <> 'cancelled'
        ORDER BY fu.appointment_date ASC, fu.slot ASC
        LIMIT 1)                                    AS follow_up_status
     FROM appointments a
     LEFT JOIN users u ON a.user_id = u.id AND u.is_delete = 0
     WHERE a.id = ?
     LIMIT 1`,
    [id],
  );
  if (!rows[0]) return null;
  const r = rows[0] as typeof rows[0] & {
    follow_up_id: number | null;
    follow_up_date: string | null;
    follow_up_slot: string | null;
    follow_up_status: string | null;
  };
  const { follow_up_id, follow_up_date, follow_up_slot, follow_up_status, ...rest } = r;
  return {
    ...rest,
    user_review_done:      Boolean(r.user_review_done),
    dietitian_review_done: Boolean(r.dietitian_review_done),
    follow_up: follow_up_id
      ? { id: follow_up_id, date: follow_up_date, slot: follow_up_slot, status: follow_up_status }
      : null,
  };
};

export const findAppointmentById = async (id: number) => {
  const rows = await query<Appointment>(
    `SELECT ${APPOINTMENT_SELECT} FROM appointments WHERE id = ? LIMIT 1`,
    [id],
  );
  return rows[0] ?? null;
};

export const findAppointmentByOrderId = async (orderId: string) => {
  const rows = await query<Appointment>(
    `SELECT ${APPOINTMENT_SELECT} FROM appointments WHERE order_id = ? LIMIT 1`,
    [orderId],
  );
  return rows[0] ?? null;
};

export interface AppointmentWithDietitian extends Appointment {
  dietitian: {
    id: number;
    full_name: string;
    avatar_url: string | null;
    city: string;
    state: string;
  };
}

export const findAppointmentsByUserId = async (userId: number, page = 1, limit = 10) => {
  const offset = (page - 1) * limit;
  const [rows, countRows] = await Promise.all([
    query<Appointment & {
      dietitian_profile_id: number;
      dietitian_full_name: string;
      dietitian_avatar_url: string | null;
      dietitian_city: string;
      dietitian_state: string;
      diet_plan_id: number | null;
      diet_plan_status: string | null;
      diet_plan_pdf_url: string | null;
    }>(
      `SELECT
         a.id, a.dietitian_id, a.user_id, a.name, a.email, a.phone,
         DATE_FORMAT(a.appointment_date, '%Y-%m-%d')  AS appointment_date,
         TIME_FORMAT(a.slot, '%H:%i')                 AS slot,
         a.duration, a.session_type,
         a.fee, a.currency, a.status, a.payment_status,
         a.payment_id, a.order_id, a.notes,
         a.missed_reason,
         a.user_rating, a.user_review, a.user_reviewed_at,
         a.dietitian_rating, a.dietitian_review, a.dietitian_reviewed_at,
         a.parent_appointment_id, a.is_follow_up, a.follow_up_type,
         a.agora_channel_name, a.agora_resource_id, a.agora_recording_sid, a.agora_recording_uid,
         a.video_call_status, a.recording_url,
         a.call_started_at, a.call_ended_at, a.call_duration_seconds,
         a.created_at, a.updated_at,
         d.id                                          AS dietitian_profile_id,
         u.full_name                                   AS dietitian_full_name,
         d.profile_photo                               AS dietitian_avatar_url,
         d.city                                        AS dietitian_city,
         d.state                                       AS dietitian_state,
         dp.id                                         AS diet_plan_id,
         dp.status                                     AS diet_plan_status,
         dp.pdf_url                                    AS diet_plan_pdf_url
       FROM appointments a
       JOIN dietitians d ON a.dietitian_id = d.id
       JOIN users u ON d.user_id = u.id
       LEFT JOIN diet_plans dp ON dp.appointment_id = a.id
       WHERE a.user_id = ?
         AND (a.payment_status <> 'unpaid' OR a.status = 'confirmed')
       ORDER BY a.appointment_date DESC, a.slot ASC
       LIMIT ${limit} OFFSET ${offset}`,
      [userId],
    ),
    query<{ total: number }>(`SELECT COUNT(*) AS total FROM appointments WHERE user_id = ? AND (payment_status <> 'unpaid' OR status = 'confirmed')`, [userId]),
  ]);

  const appointments = rows.map((r) => ({
    id: r.id,
    dietitian_id: r.dietitian_id,
    user_id: r.user_id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    appointment_date: r.appointment_date,
    slot: r.slot,
    duration: r.duration,
    session_type: r.session_type,
    fee: r.fee,
    currency: r.currency,
    status: r.status,
    payment_status: r.payment_status,
    payment_id: r.payment_id,
    order_id: r.order_id,
    notes: r.notes,
    missed_reason: r.missed_reason ?? null,
    user_rating: r.user_rating ?? null,
    user_review: r.user_review ?? null,
    user_reviewed_at: r.user_reviewed_at ?? null,
    dietitian_rating: r.dietitian_rating ?? null,
    dietitian_review: r.dietitian_review ?? null,
    dietitian_reviewed_at: r.dietitian_reviewed_at ?? null,
    parent_appointment_id: r.parent_appointment_id ?? null,
    is_follow_up: r.is_follow_up,
    follow_up_type: r.follow_up_type ?? null,
    agora_channel_name: r.agora_channel_name ?? null,
    agora_resource_id: r.agora_resource_id ?? null,
    agora_recording_sid: r.agora_recording_sid ?? null,
    agora_recording_uid: r.agora_recording_uid ?? null,
    video_call_status: r.video_call_status ?? null,
    recording_url: r.recording_url ?? null,
    call_started_at: r.call_started_at ?? null,
    call_ended_at: r.call_ended_at ?? null,
    call_duration_seconds: r.call_duration_seconds ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
    dietitian: {
      id: r.dietitian_profile_id,
      full_name: r.dietitian_full_name,
      avatar_url: r.dietitian_avatar_url,
      city: r.dietitian_city,
      state: r.dietitian_state,
    },
    diet_plan: r.diet_plan_id
      ? { id: r.diet_plan_id, status: r.diet_plan_status, pdf_url: r.diet_plan_pdf_url }
      : null,
  }));

  return { appointments, total: countRows[0]?.total ?? 0 };
};

export const findAppointmentsByDietitianId = async (
  dietitianId: number,
  page = 1,
  limit = 10,
  status?: string,
) => {
  const offset = (page - 1) * limit;
  const whereStatus = status ? 'AND a.status = ?' : '';
  const countWhereStatus = status ? 'AND status = ?' : '';
  const countParams: unknown[] = status ? [dietitianId, status] : [dietitianId];

  const [rows, countRows] = await Promise.all([
    query<AppointmentDetail>(
      `SELECT
         a.id, a.dietitian_id, a.user_id, a.name,
         DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointment_date,
         TIME_FORMAT(a.slot, '%H:%i')                AS slot,
         a.duration, a.session_type,
         a.fee, a.currency, a.status, a.payment_status, a.payment_id, a.order_id,
         a.notes, a.dietitian_notes, a.missed_reason,
         a.parent_appointment_id, a.is_follow_up,
         a.agora_channel_name, a.agora_resource_id, a.agora_recording_sid, a.agora_recording_uid,
         a.video_call_status, a.recording_url,
         a.call_started_at, a.call_ended_at, a.call_duration_seconds,
         a.created_at, a.updated_at,
         COALESCE(u.avatar_url, '') AS avatar_url
       FROM appointments a
       LEFT JOIN users u ON a.user_id = u.id AND u.is_delete = 0
       WHERE a.dietitian_id = ?
         AND (a.payment_status <> 'unpaid' OR a.status = 'confirmed')
         ${whereStatus}
       ORDER BY a.appointment_date DESC, a.slot ASC LIMIT ${limit} OFFSET ${offset}`,
      countParams,
    ),
    query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM appointments
       WHERE dietitian_id = ?
         AND (payment_status <> 'unpaid' OR status = 'confirmed')
         ${countWhereStatus}`,
      countParams,
    ),
  ]);
  return { appointments: rows, total: countRows[0]?.total ?? 0 };
};

export const updateAppointmentStatus = async (
  id: number,
  status: Appointment['status'],
) => {
  await execute('UPDATE appointments SET status = ? WHERE id = ?', [status, id]);
};

export const updateAppointmentPayment = async (
  orderId: string,
  paymentId: string,
  paymentStatus: Appointment['payment_status'],
  status: Appointment['status'],
) => {
  await execute(
    'UPDATE appointments SET payment_id = ?, payment_status = ?, status = ? WHERE order_id = ?',
    [paymentId, paymentStatus, status, orderId],
  );
};

export const markAppointmentCancelled = async (orderId: string) => {
  await execute(
    `UPDATE appointments SET status = 'cancelled' WHERE order_id = ?`,
    [orderId],
  );
};

export const isSlotTaken = async (
  dietitian_id: number,
  appointment_date: string,
  slot: string,
  excludeId?: number,
) => {
  const excludeCond = excludeId ? 'AND id <> ?' : '';
  const params: unknown[] = [dietitian_id, appointment_date, slot];
  if (excludeId) params.push(excludeId);

  const rows = await query<{ id: number }>(
    `SELECT id FROM appointments
      WHERE dietitian_id = ? AND appointment_date = ? AND slot = ?
        AND status NOT IN ('cancelled', 'missed')
        AND (payment_status <> 'unpaid' OR status = 'confirmed')
        ${excludeCond}
      LIMIT 1`,
    params,
  );
  return rows.length > 0;
};

// Returns an unpaid/pending appointment for a slot owned by the given user (or any user if userId is null).
// Used to detect when the same user is retrying after cancelling the Razorpay modal.
export const findUnpaidSlotAppointment = async (
  dietitian_id: number,
  appointment_date: string,
  slot: string,
  userId: number | null,
) => {
  const rows = await query<Appointment>(
    `SELECT ${APPOINTMENT_SELECT} FROM appointments
      WHERE dietitian_id = ? AND appointment_date = ? AND slot = ?
        AND payment_status = 'unpaid' AND status = 'pending'
        AND (user_id = ? OR (? IS NULL AND user_id IS NULL))
      LIMIT 1`,
    [dietitian_id, appointment_date, slot, userId, userId],
  );
  return rows[0] ?? null;
};

export const updateAppointmentOrderId = async (id: number, order_id: string) => {
  await query('UPDATE appointments SET order_id = ? WHERE id = ?', [order_id, id]);
};

// Used when retrying payment on an existing unpaid appointment (fresh Razorpay order + new coupon state).
export const updateAppointmentOnRetry = async (
  id: number,
  order_id: string,
  couponId: number | null,
  discountApplied: number | null,
  finalAmount: number | null,
) => {
  await execute(
    'UPDATE appointments SET order_id = ?, coupon_id = ?, discount_applied = ?, final_amount = ? WHERE id = ?',
    [order_id, couponId, discountApplied, finalAmount, id],
  );
};

export const rescheduleAppointment = async (
  id: number,
  appointment_date: string,
  slot: string,
  missed_reason?: string | null,
) => {
  // Clear missed_type so a rescheduled+completed appointment gets normal (full) payment
  await execute(
    `UPDATE appointments
     SET appointment_date = ?, slot = ?, status = 'confirmed',
         missed_type = NULL, missed_reason = COALESCE(?, missed_reason)
     WHERE id = ?`,
    [appointment_date, slot, missed_reason ?? null, id],
  );
};

export const markPaymentApproved = async (
  appointmentId: number,
  approvedBy: number | null,
) => {
  await execute(
    `UPDATE appointments
     SET payment_approved_at = NOW(), payment_approved_by = ?
     WHERE id = ?`,
    [approvedBy, appointmentId],
  );
};

export type MissedType = 'patient_no_show' | 'dietitian_no_show' | 'technical_issue' | 'network_issue' | 'other' | 'both_no_show';

export const markAppointmentMissedWithType = async (
  id: number,
  missed_type: MissedType,
  missed_reason?: string | null,
) => {
  await execute(
    `UPDATE appointments
     SET status = 'missed', missed_type = ?, missed_reason = COALESCE(?, missed_reason)
     WHERE id = ?`,
    [missed_type, missed_reason ?? null, id],
  );
};

export const markAppointmentPaymentRefunded = async (id: number) => {
  await execute(
    `UPDATE appointments SET payment_status = 'refunded' WHERE id = ?`,
    [id],
  );
};

// ── No-show queue ─────────────────────────────────────────────────────────────
// Past confirmed+paid appointments where admin still needs to act.
// For video_call: shows who didn't join. For in_person: admin must verify manually.
export interface NoShowQueueItem {
  id: number;
  appointment_date: string;
  slot: string;
  duration: number;
  session_type: string;
  fee: number;
  currency: string;
  patient_name: string;
  patient_email: string | null;
  patient_phone: string | null;
  dietitian_id: number;
  dietitian_name: string;
  dietitian_email: string;
  dietitian_phone: string | null;
  user_joined_at: Date | null;
  dietitian_joined_at: Date | null;
  created_at: Date;
}

export const adminGetNoShowQueue = async (
  page = 1,
  limit = 20,
  search?: string,
) => {
  const safePage  = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  const offset    = (safePage - 1) * safeLimit;

  const conditions: string[] = [
    "a.status = 'confirmed'",
    "a.payment_status = 'paid'",
    "a.is_follow_up = 0",
    // appointment slot time has passed (give 30 min grace after scheduled time)
    "TIMESTAMP(a.appointment_date, a.slot) < DATE_SUB(NOW(), INTERVAL 30 MINUTE)",
  ];
  const params: unknown[] = [];

  if (search) {
    conditions.push('(a.name LIKE ? OR a.email LIKE ? OR du.full_name LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const [rows, countRows] = await Promise.all([
    query<NoShowQueueItem & {
      dietitian_name: string; dietitian_email: string; dietitian_phone: string | null;
    }>(
      `SELECT
         a.id, DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointment_date,
         TIME_FORMAT(a.slot, '%H:%i') AS slot,
         a.duration, a.session_type, a.fee, a.currency,
         a.name   AS patient_name,
         a.email  AS patient_email,
         a.phone  AS patient_phone,
         d.id     AS dietitian_id,
         du.full_name AS dietitian_name,
         du.email     AS dietitian_email,
         CONCAT(COALESCE(du.phone_code,''), du.phone_number) AS dietitian_phone,
         a.user_joined_at, a.dietitian_joined_at,
         a.created_at
       FROM appointments a
       JOIN dietitians d  ON a.dietitian_id = d.id
       JOIN users du      ON d.user_id = du.id
       ${where}
       ORDER BY a.appointment_date DESC, a.slot DESC
       LIMIT ${safeLimit} OFFSET ${offset}`,
      params,
    ),
    query<{ total: number }>(
      `SELECT COUNT(*) AS total
       FROM appointments a
       JOIN dietitians d  ON a.dietitian_id = d.id
       JOIN users du      ON d.user_id = du.id
       ${where}`,
      params,
    ),
  ]);

  return {
    appointments: rows.map((r) => ({
      id:               r.id,
      appointment_date: r.appointment_date,
      slot:             r.slot,
      duration:         r.duration,
      session_type:     r.session_type,
      fee:              r.fee,
      currency:         r.currency,
      patient: {
        name:  r.patient_name,
        email: r.patient_email ?? null,
        phone: r.patient_phone ?? null,
      },
      dietitian: {
        id:    r.dietitian_id,
        name:  r.dietitian_name,
        email: r.dietitian_email,
        phone: r.dietitian_phone ?? null,
      },
      call_tracking: r.session_type === 'video_call' ? {
        user_joined_at:      r.user_joined_at ?? null,
        dietitian_joined_at: r.dietitian_joined_at ?? null,
        patient_no_show:     r.user_joined_at === null,
        dietitian_no_show:   r.dietitian_joined_at === null,
      } : {
        user_joined_at:      null,
        dietitian_joined_at: null,
        patient_no_show:     null,
        dietitian_no_show:   null,
      },
      created_at: r.created_at,
    })),
    total: Number(countRows[0]?.total ?? 0),
    page:  safePage,
    limit: safeLimit,
  };
};

// ── Reminder queries ──────────────────────────────────────────────────────────

export interface ReminderAppointment {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  appointment_date: string;
  slot: string;
  session_type: 'video_call' | 'in_person';
  dietitian_id: number;
  user_id: number | null;
  // joined from dietitians + users
  dietitian_name: string;
  dietitian_email: string | null;
  dietitian_phone: string | null;
}

// Shared JOIN fragment — pulls dietitian name/email/phone in one query
// appointment_date filter comes FIRST so MySQL uses the date index before
// evaluating the more expensive TIMESTAMP() function
const REMINDER_SELECT = `
  SELECT a.id, a.name, a.email, a.phone,
         DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointment_date,
         TIME_FORMAT(a.slot, '%H:%i')                AS slot,
         a.session_type, a.dietitian_id, a.user_id,
         u.full_name   AS dietitian_name,
         u.email       AS dietitian_email,
         CONCAT(COALESCE(u.phone_code,''), u.phone_number) AS dietitian_phone
  FROM   appointments a
  JOIN   dietitians   d ON d.id = a.dietitian_id
  JOIN   users        u ON u.id = d.user_id
`;

// 1h window: today OR tomorrow (handles reminders that cross midnight)
// IST_NOW = UTC_TIMESTAMP() + 330 min (5h 30m).
// Slots are stored as IST naive datetimes. UTC_TIMESTAMP() is always UTC regardless of
// session timezone. Adding 330 min gives the current IST moment as a naive datetime so
// the comparison is correct on any server (UTC or IST system clock).
export const getDue1hReminders = async (): Promise<ReminderAppointment[]> =>
  query<ReminderAppointment>(
    `${REMINDER_SELECT}
     WHERE a.status = 'confirmed'
       AND a.reminder_1h_sent_at IS NULL
       AND a.appointment_date BETWEEN DATE(UTC_TIMESTAMP() + INTERVAL 330 MINUTE)
                                  AND DATE_ADD(DATE(UTC_TIMESTAMP() + INTERVAL 330 MINUTE), INTERVAL 1 DAY)
       AND TIMESTAMP(a.appointment_date, a.slot)
             BETWEEN UTC_TIMESTAMP() + INTERVAL 385 MINUTE
                 AND UTC_TIMESTAMP() + INTERVAL 395 MINUTE`,
  );

// 10min window: always today (IST date)
export const getDue10minReminders = async (): Promise<ReminderAppointment[]> =>
  query<ReminderAppointment>(
    `${REMINDER_SELECT}
     WHERE a.status = 'confirmed'
       AND a.reminder_10min_sent_at IS NULL
       AND a.appointment_date = DATE(UTC_TIMESTAMP() + INTERVAL 330 MINUTE)
       AND TIMESTAMP(a.appointment_date, a.slot)
             BETWEEN UTC_TIMESTAMP() + INTERVAL 338 MINUTE
                 AND UTC_TIMESTAMP() + INTERVAL 342 MINUTE`,
  );

// 15min dietitian window: always today (IST date)
export const getDueDietitian15minReminders = async (): Promise<ReminderAppointment[]> =>
  query<ReminderAppointment>(
    `${REMINDER_SELECT}
     WHERE a.status = 'confirmed'
       AND a.reminder_dietitian_15min_sent_at IS NULL
       AND a.appointment_date = DATE(UTC_TIMESTAMP() + INTERVAL 330 MINUTE)
       AND TIMESTAMP(a.appointment_date, a.slot)
             BETWEEN UTC_TIMESTAMP() + INTERVAL 343 MINUTE
                 AND UTC_TIMESTAMP() + INTERVAL 347 MINUTE`,
  );

export const markReminderSent = async (
  id: number,
  type: '1h' | '10min' | 'dietitian_15min',
): Promise<void> => {
  const col =
    type === '1h'            ? 'reminder_1h_sent_at' :
    type === '10min'         ? 'reminder_10min_sent_at' :
                               'reminder_dietitian_15min_sent_at';
  await execute(`UPDATE appointments SET ${col} = NOW() WHERE id = ?`, [id]);
};

export const markMissedAppointments = async () => {
  const result = await execute(
    `UPDATE appointments
     SET status = 'missed'
     WHERE status IN ('confirmed', 'pending')
       AND TIMESTAMP(appointment_date, slot) + INTERVAL 30 MINUTE
             < UTC_TIMESTAMP() + INTERVAL 330 MINUTE`,
  );
  return (result as { affectedRows: number }).affectedRows;
};

export interface DietitianClient {
  user_id: number | null;
  name: string;
  avatar_url: string | null;
  is_active: boolean | null;
  total_appointments: number;
  last_appointment_date: string | null;
  pending: number;   // pending + confirmed (not yet completed)
  completed: number;
  cancelled: number;
  missed: number;
  rescheduled: number;
}

export const getClientsByDietitianId = async (dietitianId: number, page = 1, limit = 10) => {
  const offset = (page - 1) * limit;

  // Exclude ghost reservations (unpaid + still pending — patient never completed payment)
  const baseWhere = `
    a.dietitian_id = ?
    AND (a.payment_status <> 'unpaid' OR a.status = 'confirmed')
  `;

  const [rows, countRows] = await Promise.all([
    query<DietitianClient>(
      `SELECT
         a.user_id,
         COALESCE(u.full_name, a.name)                              AS name,
         u.avatar_url,
         u.is_active,
         COUNT(*)                                                    AS total_appointments,
         MAX(DATE_FORMAT(a.appointment_date, '%Y-%m-%d'))           AS last_appointment_date,
         SUM(a.status IN ('pending', 'confirmed'))                   AS pending,
         SUM(a.status = 'completed')                                AS completed,
         SUM(a.status = 'cancelled')                                AS cancelled,
         SUM(a.status = 'missed')                                   AS missed,
         (
           SELECT COUNT(*) FROM appointment_reschedule_history rh
           WHERE rh.appointment_id IN (
             SELECT id FROM appointments a2 WHERE a2.dietitian_id = a.dietitian_id AND a2.user_id = a.user_id
           )
         )                                                          AS rescheduled
       FROM appointments a
       LEFT JOIN users u ON a.user_id = u.id AND u.is_delete = 0
       WHERE ${baseWhere}
       GROUP BY a.user_id, COALESCE(u.full_name, a.name), u.avatar_url, u.is_active
       ORDER BY last_appointment_date DESC
       LIMIT ${limit} OFFSET ${offset}`,
      [dietitianId],
    ),
    query<{ total: number }>(
      `SELECT COUNT(DISTINCT a.user_id, COALESCE(u.full_name, a.name)) AS total
       FROM appointments a
       LEFT JOIN users u ON a.user_id = u.id AND u.is_delete = 0
       WHERE ${baseWhere}`,
      [dietitianId],
    ),
  ]);

  return { clients: rows, total: countRows[0]?.total ?? 0 };
};

export interface SessionRow {
  id: number;
  appointment_date: string;
  slot: string;
  duration: number;
  session_type: 'video_call' | 'in_person';
  status: string;
  payment_status: string;
  notes: string | null;
  user_id: number | null;
  client_name: string;
  client_avatar: string | null;
  session_number: number;
  user_review_done: number;
  dietitian_review_done: number;
  is_follow_up: number;
  parent_appointment_id: number | null;
  diet_plan_id: number | null;
  diet_plan_status: string | null;
  diet_plan_form_id: number | null;
}

export const getDietitianSessionsList = async (
  dietitianId: number,
  tab: 'all' | 'upcoming' | 'completed' | 'cancelled' | 'missed',
  search: string | undefined,
  page: number,
  limit: number,
) => {
  const offset = (page - 1) * limit;
  const searchCond = search ? "AND COALESCE(u.full_name, a.name) LIKE ?" : "";
  const searchParam: unknown[] = search ? [`%${search}%`] : [];

  const tabCond = tab === 'upcoming'  ? "AND a.status = 'confirmed'"
    : tab === 'completed' ? "AND a.status = 'completed'"
    : tab === 'cancelled' ? "AND a.status = 'cancelled'"
    : tab === 'missed'    ? "AND a.status = 'missed'"
    : "";

  const [summaryRows, rows, countRows] = await Promise.all([
    query<{ total: number; upcoming: number; completed: number; cancelled: number; pending: number; missed: number }>(
      `SELECT
         COUNT(*)                      AS total,
         SUM(a.status = 'confirmed')   AS upcoming,
         SUM(a.status = 'completed')   AS completed,
         SUM(a.status = 'cancelled')   AS cancelled,
         SUM(a.status = 'pending')     AS pending,
         SUM(a.status = 'missed')      AS missed
       FROM appointments a
       LEFT JOIN users u ON a.user_id = u.id AND u.is_delete = 0
       WHERE a.dietitian_id = ?
         AND (a.payment_status <> 'unpaid' OR a.status = 'confirmed')
         ${searchCond}`,
      [dietitianId, ...searchParam],
    ),
    query<SessionRow>(
      `SELECT
         a.id,
         DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointment_date,
         TIME_FORMAT(a.slot, '%H:%i')                AS slot,
         a.duration,
         a.session_type,
         a.status,
         a.payment_status,
         a.notes,
         a.user_id,
         COALESCE(u.full_name, a.name)               AS client_name,
         u.avatar_url                                AS client_avatar,
         CASE
           WHEN a.user_id IS NOT NULL THEN (
             SELECT COUNT(*) FROM appointments a2
             WHERE a2.dietitian_id = a.dietitian_id
               AND a2.user_id = a.user_id
               AND a2.status <> 'cancelled'
           )
           ELSE 1
         END                                         AS session_number,
         IF(a.user_rating IS NOT NULL, 1, 0)         AS user_review_done,
         IF(a.dietitian_rating IS NOT NULL, 1, 0)    AS dietitian_review_done,
         a.is_follow_up,
         a.parent_appointment_id,
         dp.id                                       AS diet_plan_id,
         dp.status                                   AS diet_plan_status,
         dp.form_id                                  AS diet_plan_form_id
       FROM appointments a
       LEFT JOIN users u        ON a.user_id = u.id AND u.is_delete = 0
       LEFT JOIN diet_plans dp  ON dp.appointment_id = a.id
       WHERE a.dietitian_id = ?
         AND (a.payment_status <> 'unpaid' OR a.status = 'confirmed')
         ${tabCond} ${searchCond}
       ORDER BY a.appointment_date ASC, a.slot ASC
       LIMIT ${limit} OFFSET ${offset}`,
      [dietitianId, ...searchParam],
    ),
    query<{ total: number }>(
      `SELECT COUNT(*) AS total
       FROM appointments a
       LEFT JOIN users u ON a.user_id = u.id AND u.is_delete = 0
       WHERE a.dietitian_id = ?
         AND (a.payment_status <> 'unpaid' OR a.status = 'confirmed')
         ${tabCond} ${searchCond}`,
      [dietitianId, ...searchParam],
    ),
  ]);

  return {
    summary: {
      all:       Number(summaryRows[0]?.total     ?? 0),
      upcoming:  Number(summaryRows[0]?.upcoming  ?? 0),
      missed:    Number(summaryRows[0]?.missed    ?? 0),
      completed: Number(summaryRows[0]?.completed ?? 0),
      cancelled: Number(summaryRows[0]?.cancelled ?? 0),
      pending:   Number(summaryRows[0]?.pending   ?? 0),
    },
    rows,
    total: Number(countRows[0]?.total ?? 0),
  };
};

export interface DashboardStats {
  today_count: number;
  yesterday_count: number;
  pending_count: number;
  upcoming_count: number;
  next_date: string | null;
  next_slot: string | null;
  this_month_earnings: number;
  last_month_earnings: number;
}

export const getDietitianDashboardStats = async (dietitianId: number): Promise<DashboardStats> => {
  const [todayRows, pendingRows, upcomingRows, nextRows, earningsRows] = await Promise.all([
    query<{ today_count: number; yesterday_count: number }>(
      `SELECT
         SUM(appointment_date = CURDATE() AND status <> 'cancelled')                            AS today_count,
         SUM(appointment_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND status <> 'cancelled') AS yesterday_count
       FROM appointments
       WHERE dietitian_id = ?
         AND appointment_date BETWEEN DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND CURDATE()`,
      [dietitianId],
    ),
    query<{ pending_count: number }>(
      `SELECT COUNT(*) AS pending_count FROM appointments WHERE dietitian_id = ? AND status = 'pending'`,
      [dietitianId],
    ),
    query<{ upcoming_count: number }>(
      `SELECT COUNT(*) AS upcoming_count FROM appointments
       WHERE dietitian_id = ? AND status = 'confirmed'
         AND TIMESTAMP(appointment_date, slot) >= NOW()`,
      [dietitianId],
    ),
    query<{ next_date: string; next_slot: string }>(
      `SELECT DATE_FORMAT(appointment_date, '%Y-%m-%d') AS next_date, TIME_FORMAT(slot, '%H:%i') AS next_slot
       FROM appointments
       WHERE dietitian_id = ? AND status = 'confirmed' AND TIMESTAMP(appointment_date, slot) >= NOW()
       ORDER BY appointment_date ASC, slot ASC LIMIT 1`,
      [dietitianId],
    ),
    query<{ this_month_earnings: number; last_month_earnings: number }>(
      `SELECT
         SUM(CASE WHEN YEAR(appointment_date) = YEAR(CURDATE()) AND MONTH(appointment_date) = MONTH(CURDATE())
                  THEN fee ELSE 0 END) AS this_month_earnings,
         SUM(CASE WHEN YEAR(appointment_date) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
                    AND MONTH(appointment_date) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
                  THEN fee ELSE 0 END) AS last_month_earnings
       FROM appointments
       WHERE dietitian_id = ? AND payment_status = 'paid' AND status <> 'cancelled'`,
      [dietitianId],
    ),
  ]);

  return {
    today_count:          Number(todayRows[0]?.today_count          ?? 0),
    yesterday_count:      Number(todayRows[0]?.yesterday_count      ?? 0),
    pending_count:        Number(pendingRows[0]?.pending_count       ?? 0),
    upcoming_count:       Number(upcomingRows[0]?.upcoming_count     ?? 0),
    next_date:            nextRows[0]?.next_date  ?? null,
    next_slot:            nextRows[0]?.next_slot  ?? null,
    this_month_earnings:  Number(earningsRows[0]?.this_month_earnings ?? 0),
    last_month_earnings:  Number(earningsRows[0]?.last_month_earnings ?? 0),
  };
};

// Already-taken slots for a dietitian (to subtract from available_dates)
export const getBookedSlots = async (dietitian_id: number, fromDate: string) => {
  return query<{ appointment_date: string; slot: string }>(
    `SELECT
       DATE_FORMAT(appointment_date, '%Y-%m-%d') AS appointment_date,
       TIME_FORMAT(slot, '%H:%i')                AS slot
     FROM appointments
     WHERE dietitian_id = ? AND appointment_date >= ?
       AND status NOT IN ('cancelled', 'missed')
       AND (payment_status <> 'unpaid' OR status = 'confirmed')`,
    [dietitian_id, fromDate],
  );
};

// ── Agora video call helpers ──────────────────────────────────────────────────

// Called when a participant leaves the call (including accidental disconnects).
// Only records timing so the other participant (or this one) can still rejoin.
// Does NOT end the call or complete the appointment — use endCallSession for that.
export const markCallLeft = async (id: number) => {
  await execute(
    `UPDATE appointments
     SET call_ended_at         = COALESCE(call_ended_at, NOW()),
         call_duration_seconds = TIMESTAMPDIFF(SECOND, call_started_at, COALESCE(call_ended_at, NOW()))
     WHERE id = ? AND video_call_status = 'ongoing'`,
    [id],
  );
};

// Called when the dietitian explicitly ends the session.
// Marks the call as ended so no one can rejoin, but does NOT auto-complete the appointment
// (the dietitian still needs to schedule a follow-up or mark it completed separately).
export const endCallSession = async (id: number) => {
  await execute(
    `UPDATE appointments
     SET video_call_status     = 'ended',
         call_ended_at         = COALESCE(call_ended_at, NOW()),
         call_duration_seconds = TIMESTAMPDIFF(SECOND, call_started_at, COALESCE(call_ended_at, NOW()))
     WHERE id = ?`,
    [id],
  );
};

export const markUserJoined = async (id: number) => {
  await execute(
    `UPDATE appointments SET user_joined_at = COALESCE(user_joined_at, NOW()) WHERE id = ?`,
    [id],
  );
};

export const markDietitianJoined = async (id: number) => {
  await execute(
    `UPDATE appointments SET dietitian_joined_at = COALESCE(dietitian_joined_at, NOW()) WHERE id = ?`,
    [id],
  );
};

export const setAgoraChannel = async (id: number, channelName: string) => {
  await execute(
    `UPDATE appointments
     SET agora_channel_name = ?,
         video_call_status  = 'ongoing',
         call_started_at    = COALESCE(call_started_at, NOW())
     WHERE id = ?`,
    [channelName, id],
  );
};

export const updateRecordingStarted = async (
  id: number,
  resourceId: string,
  sid: string,
  recordingUid: string,
) => {
  await execute(
    `UPDATE appointments
     SET agora_resource_id = ?, agora_recording_sid = ?, agora_recording_uid = ?
     WHERE id = ?`,
    [resourceId, sid, recordingUid, id],
  );
};

export const updateCallEnded = async (id: number, recordingUrl: string | null) => {
  await execute(
    `UPDATE appointments
     SET video_call_status     = 'ended',
         call_ended_at         = COALESCE(call_ended_at, NOW()),
         call_duration_seconds = TIMESTAMPDIFF(SECOND, call_started_at, COALESCE(call_ended_at, NOW())),
         recording_url         = COALESCE(?, recording_url)
     WHERE id = ?`,
    [recordingUrl, id],
  );
};

export const updateRecordingUrl = async (id: number, recordingUrl: string) => {
  await execute(
    `UPDATE appointments SET recording_url = ? WHERE id = ?`,
    [recordingUrl, id],
  );
};

export const findAppointmentByChannelName = async (channelName: string) => {
  const rows = await query<Appointment>(
    `SELECT ${APPOINTMENT_SELECT} FROM appointments WHERE agora_channel_name = ? LIMIT 1`,
    [channelName],
  );
  return rows[0] ?? null;
};

export const saveUserReview = async (id: number, rating: number, review: string | null) => {
  await execute(
    `UPDATE appointments
     SET user_rating = ?, user_review = ?, user_reviewed_at = NOW()
     WHERE id = ? AND user_rating IS NULL`,
    [rating, review, id],
  );
};

export const saveDietitianReview = async (id: number, rating: number, review: string | null) => {
  await execute(
    `UPDATE appointments
     SET dietitian_rating = ?, dietitian_review = ?, dietitian_reviewed_at = NOW()
     WHERE id = ? AND dietitian_rating IS NULL`,
    [rating, review, id],
  );
};

export const updateDietitianNotes = async (id: number, notes: string | null) => {
  await execute('UPDATE appointments SET dietitian_notes = ? WHERE id = ?', [notes, id]);
};

export interface ReviewListRow {
  appointment_id: number;
  appointment_date: string;
  user_rating: number;
  user_review: string | null;
  user_reviewed_at: Date;
  client_name: string;
  client_avatar: string | null;
}

export interface ReviewSummary {
  average_rating: number;
  total_reviews: number;
  breakdown: Record<1 | 2 | 3 | 4 | 5, number>;
}

export const getDietitianReviews = async (
  dietitianId: number,
  rating: number | undefined,
  search: string | undefined,
  page: number,
  limit: number,
) => {
  const offset = (page - 1) * limit;
  const conditions: string[] = ['a.dietitian_id = ?', 'a.user_rating IS NOT NULL'];
  const params: unknown[] = [dietitianId];

  if (rating) { conditions.push('a.user_rating = ?'); params.push(rating); }
  if (search) { conditions.push('COALESCE(u.full_name, a.name) LIKE ?'); params.push(`%${search}%`); }

  const where = conditions.join(' AND ');

  const [summaryRows, rows, countRows] = await Promise.all([
    query<{ average_rating: number; total: number; r1: number; r2: number; r3: number; r4: number; r5: number }>(
      `SELECT
         ROUND(AVG(a.user_rating), 1)          AS average_rating,
         COUNT(*)                               AS total,
         SUM(a.user_rating = 1)                AS r1,
         SUM(a.user_rating = 2)                AS r2,
         SUM(a.user_rating = 3)                AS r3,
         SUM(a.user_rating = 4)                AS r4,
         SUM(a.user_rating = 5)                AS r5
       FROM appointments a
       LEFT JOIN users u ON a.user_id = u.id AND u.is_delete = 0
       WHERE a.dietitian_id = ? AND a.user_rating IS NOT NULL`,
      [dietitianId],
    ),
    query<ReviewListRow>(
      `SELECT
         a.id                                            AS appointment_id,
         DATE_FORMAT(a.appointment_date, '%Y-%m-%d')    AS appointment_date,
         a.user_rating,
         a.user_review,
         a.user_reviewed_at,
         COALESCE(u.full_name, a.name)                  AS client_name,
         u.avatar_url                                   AS client_avatar
       FROM appointments a
       LEFT JOIN users u ON a.user_id = u.id AND u.is_delete = 0
       WHERE ${where}
       ORDER BY a.user_reviewed_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params,
    ),
    query<{ total: number }>(
      `SELECT COUNT(*) AS total
       FROM appointments a
       LEFT JOIN users u ON a.user_id = u.id AND u.is_delete = 0
       WHERE ${where}`,
      params,
    ),
  ]);

  const s = summaryRows[0];
  const summary: ReviewSummary = {
    average_rating: Number(s?.average_rating ?? 0),
    total_reviews:  Number(s?.total ?? 0),
    breakdown: {
      1: Number(s?.r1 ?? 0),
      2: Number(s?.r2 ?? 0),
      3: Number(s?.r3 ?? 0),
      4: Number(s?.r4 ?? 0),
      5: Number(s?.r5 ?? 0),
    },
  };

  return { summary, reviews: rows, total: Number(countRows[0]?.total ?? 0) };
};

export const findFollowUpsByAppointmentId = async (parentId: number) => {
  return query<Appointment>(
    `SELECT ${APPOINTMENT_SELECT} FROM appointments
     WHERE parent_appointment_id = ?
     ORDER BY appointment_date ASC, slot ASC`,
    [parentId],
  );
};

export type FollowUpListTab = 'all' | 'due_today' | 'upcoming' | 'completed' | 'missed';

export interface FollowUpListRow {
  id: number;
  parent_appointment_id: number;
  dietitian_id: number;
  user_id: number | null;
  client_name: string;
  client_avatar: string | null;
  follow_up_type: string | null;
  goal: string | null;
  appointment_date: string;
  slot: string;
  duration: number;
  session_type: string;
  status: string;
  payment_status: string;
  notes: string | null;
  display_status: 'due_today' | 'upcoming' | 'completed' | 'missed';
}

// Auto-mark overdue follow-up appointments (confirmed + past date) as missed
const markOverdueFollowUps = (dietitianId: number) =>
  execute(
    `UPDATE appointments
     SET status = 'missed'
     WHERE dietitian_id = ?
       AND is_follow_up = 1
       AND status = 'confirmed'
       AND appointment_date < CURDATE()`,
    [dietitianId],
  );

export const getFollowUpListSummary = async (dietitianId: number) => {
  await markOverdueFollowUps(dietitianId);

  const [row] = await query<{
    due_today: number;
    upcoming: number;
    completed: number;
    missed: number;
  }>(
    `SELECT
       SUM(status = 'confirmed' AND appointment_date = CURDATE()) AS due_today,
       SUM(status = 'confirmed' AND appointment_date > CURDATE()) AS upcoming,
       SUM(status = 'completed')                                  AS completed,
       SUM(status = 'missed')                                     AS missed
     FROM appointments
     WHERE dietitian_id = ? AND is_follow_up = 1`,
    [dietitianId],
  );

  return {
    due_today:  Number(row?.due_today  ?? 0),
    upcoming:   Number(row?.upcoming   ?? 0),
    completed:  Number(row?.completed  ?? 0),
    missed:     Number(row?.missed     ?? 0),
  };
};

export const listFollowUpAppointments = async (
  dietitianId: number,
  tab: FollowUpListTab,
  search: string | undefined,
  page: number,
  limit: number,
) => {
  await markOverdueFollowUps(dietitianId);

  const offset = (page - 1) * limit;

  const tabCond =
    tab === 'due_today'  ? "AND a.status = 'confirmed' AND a.appointment_date = CURDATE()"
    : tab === 'upcoming'  ? "AND a.status = 'confirmed' AND a.appointment_date > CURDATE()"
    : tab === 'completed' ? "AND a.status = 'completed'"
    : tab === 'missed'    ? "AND a.status = 'missed'"
    : '';

  const searchCond  = search ? "AND COALESCE(u.full_name, a.name) LIKE ?" : '';
  const searchParam = search ? [`%${search}%`] : [];

  const baseParams: unknown[] = [dietitianId, ...searchParam];

  const [rows, countRows] = await Promise.all([
    query<FollowUpListRow>(
      `SELECT
         a.id,
         a.parent_appointment_id,
         a.dietitian_id,
         a.user_id,
         COALESCE(u.full_name, a.name)              AS client_name,
         u.avatar_url                               AS client_avatar,
         a.follow_up_type,
         dp.primary_goal                            AS goal,
         DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointment_date,
         TIME_FORMAT(a.slot, '%H:%i')               AS slot,
         a.duration,
         a.session_type,
         a.status,
         a.payment_status,
         a.notes,
         CASE
           WHEN a.status = 'confirmed' AND a.appointment_date = CURDATE() THEN 'due_today'
           WHEN a.status = 'confirmed' AND a.appointment_date > CURDATE() THEN 'upcoming'
           ELSE a.status
         END                                        AS display_status
       FROM appointments a
       LEFT JOIN users     u  ON a.user_id = u.id AND u.is_delete = 0
       LEFT JOIN diet_plans dp ON dp.appointment_id = a.parent_appointment_id
       WHERE a.dietitian_id = ?
         AND a.is_follow_up = 1
         ${tabCond} ${searchCond}
       ORDER BY
         CASE a.status WHEN 'confirmed' THEN 0 WHEN 'missed' THEN 1 ELSE 2 END ASC,
         a.appointment_date ASC, a.slot ASC
       LIMIT ${limit} OFFSET ${offset}`,
      [...baseParams],
    ),
    query<{ total: number }>(
      `SELECT COUNT(*) AS total
       FROM appointments a
       LEFT JOIN users u ON a.user_id = u.id AND u.is_delete = 0
       WHERE a.dietitian_id = ?
         AND a.is_follow_up = 1
         ${tabCond} ${searchCond}`,
      [...baseParams],
    ),
  ]);

  return { rows, total: Number(countRows[0]?.total ?? 0) };
};

export const hasScheduledFollowUp = async (appointmentId: number) => {
  const rows = await query<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM appointments
     WHERE parent_appointment_id = ? AND status NOT IN ('cancelled', 'missed')`,
    [appointmentId],
  );
  return Number(rows[0]?.cnt ?? 0) > 0;
};

export const updateAppointmentStatusAndPayment = async (
  id: number,
  status: Appointment['status'],
  paymentStatus: Appointment['payment_status'],
) => {
  await execute(
    'UPDATE appointments SET status = ?, payment_status = ? WHERE id = ?',
    [status, paymentStatus, id],
  );
};

// ── Admin queries ─────────────────────────────────────────────────────────────

export interface AdminAppointmentFilters {
  status?: string;
  payment_status?: string;
  session_type?: string;
  dietitian_id?: number;
  date_from?: string;
  date_to?: string;
  search?: string;    // patient name / email / phone
  no_show?: 'user' | 'dietitian' | 'any'; // video calls where someone didn't join
  page?: number;
  limit?: number;
}

export const adminListAppointments = async (filters: AdminAppointmentFilters) => {
  const page  = Math.max(1, filters.page  ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: unknown[]    = [];

  if (filters.status)        { conditions.push('a.status = ?');         params.push(filters.status); }
  if (filters.payment_status){ conditions.push('a.payment_status = ?'); params.push(filters.payment_status); }
  if (filters.session_type)  { conditions.push('a.session_type = ?');   params.push(filters.session_type); }
  if (filters.dietitian_id)  { conditions.push('a.dietitian_id = ?');   params.push(filters.dietitian_id); }
  if (filters.date_from)     { conditions.push('a.appointment_date >= ?'); params.push(filters.date_from); }
  if (filters.date_to)       { conditions.push('a.appointment_date <= ?'); params.push(filters.date_to); }
  if (filters.no_show) {
    conditions.push('a.session_type = \'video_call\'');
    if (filters.no_show === 'user')      conditions.push('a.user_joined_at IS NULL');
    if (filters.no_show === 'dietitian') conditions.push('a.dietitian_joined_at IS NULL');
    if (filters.no_show === 'any')       conditions.push('(a.user_joined_at IS NULL OR a.dietitian_joined_at IS NULL)');
  }
  if (filters.search) {
    conditions.push('(a.name LIKE ? OR a.email LIKE ? OR a.phone LIKE ?)');
    const like = `%${filters.search}%`;
    params.push(like, like, like);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows, countRows] = await Promise.all([
    query<{
      id: number;
      appointment_date: string;
      slot: string;
      duration: number;
      session_type: string;
      status: string;
      payment_status: string;
      fee: number;
      currency: string;
      is_follow_up: number;
      created_at: Date;
      user_joined_at: Date | null;
      dietitian_joined_at: Date | null;
      // patient
      patient_name: string;
      patient_email: string | null;
      patient_phone: string | null;
      // dietitian
      dietitian_id: number;
      dietitian_name: string;
      dietitian_email: string | null;
      dietitian_phone: string | null;
      dietitian_photo: string | null;
    }>(
      `SELECT
         a.id,
         DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointment_date,
         TIME_FORMAT(a.slot, '%H:%i')                AS slot,
         a.duration,
         a.session_type,
         a.status,
         a.payment_status,
         a.fee,
         a.currency,
         a.is_follow_up,
         a.created_at,
         a.user_joined_at,
         a.dietitian_joined_at,
         a.name        AS patient_name,
         a.email       AS patient_email,
         a.phone       AS patient_phone,
         d.id          AS dietitian_id,
         du.full_name  AS dietitian_name,
         du.email      AS dietitian_email,
         du.phone_number AS dietitian_phone,
         d.profile_photo AS dietitian_photo
       FROM appointments a
       JOIN dietitians d  ON a.dietitian_id = d.id
       JOIN users du      ON d.user_id = du.id
       ${where}
       ORDER BY a.appointment_date DESC, a.slot DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params,
    ),
    query<{ total: number }>(
      `SELECT COUNT(*) AS total
       FROM appointments a
       JOIN dietitians d  ON a.dietitian_id = d.id
       JOIN users du      ON d.user_id = du.id
       ${where}`,
      params,
    ),
  ]);

  return {
    appointments: rows.map((r) => ({
      id: r.id,
      appointment_date: r.appointment_date,
      slot: r.slot,
      duration: r.duration,
      session_type: r.session_type,
      status: r.status,
      payment_status: r.payment_status,
      fee: r.fee,
      currency: r.currency,
      is_follow_up: Boolean(r.is_follow_up),
      created_at: r.created_at,
      call_tracking: {
        user_joined_at:      r.user_joined_at ?? null,
        dietitian_joined_at: r.dietitian_joined_at ?? null,
      },
      patient: {
        name: r.patient_name,
        email: r.patient_email,
        phone: r.patient_phone,
      },
      dietitian: {
        id: r.dietitian_id,
        name: r.dietitian_name,
        email: r.dietitian_email,
        phone: r.dietitian_phone,
        photo: r.dietitian_photo,
      },
    })),
    total: countRows[0]?.total ?? 0,
    page,
    limit,
  };
};

export const adminGetAppointmentDetail = async (id: number) => {
  const rows = await query<{
    id: number;
    appointment_date: string;
    slot: string;
    duration: number;
    session_type: string;
    status: string;
    payment_status: string;
    payment_approved_at: Date | null;
    payment_approved_by: number | null;
    payment_id: string | null;
    order_id: string | null;
    fee: number;
    currency: string;
    notes: string | null;
    dietitian_notes: string | null;
    missed_reason: string | null;
    missed_type: string | null;
    user_rating: number | null;
    user_review: string | null;
    user_reviewed_at: Date | null;
    dietitian_rating: number | null;
    dietitian_review: string | null;
    dietitian_reviewed_at: Date | null;
    parent_appointment_id: number | null;
    is_follow_up: number;
    follow_up_type: string | null;
    video_call_status: string;
    recording_url: string | null;
    call_started_at: Date | null;
    call_ended_at: Date | null;
    call_duration_seconds: number | null;
    user_joined_at: Date | null;
    dietitian_joined_at: Date | null;
    created_at: Date;
    updated_at: Date;
    // patient
    patient_name: string;
    patient_email: string | null;
    patient_phone: string | null;
    // dietitian
    dietitian_id: number;
    dietitian_name: string;
    dietitian_email: string | null;
    dietitian_phone: string | null;
    dietitian_phone_code: string | null;
    dietitian_photo: string | null;
    dietitian_city: string;
    dietitian_state: string;
  }>(
    `SELECT
       a.id,
       DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointment_date,
       TIME_FORMAT(a.slot, '%H:%i')                AS slot,
       a.duration, a.session_type,
       a.status, a.payment_status, a.payment_approved_at, a.payment_approved_by,
       a.payment_id, a.order_id,
       a.fee, a.currency,
       a.notes, a.dietitian_notes, a.missed_reason, a.missed_type,
       a.user_rating, a.user_review, a.user_reviewed_at,
       a.dietitian_rating, a.dietitian_review, a.dietitian_reviewed_at,
       a.parent_appointment_id, a.is_follow_up, a.follow_up_type,
       a.video_call_status, a.recording_url,
       a.call_started_at, a.call_ended_at, a.call_duration_seconds,
       a.user_joined_at, a.dietitian_joined_at,
       a.created_at, a.updated_at,
       a.name        AS patient_name,
       a.email       AS patient_email,
       a.phone       AS patient_phone,
       d.id          AS dietitian_id,
       du.full_name  AS dietitian_name,
       du.email      AS dietitian_email,
       du.phone_number  AS dietitian_phone,
       du.phone_code    AS dietitian_phone_code,
       d.profile_photo  AS dietitian_photo,
       d.city           AS dietitian_city,
       d.state          AS dietitian_state
     FROM appointments a
     JOIN dietitians d ON a.dietitian_id = d.id
     JOIN users du     ON d.user_id = du.id
     WHERE a.id = ?
     LIMIT 1`,
    [id],
  );

  if (!rows[0]) return null;
  const r = rows[0];

  // Follow-ups of this appointment
  const followUps = await query<{ id: number; appointment_date: string; slot: string; status: string }>(
    `SELECT id,
       DATE_FORMAT(appointment_date, '%Y-%m-%d') AS appointment_date,
       TIME_FORMAT(slot, '%H:%i') AS slot,
       status
     FROM appointments
     WHERE parent_appointment_id = ?
       AND status <> 'cancelled'
     ORDER BY appointment_date ASC, slot ASC`,
    [id],
  );

  return {
    id: r.id,
    appointment_date: r.appointment_date,
    slot: r.slot,
    duration: r.duration,
    session_type: r.session_type,
    status: r.status,
    payment_status: r.payment_status,
    payment_approved_at: r.payment_approved_at ?? null,
    payment_approved_by: r.payment_approved_by ?? null,
    payment_id: r.payment_id,
    order_id: r.order_id,
    fee: r.fee,
    currency: r.currency,
    notes: r.notes,
    dietitian_notes: r.dietitian_notes,
    missed_reason: r.missed_reason,
    missed_type: r.missed_type,
    user_rating: r.user_rating,
    user_review: r.user_review,
    user_reviewed_at: r.user_reviewed_at,
    dietitian_rating: r.dietitian_rating,
    dietitian_review: r.dietitian_review,
    dietitian_reviewed_at: r.dietitian_reviewed_at,
    parent_appointment_id: r.parent_appointment_id,
    is_follow_up: Boolean(r.is_follow_up),
    follow_up_type: r.follow_up_type,
    video_call_status: r.video_call_status,
    recording_url: r.recording_url,
    call_started_at: r.call_started_at,
    call_ended_at: r.call_ended_at,
    call_duration_seconds: r.call_duration_seconds,
    call_tracking: {
      user_joined_at:      r.user_joined_at ?? null,
      dietitian_joined_at: r.dietitian_joined_at ?? null,
    },
    created_at: r.created_at,
    updated_at: r.updated_at,
    patient: {
      name: r.patient_name,
      email: r.patient_email,
      phone: r.patient_phone,
    },
    dietitian: {
      id: r.dietitian_id,
      name: r.dietitian_name,
      email: r.dietitian_email,
      phone: r.dietitian_phone ? `${r.dietitian_phone_code ?? ''}${r.dietitian_phone}`.trim() : null,
      photo: r.dietitian_photo,
      city: r.dietitian_city,
      state: r.dietitian_state,
    },
    follow_ups: followUps,
  };
};

// ── Admin payment approval queries ────────────────────────────────────────────

const ADMIN_PAYMENT_SELECT = `
  SELECT
    a.id,
    DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointment_date,
    TIME_FORMAT(a.slot, '%H:%i')                AS slot,
    a.duration,
    a.session_type,
    a.status,
    a.payment_status,
    a.fee,
    a.currency,
    a.missed_type,
    a.user_joined_at,
    a.dietitian_joined_at,
    a.created_at,
    a.name          AS patient_name,
    a.email         AS patient_email,
    a.phone         AS patient_phone,
    d.id            AS dietitian_id,
    du.full_name    AS dietitian_name,
    du.email        AS dietitian_email,
    CONCAT(COALESCE(du.phone_code,''), du.phone_number) AS dietitian_phone,
    d.profile_photo AS dietitian_photo
  FROM appointments a
  JOIN dietitians d  ON a.dietitian_id = d.id
  JOIN users du      ON d.user_id = du.id
`;

const mapPendingRow = (r: {
  id: number; appointment_date: string; slot: string; duration: number;
  session_type: string; status: string; payment_status: string;
  fee: number; currency: string; missed_type: string | null;
  user_joined_at: Date | null; dietitian_joined_at: Date | null;
  created_at: Date;
  patient_name: string; patient_email: string | null; patient_phone: string | null;
  dietitian_id: number; dietitian_name: string; dietitian_email: string | null;
  dietitian_phone: string; dietitian_photo: string | null;
}) => ({
  id:               r.id,
  appointment_date: r.appointment_date,
  slot:             r.slot,
  duration:         r.duration,
  session_type:     r.session_type,
  status:           r.status,
  payment_status:   r.payment_status,
  fee:              r.fee,
  currency:         r.currency,
  is_no_show:       r.missed_type === 'patient_no_show',
  missed_type:      r.missed_type,
  created_at:       r.created_at,
  call_tracking: {
    user_joined_at:      r.user_joined_at ?? null,
    dietitian_joined_at: r.dietitian_joined_at ?? null,
  },
  patient: {
    name:  r.patient_name,
    email: r.patient_email,
    phone: r.patient_phone,
  },
  dietitian: {
    id:    r.dietitian_id,
    name:  r.dietitian_name,
    email: r.dietitian_email,
    phone: r.dietitian_phone || null,
    photo: r.dietitian_photo,
  },
});

// Missed appointments with missed_type set but no financial action taken yet (step 2 pending)
export const adminGetPendingNoShowApprovals = async (
  page = 1,
  limit = 20,
  search?: string,
) => {
  const safePage  = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  const offset    = (safePage - 1) * safeLimit;

  const searchCond  = search ? 'AND (a.name LIKE ? OR a.email LIKE ? OR a.phone LIKE ?)' : '';
  const searchParam = search ? [`%${search}%`, `%${search}%`, `%${search}%`] : [];

  type PendingRow = Parameters<typeof mapPendingRow>[0];

  const [rows, countRows] = await Promise.all([
    query<PendingRow>(
      `${ADMIN_PAYMENT_SELECT}
       WHERE a.status = 'missed'
         AND a.missed_type IS NOT NULL
         AND a.payment_approved_at IS NULL
         ${searchCond}
       ORDER BY a.appointment_date DESC, a.slot DESC
       LIMIT ${safeLimit} OFFSET ${offset}`,
      searchParam,
    ),
    query<{ total: number }>(
      `SELECT COUNT(*) AS total
       FROM appointments a
       JOIN dietitians d  ON a.dietitian_id = d.id
       JOIN users du      ON d.user_id = du.id
       WHERE a.status = 'missed'
         AND a.missed_type IS NOT NULL
         AND a.payment_approved_at IS NULL
         ${searchCond}`,
      searchParam,
    ),
  ]);

  return {
    appointments: rows.map(mapPendingRow),
    total: Number(countRows[0]?.total ?? 0),
    page:  safePage,
    limit: safeLimit,
  };
};

// Appointments completed + paid but admin has not approved payment yet
export const adminGetPendingApprovals = async (
  page = 1,
  limit = 20,
  search?: string,
) => {
  const safePage  = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  const offset    = (safePage - 1) * safeLimit;

  const searchCond  = search ? 'AND (a.name LIKE ? OR a.email LIKE ? OR a.phone LIKE ?)' : '';
  const searchParam = search ? [`%${search}%`, `%${search}%`, `%${search}%`] : [];

  type PendingRow = Parameters<typeof mapPendingRow>[0];

  const [rows, countRows] = await Promise.all([
    query<PendingRow>(
      `${ADMIN_PAYMENT_SELECT}
       WHERE a.status = 'completed'
         AND a.payment_status = 'paid'
         AND a.payment_approved_at IS NULL
         ${searchCond}
       ORDER BY a.appointment_date DESC, a.slot DESC
       LIMIT ${safeLimit} OFFSET ${offset}`,
      searchParam,
    ),
    query<{ total: number }>(
      `SELECT COUNT(*) AS total
       FROM appointments a
       JOIN dietitians d  ON a.dietitian_id = d.id
       JOIN users du      ON d.user_id = du.id
       WHERE a.status = 'completed'
         AND a.payment_status = 'paid'
         AND a.payment_approved_at IS NULL
         ${searchCond}`,
      searchParam,
    ),
  ]);

  return {
    appointments: rows.map(mapPendingRow),
    total: Number(countRows[0]?.total ?? 0),
    page:  safePage,
    limit: safeLimit,
  };
};

// Appointments whose payment has already been approved — joined with wallet tx for actual credited amount
export const adminGetPaymentHistory = async (
  page = 1,
  limit = 20,
  search?: string,
  dietitian_id?: number,
  date_from?: string,
  date_to?: string,
) => {
  const safePage  = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  const offset    = (safePage - 1) * safeLimit;

  const conditions: string[] = [
    "a.payment_approved_at IS NOT NULL",
  ];
  const params: unknown[] = [];

  if (search) {
    conditions.push('(a.name LIKE ? OR a.email LIKE ? OR a.phone LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (dietitian_id) { conditions.push('a.dietitian_id = ?'); params.push(dietitian_id); }
  if (date_from)    { conditions.push('a.appointment_date >= ?'); params.push(date_from); }
  if (date_to)      { conditions.push('a.appointment_date <= ?'); params.push(date_to); }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const [rows, countRows] = await Promise.all([
    query<{
      id: number; appointment_date: string; slot: string; duration: number;
      session_type: string; status: string; payment_status: string;
      fee: number; currency: string; missed_type: string | null;
      payment_approved_at: Date; payment_approved_by: number | null;
      approved_by_name: string | null;
      user_joined_at: Date | null; dietitian_joined_at: Date | null;
      created_at: Date;
      patient_name: string; patient_email: string | null; patient_phone: string | null;
      dietitian_id: number; dietitian_name: string; dietitian_email: string | null;
      dietitian_phone: string; dietitian_photo: string | null;
      // from wallet transaction
      tx_source: string | null;
      tx_gross_amount: number | null;
      tx_commission: number | null;
      tx_net_amount: number | null;
      tx_created_at: Date | null;
    }>(
      `SELECT
         a.id,
         DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointment_date,
         TIME_FORMAT(a.slot, '%H:%i')                AS slot,
         a.duration, a.session_type, a.status, a.payment_status,
         a.fee, a.currency, a.missed_type,
         a.payment_approved_at, a.payment_approved_by,
         approver.full_name                          AS approved_by_name,
         a.user_joined_at, a.dietitian_joined_at,
         a.created_at,
         a.name          AS patient_name,
         a.email         AS patient_email,
         a.phone         AS patient_phone,
         d.id            AS dietitian_id,
         du.full_name    AS dietitian_name,
         du.email        AS dietitian_email,
         CONCAT(COALESCE(du.phone_code,''), du.phone_number) AS dietitian_phone,
         d.profile_photo AS dietitian_photo,
         dwt.source      AS tx_source,
         dwt.gross_amount AS tx_gross_amount,
         dwt.commission  AS tx_commission,
         dwt.net_amount  AS tx_net_amount,
         dwt.created_at  AS tx_created_at
       FROM appointments a
       JOIN dietitians d   ON a.dietitian_id = d.id
       JOIN users du       ON d.user_id = du.id
       LEFT JOIN users approver ON approver.id = a.payment_approved_by
       LEFT JOIN dietitian_wallet_transactions dwt
         ON dwt.appointment_id = a.id
         AND dwt.source IN ('appointment_completion', 'no_show_compensation', 'no_show_penalty')
       ${where}
       ORDER BY a.payment_approved_at DESC
       LIMIT ${safeLimit} OFFSET ${offset}`,
      params,
    ),
    query<{ total: number }>(
      `SELECT COUNT(*) AS total
       FROM appointments a
       JOIN dietitians d  ON a.dietitian_id = d.id
       JOIN users du      ON d.user_id = du.id
       ${where}`,
      params,
    ),
  ]);

  return {
    appointments: rows.map((r) => ({
      id:               r.id,
      appointment_date: r.appointment_date,
      slot:             r.slot,
      duration:         r.duration,
      session_type:     r.session_type,
      status:           r.status,
      payment_status:   r.payment_status,
      fee:              r.fee,
      currency:         r.currency,
      is_no_show:       r.missed_type === 'patient_no_show',
      missed_type:      r.missed_type,
      payment_approved_at: r.payment_approved_at,
      approved_by: {
        id:   r.payment_approved_by,
        name: r.approved_by_name ?? null,
      },
      created_at: r.created_at,
      call_tracking: {
        user_joined_at:      r.user_joined_at ?? null,
        dietitian_joined_at: r.dietitian_joined_at ?? null,
      },
      patient: {
        name:  r.patient_name,
        email: r.patient_email,
        phone: r.patient_phone,
      },
      dietitian: {
        id:    r.dietitian_id,
        name:  r.dietitian_name,
        email: r.dietitian_email,
        phone: r.dietitian_phone || null,
        photo: r.dietitian_photo,
      },
      payment_breakdown: r.tx_source ? {
        source:           r.tx_source,
        type:             r.tx_source === 'no_show_penalty' ? 'debit' : 'credit',
        gross_amount:     Number(r.tx_gross_amount),
        commission:       Number(r.tx_commission),
        net_amount:       Number(r.tx_net_amount),
        // 'credit' → amount paid to dietitian; 'debit' → penalty taken from dietitian
        amount_credited:  r.tx_source === 'no_show_penalty' ? 0           : Number(r.tx_net_amount),
        penalty_deducted: r.tx_source === 'no_show_penalty' ? Number(r.tx_net_amount) : 0,
        processed_at:     r.tx_created_at,
      } : null,
    })),
    total: Number(countRows[0]?.total ?? 0),
    page:  safePage,
    limit: safeLimit,
  };
};
