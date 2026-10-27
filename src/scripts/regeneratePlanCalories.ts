import 'dotenv/config';
import { disconnectDatabase } from '../config/database';
import { generateAndDeliverDietPlan } from '../services/dietPlanDelivery';
import { findDietPlanById, updateDietPlanStatus } from '../models/DietPlan';

// Usage:
//   PLAN_ID=371 CALORIE_MIN=1800 CALORIE_MAX=2100 npx ts-node src/scripts/regeneratePlanCalories.ts

const PLAN_ID       = parseInt(process.env.PLAN_ID       ?? '371',  10);
const CALORIE_MIN   = parseInt(process.env.CALORIE_MIN   ?? '1800', 10);
const CALORIE_MAX   = parseInt(process.env.CALORIE_MAX   ?? '2100', 10);

const run = async () => {
  console.log(`\nRegenerating plan ${PLAN_ID} with calorie range ${CALORIE_MIN}–${CALORIE_MAX} kcal/day\n`);

  const plan = await findDietPlanById(PLAN_ID);
  if (!plan) {
    console.error(`Plan ${PLAN_ID} not found.`);
    process.exit(1);
  }

  console.log(`Form ID: ${plan.form_id} | User ID: ${plan.user_id} | Current status: ${plan.status}`);

  // Reset to failed so the guard doesn't skip it
  await updateDietPlanStatus(PLAN_ID, 'failed');

  await generateAndDeliverDietPlan(
    plan.form_id,
    plan.user_id,
    undefined,          // weeksOverride — use form's plan_type
    plan.dietitian_id,
    plan.appointment_id,
    PLAN_ID,            // existingPlanId — reuse this plan record
    CALORIE_MIN,
    CALORIE_MAX,
  );

  const updated = await findDietPlanById(PLAN_ID);
  console.log(`\nDone. Plan ${PLAN_ID} status: ${updated?.status}`);
  console.log(`Calorie range saved: ${updated?.calorie_range}`);

  await disconnectDatabase();
};

run().catch((err) => {
  console.error('Script error:', err);
  process.exit(1);
});
