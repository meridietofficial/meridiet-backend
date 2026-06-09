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
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  payment_status: 'unpaid' | 'paid' | 'refunded';
  payment_id: string | null;
  order_id: string | null;
  notes: string | null;
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
  notes?: string | null;
}

// Columns selected in every read query — normalises TIME -> "HH:MM" and DATE -> "YYYY-MM-DD"
const APPOINTMENT_SELECT = `
  id, dietitian_id, user_id, name, email, phone,
  DATE_FORMAT(appointment_date, '%Y-%m-%d') AS appointment_date,
  TIME_FORMAT(slot, '%H:%i')                AS slot,
  duration, session_type,
  fee, currency, status, payment_status, payment_id, order_id, notes,
  agora_channel_name, agora_resource_id, agora_recording_sid, agora_recording_uid,
  video_call_status, recording_url,
  call_started_at, call_ended_at, call_duration_seconds,
  created_at, updated_at
`;

export const createAppointment = async (data: CreateAppointmentData) => {
  const result = await execute(
    `INSERT INTO appointments
       (dietitian_id, user_id, name, email, phone, appointment_date, slot, duration, session_type, fee, currency, order_id, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      data.notes ?? null,
    ],
  );
  const rows = await query<Appointment>(
    `SELECT ${APPOINTMENT_SELECT} FROM appointments WHERE id = ? LIMIT 1`,
    [result.insertId],
  );
  return rows[0] ?? null;
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
    }>(
      `SELECT
         a.id, a.dietitian_id, a.user_id, a.name, a.email, a.phone,
         DATE_FORMAT(a.appointment_date, '%Y-%m-%d')  AS appointment_date,
         TIME_FORMAT(a.slot, '%H:%i')                 AS slot,
         a.fee, a.currency, a.status, a.payment_status,
         a.payment_id, a.order_id, a.notes, a.created_at, a.updated_at,
         d.id                                          AS dietitian_profile_id,
         u.full_name                                   AS dietitian_full_name,
         COALESCE(u.avatar_url, d.profile_photo)       AS dietitian_avatar_url,
         d.city                                        AS dietitian_city,
         d.state                                       AS dietitian_state
       FROM appointments a
       JOIN dietitians d ON a.dietitian_id = d.id
       JOIN users u ON d.user_id = u.id
       WHERE a.user_id = ?
       ORDER BY a.appointment_date DESC, a.slot ASC
       LIMIT ${limit} OFFSET ${offset}`,
      [userId],
    ),
    query<{ total: number }>('SELECT COUNT(*) AS total FROM appointments WHERE user_id = ?', [userId]),
  ]);

  const appointments: AppointmentWithDietitian[] = rows.map((r) => ({
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
    agora_channel_name: r.agora_channel_name,
    agora_resource_id: r.agora_resource_id,
    agora_recording_sid: r.agora_recording_sid,
    agora_recording_uid: r.agora_recording_uid,
    video_call_status: r.video_call_status,
    recording_url: r.recording_url,
    call_started_at: r.call_started_at,
    call_ended_at: r.call_ended_at,
    call_duration_seconds: r.call_duration_seconds,
    created_at: r.created_at,
    updated_at: r.updated_at,
    dietitian: {
      id: r.dietitian_profile_id,
      full_name: r.dietitian_full_name,
      avatar_url: r.dietitian_avatar_url,
      city: r.dietitian_city,
      state: r.dietitian_state,
    },
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
  const whereStatus = status ? 'AND status = ?' : '';
  const countParams: unknown[] = status ? [dietitianId, status] : [dietitianId];

  const [rows, countRows] = await Promise.all([
    query<Appointment>(
      `SELECT ${APPOINTMENT_SELECT} FROM appointments
       WHERE dietitian_id = ? ${whereStatus}
       ORDER BY appointment_date DESC, slot ASC LIMIT ${limit} OFFSET ${offset}`,
      countParams,
    ),
    query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM appointments WHERE dietitian_id = ? ${whereStatus}`,
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

export const isSlotTaken = async (dietitian_id: number, appointment_date: string, slot: string) => {
  const rows = await query<{ id: number }>(
    `SELECT id FROM appointments
      WHERE dietitian_id = ? AND appointment_date = ? AND slot = ? AND status <> 'cancelled'
      LIMIT 1`,
    [dietitian_id, appointment_date, slot],
  );
  return rows.length > 0;
};

export interface DietitianClient {
  user_id: number | null;
  name: string;
  avatar_url: string | null;
  total_appointments: number;
  last_appointment_date: string | null;
  pending: number;
  confirmed: number;
  completed: number;
  cancelled: number;
}

export const getClientsByDietitianId = async (dietitianId: number, page = 1, limit = 10) => {
  const offset = (page - 1) * limit;

  const [rows, countRows] = await Promise.all([
    query<DietitianClient>(
      `SELECT
         a.user_id,
         COALESCE(u.full_name, a.name)                              AS name,
         u.avatar_url,
         COUNT(*)                                                    AS total_appointments,
         MAX(DATE_FORMAT(a.appointment_date, '%Y-%m-%d'))           AS last_appointment_date,
         SUM(a.status = 'pending')                                  AS pending,
         SUM(a.status = 'confirmed')                                AS confirmed,
         SUM(a.status = 'completed')                                AS completed,
         SUM(a.status = 'cancelled')                                AS cancelled
       FROM appointments a
       LEFT JOIN users u ON a.user_id = u.id AND u.is_delete = 0
       WHERE a.dietitian_id = ?
       GROUP BY a.user_id, COALESCE(u.full_name, a.name), u.avatar_url
       ORDER BY last_appointment_date DESC
       LIMIT ${limit} OFFSET ${offset}`,
      [dietitianId],
    ),
    query<{ total: number }>(
      `SELECT COUNT(DISTINCT a.user_id, COALESCE(u.full_name, a.name)) AS total
       FROM appointments a
       LEFT JOIN users u ON a.user_id = u.id AND u.is_delete = 0
       WHERE a.dietitian_id = ?`,
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
}

export const getDietitianSessionsList = async (
  dietitianId: number,
  tab: 'all' | 'upcoming' | 'completed' | 'cancelled',
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
    : "";

  const [summaryRows, rows, countRows] = await Promise.all([
    query<{ total: number; upcoming: number; completed: number; cancelled: number; pending: number }>(
      `SELECT
         COUNT(*)                      AS total,
         SUM(a.status = 'confirmed')   AS upcoming,
         SUM(a.status = 'completed')   AS completed,
         SUM(a.status = 'cancelled')   AS cancelled,
         SUM(a.status = 'pending')     AS pending
       FROM appointments a
       LEFT JOIN users u ON a.user_id = u.id AND u.is_delete = 0
       WHERE a.dietitian_id = ? ${searchCond}`,
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
         END AS session_number
       FROM appointments a
       LEFT JOIN users u ON a.user_id = u.id AND u.is_delete = 0
       WHERE a.dietitian_id = ? ${tabCond} ${searchCond}
       ORDER BY a.appointment_date ASC, a.slot ASC
       LIMIT ${limit} OFFSET ${offset}`,
      [dietitianId, ...searchParam],
    ),
    query<{ total: number }>(
      `SELECT COUNT(*) AS total
       FROM appointments a
       LEFT JOIN users u ON a.user_id = u.id AND u.is_delete = 0
       WHERE a.dietitian_id = ? ${tabCond} ${searchCond}`,
      [dietitianId, ...searchParam],
    ),
  ]);

  return {
    summary: {
      all:       Number(summaryRows[0]?.total    ?? 0),
      upcoming:  Number(summaryRows[0]?.upcoming ?? 0),
      completed: Number(summaryRows[0]?.completed ?? 0),
      cancelled: Number(summaryRows[0]?.cancelled ?? 0),
      pending:   Number(summaryRows[0]?.pending  ?? 0),
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
       AND status <> 'cancelled'`,
    [dietitian_id, fromDate],
  );
};

// ── Agora video call helpers ──────────────────────────────────────────────────

// Called immediately when a participant clicks "End Call" — saves duration right away.
// The Agora webhook will later fill in recording_url without overwriting call_ended_at.
export const markCallLeft = async (id: number) => {
  await execute(
    `UPDATE appointments
     SET status                = 'completed',
         video_call_status     = 'ended',
         call_ended_at         = COALESCE(call_ended_at, NOW()),
         call_duration_seconds = TIMESTAMPDIFF(SECOND, call_started_at, COALESCE(call_ended_at, NOW()))
     WHERE id = ? AND video_call_status = 'ongoing'`,
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
     SET status                = 'completed',
         video_call_status     = 'ended',
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
