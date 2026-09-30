import 'dotenv/config';
import { query, execute, disconnectDatabase } from '../config/database';

// Usage:
//   PHONE=9419242768 DATE=2026-09-24 npx ts-node src/scripts/checkAppointmentDietForm.ts
//   Add FIX_HEIGHT=1 to actually patch the height if missing

const run = async () => {
  const phone    = process.env.PHONE;
  const date     = process.env.DATE;
  const fixHeight = process.env.FIX_HEIGHT === '1';

  if (!phone || !date) {
    console.error('Usage: PHONE=<phone> DATE=YYYY-MM-DD [FIX_HEIGHT=1] npx ts-node src/scripts/checkAppointmentDietForm.ts');
    process.exit(1);
  }

  // 1. Find the appointment
  const appts = await query<{
    id: number; name: string; email: string | null; phone: string | null;
    appointment_date: string; slot: string; status: string; payment_status: string;
    user_id: number | null;
  }>(
    `SELECT id, name, email, phone,
       DATE_FORMAT(appointment_date, '%Y-%m-%d') AS appointment_date,
       TIME_FORMAT(slot, '%H:%i') AS slot,
       status, payment_status, user_id
     FROM appointments
     WHERE phone LIKE ? AND DATE_FORMAT(appointment_date, '%Y-%m-%d') = ?
     ORDER BY created_at DESC LIMIT 5`,
    [`%${phone}%`, date],
  );

  if (!appts.length) {
    console.error(`No appointment found for phone=${phone} on ${date}`);
    process.exit(1);
  }

  const appt = appts[0];
  console.log('\n=== APPOINTMENT ===');
  console.log(`  ID:      ${appt.id}`);
  console.log(`  Patient: ${appt.name} (${appt.email ?? 'no email'}) | phone: ${appt.phone}`);
  console.log(`  Date:    ${appt.appointment_date} @ ${appt.slot}`);
  console.log(`  Status:  ${appt.status} / payment: ${appt.payment_status}`);
  console.log(`  user_id: ${appt.user_id ?? 'none (offline)'}`);

  // 2. Find the diet form linked to this appointment via diet_plans
  const planRows = await query<{
    plan_id: number; plan_status: string; form_id: number | null; pdf_url: string | null;
  }>(
    `SELECT dp.id AS plan_id, dp.status AS plan_status, dp.form_id, dp.pdf_url
     FROM diet_plans dp
     WHERE dp.appointment_id = ?
     ORDER BY dp.created_at DESC LIMIT 1`,
    [appt.id],
  );

  if (!planRows.length) {
    console.log('\n  No diet plan linked to this appointment.');
  } else {
    const plan = planRows[0];
    console.log('\n=== DIET PLAN ===');
    console.log(`  Plan ID: ${plan.plan_id}`);
    console.log(`  Status:  ${plan.plan_status}`);
    console.log(`  Form ID: ${plan.form_id ?? 'none'}`);
    console.log(`  PDF URL: ${plan.pdf_url ?? 'none'}`);

    if (plan.form_id) {
      const formRows = await query<{
        id: number; full_name: string | null; age: number | null; gender: string | null;
        height_unit: string | null; height: string | null;
        weight_unit: string | null; weight: number | null;
        goals: string | null; activity_level: string | null; work_type: string | null;
        workout_type: string | null; diet_type: string | null;
        medical_conditions: string | null; on_medication: string | null;
        medications: string | null; digestive_health: string | null;
        breakfast_time: string | null; lunch_time: string | null;
        evening_snack_time: string | null; dinner_time: string | null;
        food_allergies: string | null; foods_dislike: string | null;
        favorite_foods: string | null; whey_protein: string | null;
        smoke_alcohol: string | null; health_notes: string | null;
        final_notes: string | null; email: string | null; whatsapp: string | null;
        city: string | null; state: string | null;
      }>(
        `SELECT id, full_name, age, gender,
           height_unit, height, weight_unit, weight,
           goals, activity_level, work_type, workout_type, diet_type,
           medical_conditions, on_medication, medications, digestive_health,
           breakfast_time, lunch_time, evening_snack_time, dinner_time,
           food_allergies, foods_dislike, favorite_foods, whey_protein,
           smoke_alcohol, health_notes, final_notes,
           email, whatsapp, city, state
         FROM diet_forms WHERE id = ? LIMIT 1`,
        [plan.form_id],
      );

      if (!formRows.length) {
        console.log(`\n  Diet form #${plan.form_id} not found.`);
      } else {
        const f = formRows[0];
        console.log('\n=== DIET FORM ===');
        console.log(`  Name:         ${f.full_name ?? 'MISSING'}`);
        console.log(`  Age:          ${f.age ?? 'MISSING'}`);
        console.log(`  Gender:       ${f.gender ?? 'MISSING'}`);
        console.log(`  Height:       ${f.height ?? 'MISSING'} (unit: ${f.height_unit ?? 'MISSING'})`);
        console.log(`  Weight:       ${f.weight ?? 'MISSING'} (unit: ${f.weight_unit ?? 'MISSING'})`);
        console.log(`  Goals:        ${f.goals ?? 'MISSING'}`);
        console.log(`  Activity:     ${f.activity_level ?? 'MISSING'}`);
        console.log(`  Work type:    ${f.work_type ?? 'MISSING'}`);
        console.log(`  Workout:      ${f.workout_type ?? 'MISSING'}`);
        console.log(`  Diet type:    ${f.diet_type ?? 'MISSING'}`);
        console.log(`  Breakfast:    ${f.breakfast_time ?? 'MISSING'}`);
        console.log(`  Lunch:        ${f.lunch_time ?? 'MISSING'}`);
        console.log(`  Eve snack:    ${f.evening_snack_time ?? 'MISSING'}`);
        console.log(`  Dinner:       ${f.dinner_time ?? 'MISSING'}`);
        console.log(`  Allergies:    ${f.food_allergies ?? 'none'}`);
        console.log(`  Dislikes:     ${f.foods_dislike ?? 'none'}`);
        console.log(`  Favorites:    ${f.favorite_foods ?? 'none'}`);
        console.log(`  Whey protein: ${f.whey_protein ?? 'MISSING'}`);
        console.log(`  Medical:      ${f.medical_conditions ?? 'none'}`);
        console.log(`  Medication:   ${f.on_medication ?? 'MISSING'} — ${f.medications ?? 'none'}`);
        console.log(`  Digestion:    ${f.digestive_health ?? 'MISSING'}`);
        console.log(`  Smoke/alc:    ${f.smoke_alcohol ?? 'MISSING'}`);
        console.log(`  Health notes: ${f.health_notes ?? 'none'}`);
        console.log(`  Final notes:  ${f.final_notes ?? 'none'}`);
        console.log(`  City/State:   ${f.city ?? 'MISSING'} / ${f.state ?? 'MISSING'}`);
        console.log(`  Email:        ${f.email ?? 'MISSING'}`);
        console.log(`  WhatsApp:     ${f.whatsapp ?? 'MISSING'}`);

        // 3. Check height
        const heightMissing = !f.height || f.height.trim() === '';
        console.log(`\n=== HEIGHT CHECK ===`);
        if (heightMissing) {
          console.log(`  ❌ Height is MISSING`);
          if (fixHeight) {
            await execute(
              `UPDATE diet_forms SET height = ?, height_unit = 'ft_in' WHERE id = ?`,
              ['5.4', plan.form_id],
            );
            console.log(`  ✅ Height set to 5.4 ft_in on form #${plan.form_id}`);
          } else {
            console.log(`  → Re-run with FIX_HEIGHT=1 to set height=5.4 ft_in`);
          }
        } else {
          console.log(`  ✅ Height already set: ${f.height} (${f.height_unit})`);
        }
      }
    }
  }
};

run()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => disconnectDatabase());
