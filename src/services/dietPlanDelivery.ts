import { openaiClient, OPENAI_PRIMARY_MODEL, OPENAI_FALLBACK_MODEL } from '../config/openai';
import { findDietFormById } from '../models/DietForm';
import type { DietForm } from '../models/DietForm';
import { loadNutritionConfig } from '../models/NutritionConfig';
import type { NutritionConfig } from '../models/NutritionConfig';
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

const PLAN_LABELS: Record<number, string> = { 1: '1 Week', 2: '1 Month (4 Weeks)', 3: '3 Months (12 Weeks)' };
const PLAN_WEEKS: Record<number, number>  = { 1: 1, 2: 4, 3: 12 };

const formatLabel = (val: string) =>
  val.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const calcVitals = (form: DietForm, config: NutritionConfig) => {
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

  // BMI category: find the first range from DB where bmi >= min_bmi and (max_bmi is null or bmi < max_bmi)
  const bmiRow = config.bmiCategories.find(
    (r) => bmi >= Number(r.min_bmi) && (r.max_bmi === null || bmi < Number(r.max_bmi)),
  );
  const bmi_category = bmiRow?.category_name ?? 'Unknown';

  const bmr = parseFloat((gender === 'female'
    ? 10 * weightKg + 6.25 * heightCm - 5 * age - 161
    : 10 * weightKg + 6.25 * heightCm - 5 * age + 5).toFixed(2));

  // Activity multiplier from DB, fallback to 1.2 if key not found
  const pal = config.activityMultipliers[form.activity_level ?? 'sedentary'] ?? 1.2;
  const tdee = parseFloat((bmr * pal).toFixed(2));

  return { bmi, bmi_category, bmr, tdee, weightKg, heightCm };
};

