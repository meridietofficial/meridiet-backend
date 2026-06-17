import { query, execute } from '../config/database';

export interface RescheduleHistory {
  id: number;
  appointment_id: number;
  rescheduled_by: number;
  rescheduled_by_name: string;
  previous_date: string;
  previous_slot: string;
  new_date: string;
  new_slot: string;
  reason: string | null;
  created_at: Date;
}

export const createRescheduleHistory = async (data: {
  appointment_id: number;
  rescheduled_by: number;
  previous_date: string;
  previous_slot: string;
  new_date: string;
  new_slot: string;
  reason?: string | null;
}) => {
  await execute(
    `INSERT INTO appointment_reschedule_history
       (appointment_id, rescheduled_by, previous_date, previous_slot, new_date, new_slot, reason)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.appointment_id,
      data.rescheduled_by,
      data.previous_date,
      data.previous_slot,
      data.new_date,
      data.new_slot,
      data.reason ?? null,
    ],
  );
};

export const getRescheduleHistory = async (appointmentId: number) => {
  return query<RescheduleHistory>(
    `SELECT
       h.id,
       h.appointment_id,
       h.rescheduled_by,
       u.full_name       AS rescheduled_by_name,
       DATE_FORMAT(h.previous_date, '%Y-%m-%d') AS previous_date,
       TIME_FORMAT(h.previous_slot, '%H:%i')    AS previous_slot,
       DATE_FORMAT(h.new_date, '%Y-%m-%d')      AS new_date,
       TIME_FORMAT(h.new_slot, '%H:%i')         AS new_slot,
       h.reason,
       h.created_at
     FROM appointment_reschedule_history h
     JOIN users u ON h.rescheduled_by = u.id
     WHERE h.appointment_id = ?
     ORDER BY h.created_at ASC`,
    [appointmentId],
  );
};
