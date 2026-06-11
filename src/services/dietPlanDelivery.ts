import { geminiModel } from '../config/gemini';
import { findDietFormById } from '../models/DietForm';
import type { DietForm } from '../models/DietForm';
import {
  createDietPlan,
  updateDietPlanData,
  updateDietPlanStatus,
  findDietPlanById,
  findDietPlanByFormId,
  saveDietPlanPdfUrl,
} from '../models/DietPlan';
import type { WeekPlan, FeaturedRecipe } from '../models/DietPlan';
import { getSetting } from '../models/Setting';
import { findPaidPaymentByDietFormId, incrementMonthsGenerated } from '../models/Payment';
import { creditWallet } from '../models/Wallet';
import { generateDietPlanPdf } from './dietPlanPdf';
import { uploadBufferToS3 } from './uploadToS3';
import { sendEmail } from './email';
import { dietPlanReadyEmail } from './emails/dietPlanReady';

// ── Shared helpers (duplicated from controller to keep service self-contained) ──

const PLAN_LABELS: Record<number, string> = { 1: '2 Weeks', 2: '1 Month (4 Weeks)', 3: '3 Months (12 Weeks)' };
const PLAN_WEEKS: Record<number, number>  = { 1: 2, 2: 4, 3: 12 };

const ACTIVITY_MULTIPLIER: Record<string, number> = {
  sedentary: 1.2, lightly_active: 1.375, moderately_active: 1.55,
  very_active: 1.725, super_active: 1.9,
};

const formatLabel = (val: string) =>
  val.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const calcVitals = (form: DietForm) => {
  let heightCm = parseFloat(String(form.height ?? 0));
  if (form.height_unit === 'ft_in') {
    const parts = String(form.height ?? '0').split('.');
    heightCm = parseInt(parts[0] ?? '0') * 30.48 + parseInt(parts[1] ?? '0') * 2.54;
  }
  let weightKg = parseFloat(String(form.weight ?? 0));
  if (form.weight_unit === 'lbs') weightKg *= 0.453592;

  const age = form.age ?? 25;
  const gender = form.gender ?? 'male';
  const heightM = heightCm / 100;
  const bmi = heightM > 0 ? parseFloat((weightKg / (heightM * heightM)).toFixed(2)) : 0;
  const bmi_category = bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal weight' : bmi < 30 ? 'Overweight' : 'Obese';
  const bmr = parseFloat((gender === 'female'
    ? 10 * weightKg + 6.25 * heightCm - 5 * age - 161
    : 10 * weightKg + 6.25 * heightCm - 5 * age + 5).toFixed(2));
  const tdee = parseFloat((bmr * (ACTIVITY_MULTIPLIER[form.activity_level ?? 'sedentary'] ?? 1.2)).toFixed(2));
  return { bmi, bmi_category, bmr, tdee, weightKg, heightCm };
};

const buildClientProfile = (form: DietForm, vitals: ReturnType<typeof calcVitals>) => ({
  personal_information: {
    full_name: form.full_name ?? null, age: form.age ?? null,
    gender: form.gender ? formatLabel(form.gender) : null, date_of_birth: form.dob ?? null,
    height: `${vitals.heightCm.toFixed(1)} cm`, weight: `${vitals.weightKg.toFixed(1)} kg`,
    phone: form.whatsapp ?? null, email: form.email ?? null,
    city: form.city ?? null, state: form.state ?? null,
  },
  current_vitals: {
    weight_kg: vitals.weightKg.toFixed(1), height_cm: vitals.heightCm.toFixed(1),
    bmi: vitals.bmi, bmi_category: vitals.bmi_category,
    bmr_kcal: vitals.bmr, tdee_kcal: vitals.tdee,
  },
  health_and_fitness_goals: {
    goals: form.goals ?? [], plan_type: PLAN_LABELS[form.plan_type ?? 1] ?? '2 Weeks',
    health_notes: form.health_notes ?? null, final_notes: form.final_notes ?? null,
  },
  lifestyle_overview: {
    activity_level: form.activity_level ? formatLabel(form.activity_level) : null,
    work_type: form.work_type ? formatLabel(form.work_type) : null,
    workout_type: form.workout_type ? formatLabel(form.workout_type) : null,
    smoke_alcohol: form.smoke_alcohol ? formatLabel(form.smoke_alcohol) : null,
    digestive_health: form.digestive_health ? formatLabel(form.digestive_health) : null,
  },
  medical_information: {
    medical_conditions: form.medical_conditions ?? [], other_condition: form.other_condition ?? null,
    on_medication: form.on_medication ? formatLabel(form.on_medication) : null,
    medications: form.medications ?? null, food_allergies: form.food_allergies ?? [],
  },
  dietary_information: {
    diet_type: form.diet_type ? formatLabel(form.diet_type) : null,
    cuisine_preference: form.cuisine_preference ?? [],
    foods_dislike: form.foods_dislike ?? null, favorite_foods: form.favorite_foods ?? null,
  },
  contact_details: {
    contact_name: form.contact_name ?? null, whatsapp: form.whatsapp ?? null,
    email: form.email ?? null, delivery_method: form.delivery_method ?? [],
  },
});

