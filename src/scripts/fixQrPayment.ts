import 'dotenv/config';
import { query, execute, disconnectDatabase } from '../config/database';

// Marks an appointment as paid for a user who paid via QR (offline/UPI) rather than
// through the Razorpay website flow, so no razorpay_payment_id exists.
// Usage:
//   ORDER_ID=order_ToyDZ5faEEUrrD npx ts-node src/scripts/fixQrPayment.ts

const ORDER_ID = process.env.ORDER_ID ?? 'order_ToyDZ5faEEUrrD';
const PAYMENT_ID = 'manual_admin_completion';

const run = async () => {
  console.log(`\nLooking up appointment for order_id: ${ORDER_ID}\n`);

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
    fee: number;
  }>(`
    SELECT id, name, email, phone,
           DATE_FORMAT(appointment_date, '%Y-%m-%d') AS appointment_date,
           TIME_FORMAT(slot, '%H:%i') AS slot,
           status, payment_status, payment_id, order_id, fee
    FROM appointments
    WHERE order_id = ?
    LIMIT 1
  `, [ORDER_ID]);

  if (rows.length === 0) {
    console.error(`No appointment found for order_id = ${ORDER_ID}. Exiting.`);
    process.exit(1);
  }

  const apt = rows[0];
  console.log('Found appointment:');
  console.log(apt);

  if (apt.payment_status === 'paid') {
    console.log('\nAppointment is already marked as paid. Nothing to do.');
    await disconnectDatabase();
    return;
  }

  console.log(`\nMarking appointment ID=${apt.id} (${apt.name}) as paid via manual_admin_completion...`);

  const result = await execute(
    `UPDATE appointments
     SET payment_id     = ?,
         payment_status = 'paid',
         status         = 'confirmed'
     WHERE id = ?`,
    [PAYMENT_ID, apt.id],
  );

  if (result.affectedRows === 0) {
    console.error('Update affected 0 rows. Something went wrong.');
    process.exit(1);
  }

  console.log(`\n✅ Done! Appointment ${apt.id} (${apt.name}, ${apt.appointment_date} ${apt.slot})`);
  console.log(`   payment_status → paid`);
  console.log(`   status         → confirmed`);
  console.log(`   payment_id     → ${PAYMENT_ID}\n`);

  await disconnectDatabase();
};

run().catch((err) => {
  console.error('Script error:', err);
  process.exit(1);
});