// Derive goal-aware calorie range and macro targets from TDEE + client goals + medical conditions
// All magic numbers come from the NutritionConfig loaded from DB — nothing hardcoded here
const calcNutritionTargets = (form: DietForm, vitals: ReturnType<typeof calcVitals>, config: NutritionConfig) => {
  const goals = ((form.goals ?? []) as string[])
    .map((g) => g.toLowerCase().replace(/[\s-]+/g, '_'));

  const isWeightLoss = goals.some((g) =>
    g.includes('weight_loss') || g.includes('fat_loss') || g.includes('lose'));
  const isMuscle = goals.some((g) =>
    g.includes('muscle') || g.includes('strength') || g.includes('bulk'));
  const isWeightGain = !isMuscle && goals.some((g) =>
    g.includes('weight_gain') || g.includes('gain_weight') || g.includes('gain'));

  // Detect which medical conditions the client has by matching against DB detection_keywords
  const clientConditionText = [
    ...((form.medical_conditions ?? []) as string[]),
    form.other_condition ?? '',
  ].join(' ').toLowerCase();

  const matchedConditions = config.medicalAdjustments.filter((adj) =>
    adj.detection_keywords
      .split(',')
      .map((k) => k.trim())
      .some((keyword) => keyword.length > 0 && clientConditionText.includes(keyword)),
  );

  // Pull general settings from DB
  const g = config.general;
  const ibwBmiThreshold      = g['ibw_bmi_threshold']          ?? 27.5;
  const severeObeseBmi       = g['severe_obese_bmi_threshold']  ?? 35;
  const adjustedBwFactor     = g['adjusted_bw_factor']          ?? 0.4;
  const ibwMaleBase          = g['ibw_male_base_kg']            ?? 50;
  const ibwFemaleBase        = g['ibw_female_base_kg']          ?? 45.5;
  const ibwPerInch           = g['ibw_per_inch_kg']             ?? 2.3;
  const elderlyAgeThreshold  = g['elderly_age_threshold']       ?? 60;
  const elderlyMinProtein    = g['elderly_min_protein_per_kg']  ?? 1.4;
  const defaultFatPercent    = g['default_fat_percent']         ?? 0.27;
  const minCarbsPerDay       = g['min_carbs_per_day']           ?? 130;
  const proteinTolerance     = g['protein_range_tolerance']     ?? 0.10;

  const gender = form.gender ?? 'male';
  const age    = form.age ?? 25;

  // IBW-based protein weight for overweight/obese clients (Devine formula from DB values)
  let weightForProtein = vitals.weightKg;
  if (vitals.bmi > ibwBmiThreshold) {
    const heightInches = vitals.heightCm / 2.54;
    const ibwBase      = gender === 'female' ? ibwFemaleBase : ibwMaleBase;
    const ibw          = ibwBase + ibwPerInch * Math.max(0, heightInches - 60);
    weightForProtein   = vitals.bmi > severeObeseBmi
      ? Math.round(ibw + adjustedBwFactor * (vitals.weightKg - ibw))
      : Math.round(ibw);
    weightForProtein = Math.max(weightForProtein, 40);
  }

  // Goal-based calorie offsets from DB
  const goalKey = isWeightLoss ? 'weight_loss' : isMuscle ? 'muscle_gain' : isWeightGain ? 'weight_gain' : 'maintenance';
  const goalRow = config.goalSettings[goalKey] ?? { calorie_min_offset: -150, calorie_max_offset: 150, protein_per_kg: 1.2 };

  let calorieMin = Math.round(vitals.tdee + goalRow.calorie_min_offset);
  let calorieMax = Math.round(vitals.tdee + goalRow.calorie_max_offset);

  // Gender-specific calorie floor from DB
  const calorieFloor = config.calorieFloors[gender] ?? config.calorieFloors['female'] ?? 1200;
  calorieMin = Math.max(calorieMin, calorieFloor);
  calorieMax = Math.max(calorieMax, calorieMin + 100);

  // Protein per kg: start with goal-based value, then apply medical overrides
  // Conditions are already sorted by priority (lowest = highest priority)
  let proteinPerKg = goalRow.protein_per_kg;

  // Find the highest-priority matched condition that has a protein override
  const proteinOverrideCondition = matchedConditions.find((c) => c.protein_per_kg_override !== null);
  if (proteinOverrideCondition?.protein_per_kg_override != null) {
    proteinPerKg = Number(proteinOverrideCondition.protein_per_kg_override);
  }

  // Elderly protein boost (from DB) unless a condition already set a lower override like CKD
  const hasCKDMatch = matchedConditions.some((c) => c.condition_key === 'ckd');
  if (age >= elderlyAgeThreshold && !hasCKDMatch) {
    proteinPerKg = Math.max(proteinPerKg, elderlyMinProtein);
  }

  const calorieTarget = Math.round((calorieMin + calorieMax) / 2);
  const proteinTarget = Math.round(weightForProtein * proteinPerKg);
  const proteinMin    = Math.round(proteinTarget * (1 - proteinTolerance));
  const proteinMax    = Math.round(proteinTarget * (1 + proteinTolerance));

  // Fat %: use highest-priority matched condition that specifies fat_percent, else default from DB
  const fatCondition = matchedConditions.find((c) => c.fat_percent !== null);
  const fatPercent   = fatCondition?.fat_percent != null ? Number(fatCondition.fat_percent) : defaultFatPercent;
  const fatTarget    = Math.round((calorieTarget * fatPercent) / 9);

  // Carbs: residual after protein + fat, then apply condition cap, then enforce DB floor
  let carbsTarget = Math.round((calorieTarget - proteinTarget * 4 - fatTarget * 9) / 4);
  const carbCapCondition = matchedConditions.find((c) => c.carb_max_percent !== null);
  if (carbCapCondition?.carb_max_percent != null) {
    carbsTarget = Math.min(carbsTarget, Math.round((calorieTarget * Number(carbCapCondition.carb_max_percent)) / 4));
  }
  carbsTarget = Math.max(carbsTarget, minCarbsPerDay);

  // Collect prompt notes from all matched conditions (in priority order)
  const medicalNotes = matchedConditions.map((c) => c.prompt_note);

  return {
    calorieMin, calorieMax,
    calorieRange: `${calorieMin}–${calorieMax} kcal/day`,
    proteinTarget, proteinMin, proteinMax,
    proteinRange: `${proteinMin}–${proteinMax} g/day`,
    fatTarget, carbsTarget,
    medicalNotes,
  };
};

