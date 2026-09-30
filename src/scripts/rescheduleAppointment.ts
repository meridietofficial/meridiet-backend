import 'dotenv/config';
import { query, execute, disconnectDatabase } from '../config/database';

// Usage:
//   PAYMENT_ID=pay_ThR8eeMm6bvac1 NEW_DATE=2026-09-29 NEW_SLOT=19:30 npx ts-node src/scripts/rescheduleAppointment.ts

const run = async () => {
  const paymentId = process.env.PAYMENT_ID;
  const newDate   = process.env.NEW_DATE;
  const newSlot   = process.env.NEW_SLOT;

  if (!paymentId || !newDate || !newSlot) {
    console.error('Usage: PAYMENT_ID=<id> NEW_DATE=YYYY-MM-DD NEW_SLOT=HH:MM npx ts-node src/scripts/rescheduleAppointment.ts');
    process.exit(1);
  }

  console.log(`\nLooking up appointment with payment_id: ${paymentId}...\n`);

  const rows = await query<{
    id: number; name: string; email: string | null;
    appointment_date: string; slot: string; status: string;
    payment_status: string; missed_type: string | null;
  }>(
    `SELECT id, name, email,
       DATE_FORMAT(appointment_date, '%Y-%m-%d') AS appointment_date,
       TIME_FORMAT(slot, '%H:%i') AS slot,
       status, payment_status, missed_type
     FROM appointments WHERE payment_id = ? LIMIT 1`,
    [paymentId],
  );

  if (!rows[0]) {
    console.error(`No appointment found with payment_id=${paymentId}`);
    process.exit(1);
  }

  const appt = rows[0];
  console.log('Found appointment:');
  console.log(`  ID:      ${appt.id}`);
  console.log(`  Patient: ${appt.name} (${appt.email ?? 'no email'})`);
  console.log(`  Current: ${appt.appointment_date} @ ${appt.slot}`);
  console.log(`  Status:  ${appt.status} / payment: ${appt.payment_status}`);
  console.log(`  Missed type: ${appt.missed_type ?? 'none'}\n`);

  // Check if target slot is already taken (exclude this appointment)
  const conflict = await query<{ id: number }>(
    `SELECT id FROM appointments
     WHERE appointment_date = ? AND slot = ?
       AND status NOT IN ('cancelled', 'missed')
       AND (payment_status <> 'unpaid' OR status = 'confirmed')
       AND id <> ?
     LIMIT 1`,
    [newDate, newSlot, appt.id],
  );

  if (conflict.length > 0) {
    console.error(`Slot ${newDate} @ ${newSlot} is already taken by appointment id=${conflict[0].id}`);
    process.exit(1);
  }

  // Reschedule: set date+slot, status=confirmed, clear missed_type
  await execute(
    `UPDATE appointments
     SET appointment_date = ?, slot = ?, status = 'confirmed', missed_type = NULL
     WHERE id = ?`,
    [newDate, newSlot, appt.id],
  );

  console.log(`Rescheduled appointment #${appt.id} → ${newDate} @ ${newSlot} (status: confirmed, missed_type cleared)`);
};

run()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => disconnectDatabase());
