import 'dotenv/config';
import { pool, query, execute } from '../config/database';

const PHONE = '9990917177';
const NAME  = 'Prashansa';

const ph = (arr: unknown[]) => arr.map(() => '?').join(',');

const run = async () => {
  // 1. Find the dietitian
  const rows = await query<{ dietitian_id: number; user_id: number; full_name: string; phone_number: string }>(
    `SELECT d.id AS dietitian_id, d.user_id, u.full_name, u.phone_number
     FROM dietitians d
     JOIN users u ON d.user_id = u.id
     WHERE u.phone_number LIKE ? OR u.full_name LIKE ?`,
    [`%${PHONE}%`, `%${NAME}%`],
  );

  if (rows.length === 0) {
    console.log('❌ Dietitian not found.');
    await pool.end();
    return;
  }

  const { dietitian_id, full_name, phone_number } = rows[0];
  console.log(`✅ Found: ${full_name} | ${phone_number} | dietitian_id=${dietitian_id}`);

  // 2. Find all appointments for this dietitian
  const apptRows = await query<{ id: number }>(
    `SELECT id FROM appointments WHERE dietitian_id = ?`,
    [dietitian_id],
  );
  const appointmentIds = apptRows.map((a) => a.id);
  console.log(`\nAppointments to delete: ${appointmentIds.length}`);
  if (appointmentIds.length > 0) console.log('  IDs:', appointmentIds.join(', '));

  // 3. Find all diet plans for this dietitian
  const planRows = await query<{ id: number; form_id: number; appointment_id: number | null; user_id: number | null }>(
    `SELECT id, form_id, appointment_id, user_id FROM diet_plans WHERE dietitian_id = ?`,
    [dietitian_id],
  );
  const planIds = planRows.map((p) => p.id);
  // Only delete diet_forms for manual plans (no appointment, no user) — those forms belong solely to the dietitian
  const manualFormIds = planRows
    .filter((p) => p.appointment_id === null && p.user_id === null)
    .map((p) => p.form_id);
  console.log(`Diet plans to delete: ${planIds.length}`);
  if (planIds.length > 0) console.log('  IDs:', planIds.join(', '));
  console.log(`Manual diet_forms to delete: ${manualFormIds.length}`);

  // ── Deletions ──────────────────────────────────────────────────────────────

  // 4. appointment_reschedule_history
  if (appointmentIds.length > 0) {
    const r = await execute(
      `DELETE FROM appointment_reschedule_history WHERE appointment_id IN (${ph(appointmentIds)})`,
      appointmentIds,
    );
    console.log(`\nDeleted appointment_reschedule_history: ${r.affectedRows}`);
  }

  // 5. dietitian_wallet_transactions tied to these appointments
  if (appointmentIds.length > 0) {
    const r = await execute(
      `DELETE FROM dietitian_wallet_transactions WHERE appointment_id IN (${ph(appointmentIds)})`,
      appointmentIds,
    );
    console.log(`Deleted dietitian_wallet_transactions (appointment-linked): ${r.affectedRows}`);
  }

  // 7. diet_plans
  if (planIds.length > 0) {
    const r = await execute(
      `DELETE FROM diet_plans WHERE id IN (${ph(planIds)})`,
      planIds,
    );
    console.log(`Deleted diet_plans: ${r.affectedRows}`);
  }

  // 8. diet_forms for manual plans only (these forms belong solely to the manual plan)
  if (manualFormIds.length > 0) {
    const r = await execute(
      `DELETE FROM diet_forms WHERE id IN (${ph(manualFormIds)})`,
      manualFormIds,
    );
    console.log(`Deleted diet_forms (manual): ${r.affectedRows}`);
  }

  // 9. Clear self-reference then delete appointments
  if (appointmentIds.length > 0) {
    await execute(
      `UPDATE appointments SET parent_appointment_id = NULL WHERE parent_appointment_id IN (${ph(appointmentIds)})`,
      appointmentIds,
    );
    const r = await execute(
      `DELETE FROM appointments WHERE id IN (${ph(appointmentIds)})`,
      appointmentIds,
    );
    console.log(`Deleted appointments: ${r.affectedRows}`);
  }

  console.log('\n✅ Done. Dietitian account itself is untouched — only appointments and diet plans removed.');
  await pool.end();
};

run().catch((err) => {
  console.error('❌ Script failed:', err);
  pool.end();
  process.exit(1);
});