// Formats medical constraint notes into a prompt section (empty string if no conditions)
const medicalConstraintsBlock = (medicalNotes: string[]): string =>
  medicalNotes.length === 0
    ? ''
    : `\nMEDICAL NUTRITION CONSTRAINTS (MANDATORY — follow strictly for every meal):\n${medicalNotes.map((n, i) => `${i + 1}. ${n}`).join('\n')}\n`;

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
    goals: form.goals ?? [], plan_type: PLAN_LABELS[form.plan_type ?? 1] ?? '1 Week',
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

// Shared client details block reused in every prompt
const clientBlock = (form: DietForm, vitals: ReturnType<typeof calcVitals>): string =>
  `CLIENT DETAILS:
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
- Date of Birth: ${form.dob ?? 'N/A'}
- City/State: ${form.city ?? ''}, ${form.state ?? ''}
- Health Notes: ${form.health_notes ?? 'none'}
- Final Notes / Personal Goals: ${form.final_notes ?? 'none'}`;

// Week 1 — Call A: summary, hydration, tips, and exactly 4 featured recipes (no days)
const buildWeek1MetaPrompt = (
  form: DietForm,
  vitals: ReturnType<typeof calcVitals>,
  totalWeeks: number,
  duration: string,
  nt: ReturnType<typeof calcNutritionTargets>,
): string => `
You are an expert Indian clinical dietitian. Generate the plan summary, hydration guide, general tips, and exactly 4 featured recipes for a ${totalWeeks}-week personalized Indian diet plan in strict JSON format.

${clientBlock(form, vitals)}

CALORIE & PROTEIN TARGETS (calculated from client's TDEE of ${vitals.tdee} kcal/day and their goals):
- Daily Calorie Range: ${nt.calorieRange}
- Daily Protein Target: ${nt.proteinRange}
- Daily Carbs Target: ~${nt.carbsTarget} g/day
- Daily Fat Target: ~${nt.fatTarget} g/day
${medicalConstraintsBlock(nt.medicalNotes)}
INSTRUCTIONS:
1. Recipes must respect the diet type and strictly avoid disliked foods and allergens.
2. Use Indian home-style recipes suited to their cuisine preference.
3. Generate EXACTLY 4 featured recipes — no more, no fewer.
4. Each recipe must include: name, cook_time, servings, calories, ingredients (6–8 items), steps (4–6 steps), macros.
5. Recipe calorie counts must be consistent with the daily calorie range above.
6. Return VALID JSON only — no markdown, no comments, no code blocks.
7. All numeric fields must be numbers, not strings.

Return ONLY this JSON structure:
{
  "summary": { "client_name": "...", "calorie_range": "${nt.calorieRange}", "protein_target_g": ${nt.proteinTarget}, "carbs_target_g": ${nt.carbsTarget}, "fat_target_g": ${nt.fatTarget}, "primary_goal": "...", "plan_duration": "${duration}", "diet_type": "${form.diet_type ?? ''}" },
  "hydration_guide": "...",
  "general_tips": ["...", "...", "...", "...", "..."],
  "featured_recipes": [
    { "name":"...", "cook_time":"20 mins", "servings":1, "calories":0, "ingredients":["...","...","...","...","...","..."], "steps":["...","...","...","..."], "macros":{"carbs_g":0,"protein_g":0,"fat_g":0,"fiber_g":0} },
    { "name":"...", "cook_time":"20 mins", "servings":1, "calories":0, "ingredients":["...","...","...","...","...","..."], "steps":["...","...","...","..."], "macros":{"carbs_g":0,"protein_g":0,"fat_g":0,"fiber_g":0} },
    { "name":"...", "cook_time":"15 mins", "servings":1, "calories":0, "ingredients":["...","...","...","...","...","..."], "steps":["...","...","...","..."], "macros":{"carbs_g":0,"protein_g":0,"fat_g":0,"fiber_g":0} },
    { "name":"...", "cook_time":"25 mins", "servings":1, "calories":0, "ingredients":["...","...","...","...","...","..."], "steps":["...","...","...","..."], "macros":{"carbs_g":0,"protein_g":0,"fat_g":0,"fiber_g":0} }
  ]
}
`;

