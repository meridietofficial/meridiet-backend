import 'dotenv/config';
import { query, execute, disconnectDatabase } from '../config/database';

// Fixes an appointment stuck as 'unpaid' when Razorpay already captured the payment.
// Usage:
//   RAZORPAY_PAYMENT_ID=pay_TlUEQUNNdVNkq2 npx ts-node src/scripts/fixUnpaidAppointment.ts

const RAZORPAY_PAYMENT_ID = process.env.RAZORPAY_PAYMENT_ID ?? 'pay_TlUEQUNNdVNkq2';

const run = async () => {
  console.log(`\nLooking up appointment for patient SHRUTIKA JANGAM (09-10-2026)...\n`);

  const rows = await query<{
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
    appointment_date: string;
    slot: string;
    status: string;
    payment_status: string;
    payment_id: string | null;
    order_id: string | null;
  }>(`
    SELECT id, name, email, phone,
           DATE_FORMAT(appointment_date, '%Y-%m-%d') AS appointment_date,
           TIME_FORMAT(slot, '%H:%i') AS slot,
           status, payment_status, payment_id, order_id
    FROM appointments
    WHERE name LIKE '%SHRUTIKA%'
      AND appointment_date = '2026-10-09'
    LIMIT 5
  `);

  if (rows.length === 0) {
    console.error('No appointment found for SHRUTIKA on 2026-10-09. Trying phone number search...');

    const byPhone = await query<{
      id: number; name: string; appointment_date: string; slot: string;
      status: string; payment_status: string; payment_id: string | null; order_id: string | null;
    }>(`
      SELECT id, name, DATE_FORMAT(appointment_date, '%Y-%m-%d') AS appointment_date,
             TIME_FORMAT(slot, '%H:%i') AS slot,
             status, payment_status, payment_id, order_id
      FROM appointments
      WHERE phone LIKE '%7020601405%'
      ORDER BY created_at DESC LIMIT 5
    `);

    if (byPhone.length === 0) {
      console.error('Still no match. Exiting.');
      process.exit(1);
    }

    byPhone.forEach(r => console.log(r));
    process.exit(0);
  }

  console.log('Found appointment(s):');
  rows.forEach(r => console.log(r));

  const apt = rows[0];

  if (apt.payment_status === 'paid') {
    console.log('\nAppointment is already marked as paid. Nothing to do.');
    await disconnectDatabase();
    return;
  }

  if (!apt.order_id) {
    console.error('\nAppointment has no order_id — cannot link payment. Aborting.');
    process.exit(1);
  }

  console.log(`\nFixing appointment ID=${apt.id}...`);

  const result = await execute(
    `UPDATE appointments
     SET payment_id     = ?,
         payment_status = 'paid',
         status         = 'confirmed'
     WHERE id = ?`,
    [RAZORPAY_PAYMENT_ID, apt.id],
  );

  if (result.affectedRows === 0) {
    console.error('Update affected 0 rows. Something went wrong.');
    process.exit(1);
  }

  console.log(`\n✅ Done! Appointment ${apt.id} (${apt.name}, ${apt.appointment_date} ${apt.slot})`);
  console.log(`   payment_status → paid`);
  console.log(`   status         → confirmed`);
  console.log(`   payment_id     → ${RAZORPAY_PAYMENT_ID}\n`);

  await disconnectDatabase();
};

run().catch((err) => {
  console.error('Script error:', err);
  process.exit(1);
});
