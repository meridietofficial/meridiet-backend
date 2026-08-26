import 'dotenv/config';
import { connectDatabase, query } from '../config/database';
import { adminCreditPlanCredits } from '../models/DietitianWallet';

const EMAIL  = 'nutritionistpratibha02@gmail.com';
const AMOUNT = 500;
const ADMIN_USER_ID = 1; // system admin

const run = async () => {
  await connectDatabase();

  const rows = await query<{ dietitian_id: number; full_name: string; plan_credits: number }>(
    `SELECT d.id AS dietitian_id, u.full_name, d.plan_credits
     FROM users u
     JOIN dietitians d ON d.user_id = u.id
     WHERE u.email = ? LIMIT 1`,
    [EMAIL],
  );

  if (rows.length === 0) {
    console.error('Dietitian not found for email:', EMAIL);
    process.exit(1);
  }

  const { dietitian_id, full_name, plan_credits } = rows[0];
  console.log(`Dietitian: ${full_name} (dietitian_id=${dietitian_id})`);
  console.log(`Plan credits: ${plan_credits} → ${Number(plan_credits) + AMOUNT}`);

  const result = await adminCreditPlanCredits(
    dietitian_id,
    AMOUNT,
    ADMIN_USER_ID,
    'Admin free credit grant — 500 plan credits',
  );

  if (!result.credited) {
    console.error('Failed to credit:', result.reason);
    process.exit(1);
  }

  console.log(`✅ ${AMOUNT} plan credits added. New balance: ${result.new_balance}`);
  process.exit(0);
};

run().catch((err) => { console.error('Error:', err.message); process.exit(1); });