// Week 1 — Call B: all 7 days only (no summary or recipes)
const buildWeek1DaysPrompt = (
  form: DietForm,
  vitals: ReturnType<typeof calcVitals>,
  totalWeeks: number,
  nt: ReturnType<typeof calcNutritionTargets>,
): string => {
  const mk = Math.round((nt.calorieMin + nt.calorieMax) / 2); // midpoint kcal for examples
  const mp = nt.proteinTarget;
  return `
You are an expert Indian clinical dietitian. Generate EXACTLY 7 days for Week 1 of a ${totalWeeks}-week personalized Indian diet plan in strict JSON format.

${clientBlock(form, vitals)}

CALORIE & PROTEIN TARGETS (calculated from client's TDEE of ${vitals.tdee} kcal/day and their goals):
- Daily Calorie Range: ${nt.calorieRange}
- Daily Protein Target: ${nt.proteinRange}
${medicalConstraintsBlock(nt.medicalNotes)}
CRITICAL RULES:
- You MUST generate all 7 days: day 1, day 2, day 3, day 4, day 5, day 6, day 7. Do NOT stop early.
- The "days" array must contain exactly 7 objects.
- All meals must respect the diet type and strictly avoid disliked foods and allergens.
- Use Indian home-style meals suited to their cuisine preference.
- Each day must have breakfast, lunch, snack, and dinner as arrays of meal items.
- Include meal_timing for each day with realistic Indian meal times.
- Keep calories between ${nt.calorieMin}–${nt.calorieMax} kcal/day and protein between ${nt.proteinMin}–${nt.proteinMax} g/day.
- Include water_liters (2.5–3.5) for each day.
- Never repeat the same meal across days within this week.
- Include 3 smart_swaps and 3 weekly_notes.
- Return VALID JSON only — no markdown, no comments, no code blocks.
- All numeric fields must be numbers, not strings.

Return ONLY this JSON structure (days array must have exactly 7 items):
{
  "week": {
    "week": 1,
    "title": "...",
    "description": "...",
    "focus": ["...", "...", "..."],
    "what_to_expect": "...",
    "days": [
      { "day": 1, "breakfast": [{"food":"...","quantity":"..."},{"food":"...","quantity":"..."}], "lunch": [{"food":"...","quantity":"..."},{"food":"...","quantity":"..."}], "snack": [{"food":"...","quantity":"..."}], "dinner": [{"food":"...","quantity":"..."},{"food":"...","quantity":"..."}], "meal_timing": {"breakfast":"8:00 AM","lunch":"1:00 PM","snack":"5:00 PM","dinner":"8:00 PM"}, "total_kcal": ${mk - 50}, "total_protein_g": ${mp - 5}, "water_liters": 3 },
      { "day": 2, "breakfast": [...], "lunch": [...], "snack": [...], "dinner": [...], "meal_timing": {"breakfast":"8:00 AM","lunch":"1:00 PM","snack":"5:00 PM","dinner":"8:00 PM"}, "total_kcal": ${mk - 20}, "total_protein_g": ${mp - 2}, "water_liters": 3 },
      { "day": 3, "breakfast": [...], "lunch": [...], "snack": [...], "dinner": [...], "meal_timing": {"breakfast":"8:00 AM","lunch":"1:00 PM","snack":"5:00 PM","dinner":"8:00 PM"}, "total_kcal": ${mk - 40}, "total_protein_g": ${mp - 4}, "water_liters": 2.5 },
      { "day": 4, "breakfast": [...], "lunch": [...], "snack": [...], "dinner": [...], "meal_timing": {"breakfast":"8:00 AM","lunch":"1:00 PM","snack":"5:00 PM","dinner":"8:00 PM"}, "total_kcal": ${mk - 30}, "total_protein_g": ${mp - 3}, "water_liters": 3 },
      { "day": 5, "breakfast": [...], "lunch": [...], "snack": [...], "dinner": [...], "meal_timing": {"breakfast":"8:00 AM","lunch":"1:00 PM","snack":"5:00 PM","dinner":"8:00 PM"}, "total_kcal": ${mk}, "total_protein_g": ${mp}, "water_liters": 3.5 },
      { "day": 6, "breakfast": [...], "lunch": [...], "snack": [...], "dinner": [...], "meal_timing": {"breakfast":"8:00 AM","lunch":"1:00 PM","snack":"5:00 PM","dinner":"8:00 PM"}, "total_kcal": ${mk - 50}, "total_protein_g": ${mp - 5}, "water_liters": 3 },
      { "day": 7, "breakfast": [...], "lunch": [...], "snack": [...], "dinner": [...], "meal_timing": {"breakfast":"8:00 AM","lunch":"1:00 PM","snack":"5:00 PM","dinner":"8:00 PM"}, "total_kcal": ${mk - 10}, "total_protein_g": ${mp - 1}, "water_liters": 3 }
    ],
    "weekly_notes": ["...", "...", "..."],
    "smart_swaps": [{"instead_of":"...","choose":"..."},{"instead_of":"...","choose":"..."},{"instead_of":"...","choose":"..."}]
  }
}
`;
};