const buildPrompt = (form: DietForm, vitals: ReturnType<typeof calcVitals>, weeksOverride?: number): string => {
  const planType = form.plan_type ?? 1;
  const weeks = weeksOverride ?? PLAN_WEEKS[planType] ?? 2;
  const duration = weeksOverride === 4 ? '1 Month (4 Weeks)' : (PLAN_LABELS[planType] ?? '2 Weeks');
  return `
You are an expert Indian clinical dietitian. Generate a personalized diet plan in strict JSON format based on the client details below.

CLIENT DETAILS:
- Name: ${form.full_name ?? 'Client'}
- Age: ${form.age ?? 'N/A'} | Gender: ${form.gender ?? 'N/A'}
- Height: ${vitals.heightCm.toFixed(1)} cm | Weight: ${vitals.weightKg.toFixed(1)} kg
- BMI: ${vitals.bmi} (${vitals.bmi_category})
- BMR: ${vitals.bmr} kcal/day | TDEE: ${vitals.tdee} kcal/day
- Goals: ${(form.goals as string[])?.join(', ') ?? 'Healthy lifestyle'}
- Activity Level: ${form.activity_level ?? 'N/A'}
- Work Type: ${form.work_type ?? 'N/A'}
- Workout Type: ${form.workout_type ?? 'none'}
- Diet Type: ${form.diet_type ?? 'vegetarian'}
- Cuisine Preference: ${(form.cuisine_preference as string[])?.join(', ') ?? 'North Indian'}
- Food Allergies: ${(form.food_allergies as string[])?.join(', ') ?? 'none'}
- Foods Disliked: ${form.foods_dislike ?? 'none'}
- Favorite Foods: ${form.favorite_foods ?? 'N/A'}
- Medical Conditions: ${(form.medical_conditions as string[])?.join(', ') ?? 'none'}${form.other_condition ? ` | Other: ${form.other_condition}` : ''}
- On Medication: ${form.on_medication ?? 'no'} ${form.medications ? `(${form.medications})` : ''}
- Digestive Health: ${form.digestive_health ?? 'good'}
- Smoking/Alcohol: ${form.smoke_alcohol ?? 'neither'}
- Plan Duration: ${duration} (${weeks} week${weeks > 1 ? 's' : ''})
- City/State: ${form.city ?? ''}, ${form.state ?? ''}
- Health Notes: ${form.health_notes ?? 'none'}

INSTRUCTIONS:
1. All meals must respect the diet type and strictly avoid disliked foods and allergens.
2. Use Indian home-style meals suited to their cuisine preference.
3. Each day must have Breakfast, Lunch, Snack, and Dinner as arrays of meal items.
4. Include meal_timing for each day with realistic Indian meal times.
5. Keep calories between 1400–1600 kcal/day and protein between 90–110 g/day.
6. Include water_liters (2.5–3.5) for each day.
7. Generate exactly ${weeks} week(s) with exactly 7 days each.
8. Never repeat the same meals within the same week.
9. Include smart swaps and weekly tips for each week.
10. Include 4–6 featured recipes with full ingredients, steps, and macros.
11. Return VALID JSON only — no markdown, no comments, no code blocks.
12. All numeric fields must be numbers, not strings.

Return ONLY this JSON structure:
{
  "summary": { "client_name": "...", "calorie_range": "1400-1600 kcal/day", "protein_target_g": 100, "carbs_target_g": 150, "fat_target_g": 50, "primary_goal": "...", "plan_duration": "${duration}", "diet_type": "${form.diet_type}" },
  "weeks": [{ "week": 1, "title": "...", "description": "...", "focus": ["..."], "what_to_expect": "...", "days": [{ "day": 1, "breakfast": [{"food":"...","quantity":"..."}], "lunch": [...], "snack": [...], "dinner": [...], "meal_timing": {"breakfast":"8:00 AM","lunch":"1:00 PM","snack":"5:00 PM","dinner":"8:00 PM"}, "total_kcal": 1450, "total_protein_g": 95, "water_liters": 3 }], "weekly_notes": ["..."], "smart_swaps": [{"instead_of":"...","choose":"..."}] }],
  "hydration_guide": "...",
  "general_tips": ["..."],
  "featured_recipes": [{ "name":"...", "cook_time":"20 mins", "servings":1, "calories":320, "ingredients":["..."], "steps":["..."], "macros":{"carbs_g":48,"protein_g":8,"fat_g":10,"fiber_g":4} }]
}
`;
};

