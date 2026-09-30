import 'dotenv/config';
import { query } from '../config/database';
import { findDietFormById } from '../models/DietForm';
import { findDietPlanByFormId } from '../models/DietPlan';
import { generateAndDeliverDietPlan } from '../services/dietPlanDelivery';
import { disconnectDatabase } from '../config/database';

// Usage:
//   BY FORM ID:   FORM_ID=2046 npx ts-node src/scripts/regenPlan.ts
//   BY EMAIL:     EMAIL=chkrbrtshampa@gmail.com npx ts-node src/scripts/regenPlan.ts

const run = async () => {
  let formId: number | null = null;

  if (process.env.EMAIL) {
    const email = process.env.EMAIL.trim();
    console.log(`\nLooking up diet form by email: ${email}...\n`);
    const rows = await query<{ id: number; full_name: string | null }>(
      'SELECT id, full_name FROM diet_forms WHERE email = ? ORDER BY created_at DESC LIMIT 1',
      [email],
    );
    if (!rows[0]) {
      console.error(`No diet form found for email: ${email}`);
      process.exit(1);
    }
    formId = rows[0].id;
    console.log(`Found form_id=${formId} for ${rows[0].full_name ?? email}`);
  } else if (process.env.FORM_ID) {
    formId = parseInt(process.env.FORM_ID, 10);
  } else {
    formId = 2046; // fallback default
  }

  if (!formId || isNaN(formId)) {
    console.error('No valid FORM_ID or EMAIL provided.');
    process.exit(1);
  }

  console.log(`\nForce-regenerating diet plan for form_id = ${formId}...\n`);

  const form = await findDietFormById(formId);
  if (!form) {
    console.error(`No diet form found for form_id ${formId}`);
    process.exit(1);
  }
  console.log(`Form: ${form.full_name ?? 'Unknown'} | diet_type=${form.diet_type} | plan_type=${form.plan_type}`);

  const existing = await findDietPlanByFormId(formId);
  if (!existing) {
    console.error(`No existing plan found for form_id ${formId}. Run a normal generation first.`);
    process.exit(1);
  }
  console.log(`Existing plan: plan_id=${existing.id} | status=${existing.status}`);
  console.log(`\nStarting regeneration — this updates plan_id=${existing.id} in-place (no new DB row)...\n`);

  // Passing existing.id as existingPlanId → overwrites the same DB row, no new entry created
  // userId = null → skips wallet credit (safe for dev regeneration)
  await generateAndDeliverDietPlan(
    formId,
    null,
    undefined,
    null,
    null,
    existing.id,
  );

  console.log(`\nDone. Plan updated in-place: plan_id=${existing.id}`);
  console.log(`Preview: GET /api/v1/diet-plan/${formId}/preview-html`);

  await disconnectDatabase();
  process.exit(0);
};

run().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
