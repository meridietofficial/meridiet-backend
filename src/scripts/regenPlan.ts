import 'dotenv/config';
import { findDietFormById } from '../models/DietForm';
import { findDietPlanByFormId } from '../models/DietPlan';
import { generateAndDeliverDietPlan } from '../services/dietPlanDelivery';
import { disconnectDatabase } from '../config/database';

const FORM_ID = 306;

const run = async () => {
  console.log(`\nForce-regenerating diet plan for form_id = ${FORM_ID}...\n`);

  const form = await findDietFormById(FORM_ID);
  if (!form) {
    console.error(`No diet form found for form_id ${FORM_ID}`);
    process.exit(1);
  }
  console.log(`Form: ${form.full_name ?? 'Unknown'} | diet_type=${form.diet_type} | plan_type=${form.plan_type}`);

  const existing = await findDietPlanByFormId(FORM_ID);
  if (!existing) {
    console.error(`No existing plan found for form_id ${FORM_ID}. Run a normal generation first.`);
    process.exit(1);
  }
  console.log(`Existing plan: plan_id=${existing.id} | status=${existing.status}`);
  console.log(`\nStarting regeneration — this updates plan_id=${existing.id} in-place (no new DB row)...\n`);

  // Passing existing.id as existingPlanId → overwrites the same DB row, no new entry created
  // userId = null → skips wallet credit (safe for dev regeneration)
  await generateAndDeliverDietPlan(
    FORM_ID,
    null,
    undefined,
    null,
    null,
    existing.id,
  );

  console.log(`\nDone. Plan updated in-place: plan_id=${existing.id}`);
  console.log(`Preview: GET /api/v1/diet-plan/${FORM_ID}/preview-html`);

  await disconnectDatabase();
  process.exit(0);
};

run().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