// Week N prompt (N > 1) — generates only one week, avoids repeating prior meals
const buildWeekNPrompt = (
  form: DietForm,
  vitals: ReturnType<typeof calcVitals>,
  weekNumber: number,
  totalWeeks: number,
  usedMeals: string[],
  nt: ReturnType<typeof calcNutritionTargets>,
): string => {
  const mk = Math.round((nt.calorieMin + nt.calorieMax) / 2);
  const mp = nt.proteinTarget;
  return `
You are an expert Indian clinical dietitian. Generate Week ${weekNumber} of a ${totalWeeks}-week personalized diet plan in strict JSON format.

${clientBlock(form, vitals)}

CALORIE & PROTEIN TARGETS (calculated from client's TDEE of ${vitals.tdee} kcal/day and their goals):
- Daily Calorie Range: ${nt.calorieRange}
- Daily Protein Target: ${nt.proteinRange}
${medicalConstraintsBlock(nt.medicalNotes)}
MEALS ALREADY USED IN PREVIOUS WEEKS — do NOT repeat any of these:
${usedMeals.slice(0, 150).join(', ')}

INSTRUCTIONS:
1. All meals must respect the diet type and strictly avoid disliked foods and allergens.
2. Use Indian home-style meals suited to their cuisine preference.
3. Each day must have Breakfast, Lunch, Snack, and Dinner as arrays of meal items.
4. Include meal_timing for each day with realistic Indian meal times.
5. Keep calories between ${nt.calorieMin}–${nt.calorieMax} kcal/day and protein between ${nt.proteinMin}–${nt.proteinMax} g/day.
6. Include water_liters (2.5–3.5) for each day.
7. Generate exactly 7 days for Week ${weekNumber}.
8. Never repeat the same meals within this week or from the already used meals list above.
9. Include smart swaps and weekly tips for Week ${weekNumber}.
10. Return VALID JSON only — no markdown, no comments, no code blocks.
11. All numeric fields must be numbers, not strings.

Return ONLY this JSON structure (days array MUST have exactly 7 items):
{
  "week": {
    "week": ${weekNumber},
    "title": "...",
    "description": "...",
    "focus": ["...", "...", "..."],
    "what_to_expect": "...",
    "days": [
      { "day": 1, "breakfast": [{"food":"...","quantity":"..."},{"food":"...","quantity":"..."}], "lunch": [{"food":"...","quantity":"..."},{"food":"...","quantity":"..."}], "snack": [{"food":"...","quantity":"..."}], "dinner": [{"food":"...","quantity":"..."},{"food":"...","quantity":"..."}], "meal_timing": {"breakfast":"8:00 AM","lunch":"1:00 PM","snack":"5:00 PM","dinner":"8:00 PM"}, "total_kcal": ${mk - 50}, "total_protein_g": ${mp - 5}, "water_liters": 3 },
      { "day": 2, "breakfast": [{"food":"...","quantity":"..."},{"food":"...","quantity":"..."}], "lunch": [{"food":"...","quantity":"..."},{"food":"...","quantity":"..."}], "snack": [{"food":"...","quantity":"..."}], "dinner": [{"food":"...","quantity":"..."},{"food":"...","quantity":"..."}], "meal_timing": {"breakfast":"8:00 AM","lunch":"1:00 PM","snack":"5:00 PM","dinner":"8:00 PM"}, "total_kcal": ${mk - 20}, "total_protein_g": ${mp - 2}, "water_liters": 3 },
      { "day": 3, "breakfast": [{"food":"...","quantity":"..."},{"food":"...","quantity":"..."}], "lunch": [{"food":"...","quantity":"..."},{"food":"...","quantity":"..."}], "snack": [{"food":"...","quantity":"..."}], "dinner": [{"food":"...","quantity":"..."},{"food":"...","quantity":"..."}], "meal_timing": {"breakfast":"8:00 AM","lunch":"1:00 PM","snack":"5:00 PM","dinner":"8:00 PM"}, "total_kcal": ${mk - 40}, "total_protein_g": ${mp - 4}, "water_liters": 2.5 },
      { "day": 4, "breakfast": [{"food":"...","quantity":"..."},{"food":"...","quantity":"..."}], "lunch": [{"food":"...","quantity":"..."},{"food":"...","quantity":"..."}], "snack": [{"food":"...","quantity":"..."}], "dinner": [{"food":"...","quantity":"..."},{"food":"...","quantity":"..."}], "meal_timing": {"breakfast":"8:00 AM","lunch":"1:00 PM","snack":"5:00 PM","dinner":"8:00 PM"}, "total_kcal": ${mk - 30}, "total_protein_g": ${mp - 3}, "water_liters": 3 },
      { "day": 5, "breakfast": [{"food":"...","quantity":"..."},{"food":"...","quantity":"..."}], "lunch": [{"food":"...","quantity":"..."},{"food":"...","quantity":"..."}], "snack": [{"food":"...","quantity":"..."}], "dinner": [{"food":"...","quantity":"..."},{"food":"...","quantity":"..."}], "meal_timing": {"breakfast":"8:00 AM","lunch":"1:00 PM","snack":"5:00 PM","dinner":"8:00 PM"}, "total_kcal": ${mk}, "total_protein_g": ${mp}, "water_liters": 3.5 },
      { "day": 6, "breakfast": [{"food":"...","quantity":"..."},{"food":"...","quantity":"..."}], "lunch": [{"food":"...","quantity":"..."},{"food":"...","quantity":"..."}], "snack": [{"food":"...","quantity":"..."}], "dinner": [{"food":"...","quantity":"..."},{"food":"...","quantity":"..."}], "meal_timing": {"breakfast":"8:00 AM","lunch":"1:00 PM","snack":"5:00 PM","dinner":"8:00 PM"}, "total_kcal": ${mk - 50}, "total_protein_g": ${mp - 5}, "water_liters": 3 },
      { "day": 7, "breakfast": [{"food":"...","quantity":"..."},{"food":"...","quantity":"..."}], "lunch": [{"food":"...","quantity":"..."},{"food":"...","quantity":"..."}], "snack": [{"food":"...","quantity":"..."}], "dinner": [{"food":"...","quantity":"..."},{"food":"...","quantity":"..."}], "meal_timing": {"breakfast":"8:00 AM","lunch":"1:00 PM","snack":"5:00 PM","dinner":"8:00 PM"}, "total_kcal": ${mk - 10}, "total_protein_g": ${mp - 1}, "water_liters": 3 }
    ],
    "weekly_notes": ["...", "...", "..."],
    "smart_swaps": [{"instead_of":"...","choose":"..."},{"instead_of":"...","choose":"..."},{"instead_of":"...","choose":"..."}]
  }
}
`;
};