// ── Main delivery pipeline ────────────────────────────────────────────────────

export const generateAndDeliverDietPlan = async (
  formId: number,
  userId: number | null,
  weeksOverride?: number,
  dietitianId?: number | null,
  appointmentId?: number | null,
  existingPlanId?: number | null,
): Promise<void> => {
  const form = await findDietFormById(formId);
  if (!form) { console.error(`[delivery] form ${formId} not found`); return; }

  // Skip if a completed plan already exists for this form (non-dietitian flow only)
  if (!dietitianId && !existingPlanId) {
    const existing = await findDietPlanByFormId(formId);
    if (existing && existing.status === 'completed') return;
  }

  const vitals = calcVitals(form);
  const clientProfile = buildClientProfile(form, vitals);

  // For dietitian draft flow: reuse the existing plan record instead of creating a new one
  let plan;
  if (existingPlanId) {
    await updateDietPlanStatus(existingPlanId, 'generating');
    plan = await findDietPlanById(existingPlanId);
  } else {
    plan = await createDietPlan(formId, userId, dietitianId, appointmentId);
  }
  if (!plan) { console.error(`[delivery] failed to create plan record for form ${formId}`); return; }

  // ── Step 1: Generate via Gemini (up to 5 attempts with exponential backoff) ──
  let generatedData: Record<string, unknown> = {};
  const prompt = buildPrompt(form, vitals, weeksOverride);
  let lastAiErr: unknown;
  let geminiSuccess = false;

  const RETRYABLE = new Set([429, 500, 503]);
  // Backoff delays: 15s, 30s, 60s, 90s
  const DELAYS = [15_000, 30_000, 60_000, 90_000];

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const result = await geminiModel.generateContent(prompt);
      // Strip markdown code fences if Gemini wraps the JSON
      const raw = result.response.text().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
      generatedData = JSON.parse(raw);
      geminiSuccess = true;
      break;
    } catch (err: unknown) {
      lastAiErr = err;
      const status = (err as { status?: number }).status;
      const isRetryable = RETRYABLE.has(status ?? 0) || err instanceof SyntaxError;
      if (isRetryable && attempt < 5) {
        const delay = DELAYS[attempt - 1] ?? 90_000;
        console.warn(`[delivery] Gemini attempt ${attempt} failed (status=${status ?? 'parse_error'}), retrying in ${delay / 1000}s…`);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        break;
      }
    }
  }

  if (!geminiSuccess) {
    console.error('[delivery] Gemini failed after retries:', lastAiErr);
    await updateDietPlanData(plan.id, {
      bmi: vitals.bmi, bmi_category: vitals.bmi_category, bmr: vitals.bmr, tdee: vitals.tdee,
      client_profile: clientProfile, client_name: '', calorie_range: '',
      protein_target_g: 0, carbs_target_g: 0, fat_target_g: 0,
      primary_goal: '', plan_duration: '', diet_type: '', hydration_guide: '',
      weeks: [], general_tips: [], featured_recipes: [],
    }, 'failed');
    return;
  }

  const summary = (generatedData.summary ?? {}) as Record<string, string>;

  await updateDietPlanData(plan.id, {
    bmi: vitals.bmi, bmi_category: vitals.bmi_category, bmr: vitals.bmr, tdee: vitals.tdee,
    client_profile: clientProfile,
    client_name:      summary.client_name      ?? form.full_name ?? '',
    calorie_range:    summary.calorie_range     ?? '',
    protein_target_g: Number(summary.protein_target_g) || 0,
    carbs_target_g:   Number(summary.carbs_target_g)   || 0,
    fat_target_g:     Number(summary.fat_target_g)     || 0,
    primary_goal:     summary.primary_goal      ?? '',
    plan_duration:    summary.plan_duration     ?? '',
    diet_type:        summary.diet_type         ?? '',
    hydration_guide:  (generatedData.hydration_guide as string) ?? '',
    weeks:            (generatedData.weeks as WeekPlan[])           ?? [],
    general_tips:     (generatedData.general_tips as string[])      ?? [],
    featured_recipes: (generatedData.featured_recipes as FeaturedRecipe[]) ?? [],
  }, 'completed');

  // Re-fetch to get the fully parsed plan for PDF generation
  const completedPlan = await findDietPlanByFormId(formId);
  if (!completedPlan) return;

  // ── Step 2: Generate PDF ────────────────────────────────────────────────────
  let pdfUrl: string | null = null;
  try {
    const pdfBuffer = await generateDietPlanPdf(completedPlan);
    const s3Key = `diet-plans/form_${formId}_${Date.now()}.pdf`;
    pdfUrl = await uploadBufferToS3(pdfBuffer, s3Key, 'application/pdf');
    await saveDietPlanPdfUrl(completedPlan.id, pdfUrl);
  } catch (pdfErr) {
    console.error('[delivery] PDF generation/upload error:', pdfErr);
    // Non-fatal — cashback + email still run
  }

  // ── Step 3: Wallet credit ────────────────────────────────────────────────────
  let cashbackAmount: number | null = null;
  if (userId) {
    try {
      const payment = await findPaidPaymentByDietFormId(formId);
      if (payment && payment.amount > 0) {
        const [enabledRaw, percentRaw] = await Promise.all([
          getSetting('wallet_cashback_enabled'),
          getSetting('wallet_cashback_percent'),
        ]);
        const cashbackEnabled = enabledRaw === '1';
        const cashbackPercent = Math.max(0, Number(percentRaw ?? 0));
        const ref = String(payment.razorpay_payment_id ?? payment.razorpay_order_id);

        if (payment.plan === '3_months' && payment.months_generated === 0) {
          // Transaction 1: cashback on full purchase amount
          if (cashbackEnabled && cashbackPercent > 0) {
            cashbackAmount = parseFloat(((payment.amount * cashbackPercent) / 100).toFixed(2));
            await creditWallet({
              user_id: userId, source: 'reward', amount: cashbackAmount,
              description: `${cashbackPercent}% cashback from Diet Chart Generation`,
              reference_id: ref,
            });
          }

          // Transaction 2: credit for months 2 & 3 so user can redeem them later
          if (payment.per_month_amount > 0) {
            const subscriptionCredit = parseFloat((payment.per_month_amount * 2).toFixed(2));
            await creditWallet({
              user_id: userId, source: 'subscription', amount: subscriptionCredit,
              description: `Amount to generate 2nd and 3rd month diet plan`,
              reference_id: ref,
            });
          }

          await incrementMonthsGenerated(payment.id);
        } else if (payment.plan !== '3_months') {
          // Regular cashback for 1-week / 1-month plans
          if (cashbackEnabled && cashbackPercent > 0) {
            cashbackAmount = parseFloat(((payment.amount * cashbackPercent) / 100).toFixed(2));
            await creditWallet({
              user_id: userId, source: 'reward', amount: cashbackAmount,
              description: `${cashbackPercent}% cashback from Diet Chart Generation`,
              reference_id: ref,
            });
          }
        }
      }
    } catch (cbErr) {
      console.error('[delivery] Wallet credit error:', cbErr);
    }
  }

  // ── Step 4: Send email ──────────────────────────────────────────────────────
  const recipientEmail = form.email ?? null;
  if (recipientEmail && pdfUrl) {
    try {
      const { subject, html, text } = dietPlanReadyEmail(
        form.full_name ?? 'there',
        pdfUrl,
        cashbackAmount,
      );
      await sendEmail({ to: recipientEmail, subject, html, text });
    } catch (mailErr) {
      console.error('[delivery] Email error:', mailErr);
    }
  }
};
