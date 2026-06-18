import 'dotenv/config';
import { pool, query, execute } from '../config/database';

const run = async () => {
  // 1. Find all soft-deleted users
  const deletedUsers = await query<{ id: number; role: string; full_name: string }>(
    `SELECT id, role, full_name FROM users WHERE is_delete = 1`,
  );

  if (deletedUsers.length === 0) {
    console.log('No soft-deleted users found. Nothing to purge.');
    await pool.end();
    return;
  }

  const userIds = deletedUsers.map((u) => u.id);
  console.log(`Found ${deletedUsers.length} soft-deleted user(s):`);
  deletedUsers.forEach((u) => console.log(`  - id=${u.id} role=${u.role} name=${u.full_name}`));

  // 2. Find dietitian profile IDs for deleted users who are dietitians
  const dietitianRows = await query<{ id: number; user_id: number }>(
    `SELECT id, user_id FROM dietitians WHERE user_id IN (${userIds.map(() => '?').join(',')})`,
    userIds,
  );
  const dietitianIds = dietitianRows.map((d) => d.id);
  console.log(`\nLinked dietitian profiles: ${dietitianIds.length}`);

  // 3. Find all appointment IDs tied to these users or dietitians
  const appointmentConditions: string[] = [];
  const appointmentParams: unknown[] = [];

  if (userIds.length > 0) {
    appointmentConditions.push(`user_id IN (${userIds.map(() => '?').join(',')})`);
    appointmentParams.push(...userIds);
  }
  if (dietitianIds.length > 0) {
    appointmentConditions.push(`dietitian_id IN (${dietitianIds.map(() => '?').join(',')})`);
    appointmentParams.push(...dietitianIds);
  }

  let appointmentIds: number[] = [];
  if (appointmentConditions.length > 0) {
    const apptRows = await query<{ id: number }>(
      `SELECT id FROM appointments WHERE ${appointmentConditions.join(' OR ')}`,
      appointmentParams,
    );
    appointmentIds = apptRows.map((a) => a.id);
  }
  console.log(`Linked appointments: ${appointmentIds.length}`);

  // ── Deletion (order matters — child tables before parents) ──────────────────

  // 4. appointment_reschedule_history (FK → appointments.id + users.id via rescheduled_by)
  if (appointmentIds.length > 0) {
    const ph = appointmentIds.map(() => '?').join(',');
    const r = await execute(
      `DELETE FROM appointment_reschedule_history WHERE appointment_id IN (${ph})`,
      appointmentIds,
    );
    console.log(`\nDeleted appointment_reschedule_history rows: ${r.affectedRows}`);
  }

  // 5. dietitian_wallet_transactions (FK → dietitians.id + appointments.id)
  if (dietitianIds.length > 0) {
    const ph = dietitianIds.map(() => '?').join(',');
    const r = await execute(
      `DELETE FROM dietitian_wallet_transactions WHERE dietitian_id IN (${ph})`,
      dietitianIds,
    );
    console.log(`Deleted dietitian_wallet_transactions rows: ${r.affectedRows}`);
  }

  // 6. dietitian_withdrawals (FK → dietitians.id + dietitian_payment_accounts.id)
  if (dietitianIds.length > 0) {
    const ph = dietitianIds.map(() => '?').join(',');
    const r = await execute(
      `DELETE FROM dietitian_withdrawals WHERE dietitian_id IN (${ph})`,
      dietitianIds,
    );
    console.log(`Deleted dietitian_withdrawals rows: ${r.affectedRows}`);
  }

  // 7. dietitian_payment_accounts (FK → dietitians.id)
  if (dietitianIds.length > 0) {
    const ph = dietitianIds.map(() => '?').join(',');
    const r = await execute(
      `DELETE FROM dietitian_payment_accounts WHERE dietitian_id IN (${ph})`,
      dietitianIds,
    );
    console.log(`Deleted dietitian_payment_accounts rows: ${r.affectedRows}`);
  }

  // 8. diet_plans (FK → users.id + dietitians.id + appointments.id)
  {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (userIds.length > 0) {
      conditions.push(`user_id IN (${userIds.map(() => '?').join(',')})`);
      params.push(...userIds);
    }
    if (dietitianIds.length > 0) {
      conditions.push(`dietitian_id IN (${dietitianIds.map(() => '?').join(',')})`);
      params.push(...dietitianIds);
    }
    if (conditions.length > 0) {
      const r = await execute(
        `DELETE FROM diet_plans WHERE ${conditions.join(' OR ')}`,
        params,
      );
      console.log(`Deleted diet_plans rows: ${r.affectedRows}`);
    }
  }

  // 9. Break self-reference on appointments (parent_appointment_id) before deleting
  if (appointmentIds.length > 0) {
    const ph = appointmentIds.map(() => '?').join(',');
    await execute(
      `UPDATE appointments SET parent_appointment_id = NULL WHERE parent_appointment_id IN (${ph})`,
      appointmentIds,
    );

    // 10. appointments
    const r = await execute(
      `DELETE FROM appointments WHERE id IN (${ph})`,
      appointmentIds,
    );
    console.log(`Deleted appointments rows: ${r.affectedRows}`);
  }

  // 11. payments (FK → users.id + diet_forms.id)
  if (userIds.length > 0) {
    const ph = userIds.map(() => '?').join(',');
    const r = await execute(
      `DELETE FROM payments WHERE user_id IN (${ph})`,
      userIds,
    );
    console.log(`Deleted payments rows: ${r.affectedRows}`);
  }

  // 12. wallet_transactions (FK → users.id)
  if (userIds.length > 0) {
    const ph = userIds.map(() => '?').join(',');
    const r = await execute(
      `DELETE FROM wallet_transactions WHERE user_id IN (${ph})`,
      userIds,
    );
    console.log(`Deleted wallet_transactions rows: ${r.affectedRows}`);
  }

  // 13. diet_forms (FK → users.id)
  if (userIds.length > 0) {
    const ph = userIds.map(() => '?').join(',');
    const r = await execute(
      `DELETE FROM diet_forms WHERE user_id IN (${ph})`,
      userIds,
    );
    console.log(`Deleted diet_forms rows: ${r.affectedRows}`);
  }

  // 14. dietitians (FK → users.id)
  if (userIds.length > 0) {
    const ph = userIds.map(() => '?').join(',');
    const r = await execute(
      `DELETE FROM dietitians WHERE user_id IN (${ph})`,
      userIds,
    );
    console.log(`Deleted dietitians rows: ${r.affectedRows}`);
  }

  // 15. users — the final hard-delete
  {
    const ph = userIds.map(() => '?').join(',');
    const r = await execute(
      `DELETE FROM users WHERE id IN (${ph}) AND is_delete = 1`,
      userIds,
    );
    console.log(`Deleted users rows: ${r.affectedRows}`);
  }

  console.log('\n✅ Purge complete.');
  await pool.end();
};

run().catch((err) => {
  console.error('❌ Purge failed:', err);
  pool.end();
  process.exit(1);
});