// Validate every day's total_kcal and total_protein_g after AI generation.
// Fixes clearly invalid values (0, negative, < 400 kcal) and logs out-of-range warnings.
// Does NOT force values into range when the meals themselves are different — that would be dishonest.
const validateAndFixWeeks = (
  weeks: WeekPlan[],
  nt: ReturnType<typeof calcNutritionTargets>,
  formId: number,
): WeekPlan[] => {
  const calorieTarget = Math.round((nt.calorieMin + nt.calorieMax) / 2);
  const calorieLow    = Math.round(nt.calorieMin * 0.80); // 20% below min is the warning threshold
  const calorieHigh   = Math.round(nt.calorieMax * 1.20); // 20% above max is the warning threshold
  const proteinLow    = Math.round(nt.proteinMin * 0.75);
  const proteinHigh   = Math.round(nt.proteinMax * 1.25);

  return weeks.map((week) => ({
    ...week,
    days: (week.days ?? []).map((day) => {
      let kcal    = Number(day.total_kcal    ?? 0);
      let protein = Number(day.total_protein_g ?? 0);

      // Fix: clearly invalid calorie (missing, zero, negative, or absurdly low)
      if (!kcal || kcal < 400) {
        console.warn(`[validation] form ${formId} W${week.week} D${day.day}: total_kcal=${kcal} invalid — replacing with target ${calorieTarget}`);
        kcal = calorieTarget;
      } else if (kcal < calorieLow || kcal > calorieHigh) {
        // Soft warning — meals may just be lighter/heavier but not necessarily wrong
        console.warn(`[validation] form ${formId} W${week.week} D${day.day}: total_kcal=${kcal} outside range ${nt.calorieMin}–${nt.calorieMax} (±20% threshold: ${calorieLow}–${calorieHigh})`);
      }

      // Fix: clearly invalid protein (missing, zero, or under 10 g)
      if (!protein || protein < 10) {
        console.warn(`[validation] form ${formId} W${week.week} D${day.day}: total_protein_g=${protein} invalid — replacing with target ${nt.proteinTarget}`);
        protein = nt.proteinTarget;
      } else if (protein < proteinLow || protein > proteinHigh) {
        console.warn(`[validation] form ${formId} W${week.week} D${day.day}: total_protein_g=${protein} outside range ${nt.proteinMin}–${nt.proteinMax} (±25% threshold: ${proteinLow}–${proteinHigh})`);
      }

      return { ...day, total_kcal: kcal, total_protein_g: protein };
    }),
  }));
};

// Extract all food names from a generated week to prevent repetition in subsequent weeks
const extractMealNames = (week: WeekPlan): string[] => {
  const names = new Set<string>();
  for (const day of week.days ?? []) {
    for (const item of [...(day.breakfast ?? []), ...(day.lunch ?? []), ...(day.snack ?? []), ...(day.dinner ?? [])]) {
      if (item.food) names.add(item.food);
    }
  }
  return [...names];
};

// Single OpenAI call with retry — 3 attempts on primary, then 3 attempts on fallback model
const callOpenAIWithRetry = async (prompt: string, label: string): Promise<Record<string, unknown>> => {
  const DELAYS = [15_000, 30_000, 60_000];

  const tryModel = async (modelName: string): Promise<Record<string, unknown> | null> => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const completion = await openaiClient.chat.completions.create({
          model: modelName,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.4,
          max_tokens: 16384,
        });
        const choice = completion.choices[0];
        if (choice?.finish_reason === 'length') {
          throw new Error('Response truncated — output hit token limit before JSON was complete');
        }
        const raw = choice?.message?.content ?? '';
        return JSON.parse(raw);
      } catch (err: unknown) {
        const status = (err as { status?: number }).status;
        const message = (err as Error).message ?? String(err);
        if (attempt < 3) {
          const delay = DELAYS[attempt - 1] ?? 60_000;
          console.warn(`[openai] ${label} (${modelName}) attempt ${attempt} failed (status=${status ?? 'unknown'}, msg=${message}), retrying in ${delay / 1000}s…`);
          await new Promise((r) => setTimeout(r, delay));
        } else {
          console.warn(`[openai] ${label} (${modelName}) exhausted after 3 attempts — last error: status=${status ?? 'unknown'}, msg=${message}`);
        }
      }
    }
    return null;
  };

  // Try primary model first
  const primary = await tryModel(OPENAI_PRIMARY_MODEL);
  if (primary) return primary;

  // Fall back to cheaper model
  console.warn(`[openai] ${label} falling back to ${OPENAI_FALLBACK_MODEL}…`);
  const fallback = await tryModel(OPENAI_FALLBACK_MODEL);
  if (fallback) return fallback;

  throw new Error(`[openai] ${label} failed on both ${OPENAI_PRIMARY_MODEL} and ${OPENAI_FALLBACK_MODEL}`);
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
  const [form, config] = await Promise.all([
    findDietFormById(formId),
    loadNutritionConfig(),
  ]);
  if (!form) { console.error(`[delivery] form ${formId} not found`); return; }

  // Skip if a completed plan already exists for this form (non-dietitian flow only)
  if (!dietitianId && !existingPlanId) {
    const existing = await findDietPlanByFormId(formId);
    if (existing && existing.status === 'completed') return;
  }

  const vitals = calcVitals(form, config);
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

  // ── Step 1: Generate via Gemini week by week ─────────────────────────────────
  let generatedData: Record<string, unknown> = {};
  const planType = form.plan_type ?? 1;
  const totalWeeks = weeksOverride ?? PLAN_WEEKS[planType] ?? 1;
  const duration = weeksOverride === 4 ? '1 Month (4 Weeks)' : (PLAN_LABELS[planType] ?? '1 Week');
  const nt = calcNutritionTargets(form, vitals, config);

  try {
    // Week 1 — split into two calls to stay within OpenAI's 16 384-token output limit
    console.log(`[delivery] Generating week 1/${totalWeeks} meta (summary + recipes) for form ${formId}…`);
    const week1Meta = await callOpenAIWithRetry(buildWeek1MetaPrompt(form, vitals, totalWeeks, duration, nt), 'week-1-meta');

    console.log(`[delivery] Generating week 1/${totalWeeks} days for form ${formId}…`);
    const week1Days = await callOpenAIWithRetry(buildWeek1DaysPrompt(form, vitals, totalWeeks, nt), 'week-1-days');

    // Merge meta + days into the same shape the rest of the pipeline expects
    const week1Result: Record<string, unknown> = { ...week1Meta, week: week1Days.week };

    const allWeeks: WeekPlan[] = [week1Result.week as WeekPlan];
    const usedMeals = extractMealNames(week1Result.week as WeekPlan);

    // Weeks 2 to N — smaller focused calls, each avoids repeating prior meals
    for (let w = 2; w <= totalWeeks; w++) {
      console.log(`[delivery] Generating week ${w}/${totalWeeks} for form ${formId}…`);
      const weekResult = await callOpenAIWithRetry(buildWeekNPrompt(form, vitals, w, totalWeeks, usedMeals, nt), `week-${w}`);
      const weekData = weekResult.week as WeekPlan;
      allWeeks.push(weekData);
      usedMeals.push(...extractMealNames(weekData));
    }

    // Validate and fix any clearly broken calorie/protein values before saving
    const validatedWeeks = validateAndFixWeeks(allWeeks, nt, formId);

    // Merge into the same final structure — response shape is unchanged
    generatedData = {
      summary:          week1Result.summary,
      hydration_guide:  week1Result.hydration_guide,
      general_tips:     week1Result.general_tips,
      featured_recipes: week1Result.featured_recipes,
      weeks:            validatedWeeks,
    };
  } catch (lastAiErr) {
    console.error('[delivery] OpenAI failed after retries:', lastAiErr);
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
    // Vitals — always from our own calculation, never from AI
    bmi:          vitals.bmi,
    bmi_category: vitals.bmi_category,
    bmr:          vitals.bmr,
    tdee:         vitals.tdee,
    client_profile: clientProfile,

    // Identity — prefer form data, fall back to what AI echoed
    client_name: form.full_name ?? summary.client_name ?? '',

    // Macro targets — always from nt (our DB-driven calculation), never trust AI to echo correctly
    calorie_range:    nt.calorieRange,
    protein_target_g: nt.proteinTarget,
    carbs_target_g:   nt.carbsTarget,
    fat_target_g:     nt.fatTarget,

    // Plan metadata — from our own variables, not AI
    plan_duration: duration,
    diet_type:     form.diet_type ?? '',

    // primary_goal — AI writes a nice human label (e.g. "Weight Loss & Energy") so keep it,
    // but fall back to form goals if AI returns nothing
    primary_goal: summary.primary_goal ?? (form.goals as string[] ?? []).join(', ') ?? '',

    // AI-generated content
    hydration_guide:  (generatedData.hydration_guide as string)              ?? '',
    weeks:            (generatedData.weeks         as WeekPlan[])            ?? [],
    general_tips:     (generatedData.general_tips  as string[])              ?? [],
    featured_recipes: (generatedData.featured_recipes as FeaturedRecipe[])   ?? [],
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
