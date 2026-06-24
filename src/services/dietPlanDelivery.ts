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

  // Vegetarian protein cap: pure Indian vegetarian food (paneer, dal, curd, legumes) can
  // realistically deliver 1.6g/kg/day at most. Anything higher forces the AI to hallucinate
  // inflated totals or add forbidden foods (eggs) to compensate. Cap at 1.6g/kg so the
  // target is demanding but achievable, and the AI can actually build meals that hit it.
  const VEGETARIAN_PROTEIN_CAP_PER_KG = 1.6;
  if (form.diet_type === 'vegetarian' && proteinPerKg > VEGETARIAN_PROTEIN_CAP_PER_KG) {
    proteinPerKg = VEGETARIAN_PROTEIN_CAP_PER_KG;
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

  // Fiber target: 30g for muscle gain (high protein needs more fiber for gut health),
  // 25g for all other goals (WHO baseline). Not configurable in DB yet — hardcoded here.
  const fiberTarget = isMuscle ? 30 : 25;

  // Collect prompt notes from all matched conditions (in priority order)
  const medicalNotes = matchedConditions.map((c) => c.prompt_note);

  return {
    calorieMin, calorieMax,
    calorieRange: `${calorieMin}–${calorieMax} kcal/day`,
    proteinTarget, proteinMin, proteinMax,
    proteinRange: `${proteinMin}–${proteinMax} g/day`,
    fatTarget, carbsTarget,
    fiberTarget,
    medicalNotes,
  };
};

// ── Supplement guidance engine ────────────────────────────────────────────────
// Scans medical_conditions + other_condition for deficiencies that cannot be
// corrected by food alone and injects supplement notes for the AI to include
// in general_tips. These are advisory only — always framed as "discuss with doctor".
const SUPPLEMENT_RULES: { keywords: string[]; note: string }[] = [
  {
    keywords: ['b12 deficiency', 'vitamin b12', 'b-12', 'cobalamin deficiency', 'low b12'],
    note: 'Vitamin B12 deficiency: Food sources alone (dairy, paneer, curd) are usually insufficient to correct B12 deficiency in vegetarians. Mention in general_tips that the client should ask their doctor about Methylcobalamin (B12) supplementation — typically 500–1500 mcg/day oral or monthly injections depending on severity.',
  },
  {
    keywords: ['vitamin d deficiency', 'vitamin d3', 'vit d', 'low vitamin d', 'vit-d', 'd deficiency'],
    note: 'Vitamin D deficiency: Dietary sources of Vitamin D are very limited (sunlight is the primary source). Mention in general_tips that the client should get their 25-OH Vitamin D levels tested and discuss supplementation (Cholecalciferol D3 — typically 1000–2000 IU/day or a monthly sachet) with their doctor.',
  },
  {
    keywords: ['iron deficiency', 'anaemia', 'anemia', 'low iron', 'iron deficient', 'low haemoglobin', 'low hemoglobin'],
    note: 'Iron deficiency / Anaemia: If haemoglobin is significantly low, dietary iron alone may be too slow to correct it. Mention in general_tips that the client should discuss iron supplementation (Ferrous Sulphate or Ferrous Bisglycinate) with their doctor. Always take iron supplements on an empty stomach with Vitamin C for best absorption.',
  },
  {
    keywords: ['calcium deficiency', 'low calcium', 'osteopenia', 'osteoporosis', 'bone density'],
    note: 'Calcium deficiency / Bone health: If dietary calcium is insufficient (target ~1000mg/day from milk, curd, paneer, ragi, sesame), the client may need to discuss Calcium Carbonate or Calcium Citrate supplementation (500mg twice daily with meals) with their doctor. Always combine with Vitamin D for absorption.',
  },
  {
    keywords: ['omega 3', 'omega-3', 'low omega', 'fatty acid deficiency'],
    note: 'Omega-3 deficiency: Plant sources (flaxseeds, walnuts, chia seeds) provide ALA but conversion to EPA/DHA is limited. Mention in general_tips that the client may benefit from an Algae-based Omega-3 supplement (vegetarian-friendly, 250–500mg EPA+DHA/day) — discuss with doctor.',
  },
  {
    keywords: ['zinc deficiency', 'low zinc'],
    note: 'Zinc deficiency: Dietary sources include pumpkin seeds, sesame, whole grains, legumes. If deficiency is confirmed by blood test, the client should discuss Zinc Gluconate or Zinc Picolinate supplementation (15–30mg/day with food) with their doctor.',
  },
  {
    keywords: ['magnesium deficiency', 'low magnesium'],
    note: 'Magnesium deficiency: Include magnesium-rich foods (pumpkin seeds, almonds, dark leafy greens, banana, dark chocolate in small amounts). If deficiency persists, the client can discuss Magnesium Glycinate or Magnesium Citrate supplementation (200–400mg/day at night) with their doctor — it also helps with sleep and muscle recovery.',
  },
  {
    keywords: ['thyroid', 'hypothyroid', 'hyperthyroid', 'hashimoto', 'graves', 'thyroiditis'],
    note: 'Thyroid condition: Selenium and Zinc play a role in thyroid hormone conversion. Brazil nuts (1–2/day) are the richest selenium source. The client should have their TSH, T3, T4 monitored regularly and medication dose adjusted by their endocrinologist — do not self-adjust thyroid medication.',
  },
  {
    keywords: ['pcod', 'pcos', 'polycystic'],
    note: 'PCOD/PCOS: Research supports Myo-Inositol (2–4g/day) and D-Chiro Inositol supplementation for improving insulin sensitivity and hormonal balance in PCOS. Mention in general_tips that the client should discuss this with their gynaecologist or endocrinologist.',
  },
  {
    keywords: ['high cholesterol', 'high ldl', 'dyslipidemia', 'dyslipidaemia', 'elevated cholesterol', 'elevated ldl', 'triglycerides'],
    note: 'High Cholesterol / Dyslipidaemia: Psyllium husk (Isabgol — 1 tsp in water before meals) is clinically proven to reduce LDL. Fish oil or Algae Omega-3 can help lower triglycerides. Mention these as supplement options the client can discuss with their doctor.',
  },
];

// Reads medical_conditions + other_condition and returns supplement guidance for the AI prompt
const supplementGuidanceBlock = (form: DietForm): string => {
  const conditionText = [
    ...((form.medical_conditions ?? []) as string[]),
    form.other_condition ?? '',
  ].join(' ').toLowerCase();

  if (!conditionText.trim()) return '';

  const matched = SUPPLEMENT_RULES.filter((r) =>
    r.keywords.some((kw) => conditionText.includes(kw)),
  );

  if (matched.length === 0) return '';

  return `\nSUPPLEMENT GUIDANCE (include at least ${Math.min(matched.length, 3)} of these in general_tips — frame as "discuss with your doctor"):\n${matched.map((r, i) => `${i + 1}. ${r.note}`).join('\n')}\n`;
};

// Generates smart swap guardrails based on the client's conditions and diet type.
// Prevents the AI from suggesting swaps that are harmful or irrelevant for the client.
const smartSwapConstraintsBlock = (form: DietForm, usedSwaps: string[] = []): string => {
  const conditionText = [
    ...((form.medical_conditions ?? []) as string[]),
    form.other_condition ?? '',
    form.medications ?? '',
  ].join(' ').toLowerCase();

  const banned: string[] = [];

  // Universal bans — bad "healthy" suggestions the AI commonly makes
  banned.push('Never suggest fruit smoothies, packaged juices, or sweetened beverages as a healthy swap — they are high in sugar and spike blood sugar.');
  banned.push('Never suggest protein bars as a primary food swap — they are often high in sugar and artificial ingredients.');
  banned.push('Never suggest "diet" versions of packaged foods (diet biscuits, diet chips) as healthy swaps.');

  // Condition-specific bans
  const isSugarSensitive = ['thyroid', 'diabetes', 'pcod', 'pcos', 'insulin', 'sugar', 'high cholesterol', 'elevated cholesterol', 'triglyceride'].some((kw) => conditionText.includes(kw));
  if (isSugarSensitive) {
    banned.push('This client has a sugar-sensitive condition — do NOT suggest jaggery, honey, fruit juices, sweetened lassi, or any high-sugar food as a healthy alternative.');
  }

  const hasKidney = ['kidney', 'ckd', 'renal'].some((kw) => conditionText.includes(kw));
  if (hasKidney) {
    banned.push('Kidney condition: Do NOT suggest high-potassium swaps (banana, orange, tomato juice) or high-protein alternatives.');
  }

  const hasUricAcid = ['uric acid', 'gout', 'hyperuricemia'].some((kw) => conditionText.includes(kw));
  if (hasUricAcid) {
    banned.push('High uric acid: Do NOT suggest spinach, rajma, chole, or mushrooms as swap alternatives.');
  }

  // Uniqueness rule — pass already-used swap "instead_of" values from prior weeks
  const uniquenessRule = usedSwaps.length > 0
    ? `Each smart_swap must be UNIQUE and not repeat any of these already-used swaps from earlier weeks: ${usedSwaps.join(', ')}.`
    : 'Each smart_swap must be practical, specific, and genuinely useful for this client\'s goals and conditions.';

  return `
SMART SWAP RULES (MANDATORY):
${banned.map((b, i) => `${i + 1}. ${b}`).join('\n')}
${banned.length + 1}. ${uniquenessRule}
${banned.length + 2}. Good swap format: replace a common unhealthy habit with a specific, named healthier alternative (e.g., "Instead of white bread → choose multigrain roti").
`;
};

// Injects a mandatory high-protein food checklist when the client is vegetarian + muscle gain.
// Without this, the AI generates typical Indian meals that only reach 50-70g protein/day.
// Adjusts recommendations when the client has uric acid, poor digestion, or a dairy allergy.
const vegetarianProteinBoostBlock = (form: DietForm, nt: ReturnType<typeof calcNutritionTargets>): string => {
  const goals = ((form.goals ?? []) as string[]).map((g) => g.toLowerCase());
  const isMuscle = goals.some((g) => g.includes('muscle') || g.includes('strength') || g.includes('bulk'));
  if (form.diet_type !== 'vegetarian' || !isMuscle) return '';

  const conditionText = [
    ...((form.medical_conditions ?? []) as string[]),
    form.other_condition ?? '',
  ].join(' ').toLowerCase();

  const allergyText = ((form.food_allergies ?? []) as string[]).join(' ').toLowerCase();
  const hasDairyAllergy  = ['milk', 'dairy', 'whey'].some((kw) => allergyText.includes(kw));
  const hasUricAcid      = ['uric acid', 'gout', 'hyperuricemia'].some((kw) => conditionText.includes(kw));
  const hasPoorDigestion = form.digestive_health === 'poor';

  // If dairy-allergic: skip paneer/curd anchors entirely — wheyProteinBlock handles protein via plant powder
  if (hasDairyAllergy) {
    // Uric acid case: rajma/chole/masoor are high-purine and cannot be used as legume protein here
    if (hasUricAcid) {
      return `
VEGETARIAN HIGH-PROTEIN REQUIREMENT (dairy allergy + HIGH URIC ACID — no paneer/curd — to hit ${nt.proteinTarget}g/day):
Use ONLY these low-purine, non-dairy high-protein vegetarian sources:
1. Moong Dal / Toor Dal: minimum 2–3 cups cooked daily (~18–22g protein) — STRICTLY moong or toor ONLY; NO rajma, chole, masoor dal, or chana dal (high-purine, contraindicated for uric acid)
2. Mixed Nuts and Seeds: 50–70g across meals — almonds, walnuts, pumpkin seeds (~12–15g protein)
3. Whole grains (oats, whole wheat roti): at least 4 servings (~12–16g protein)
4. Supplement gap with plant protein powder (pea/rice protein) — see PROTEIN SUPPLEMENTATION section above.
Avoid all dairy (no paneer, no curd, no milk, no ghee) AND all high-purine legumes (no rajma, chole, masoor, chana dal).
`;
    }

    return `
VEGETARIAN HIGH-PROTEIN REQUIREMENT (dairy allergy — no paneer/curd — to hit ${nt.proteinTarget}g/day):
Since the client is dairy-allergic, use ONLY non-dairy high-protein vegetarian sources:
1. Moong Dal / Toor Dal: minimum 2 cups cooked daily (~16–18g protein)
2. Roasted Chana / Rajma / Chole / Moong Dal: 80–100g across meals (~18–22g protein)
3. Mixed Nuts and Seeds: 50g as snack — almonds, walnuts, pumpkin seeds (~10–12g protein)
4. Whole grains (oats, whole wheat roti, quinoa if available): at least 4 servings (~12–16g protein)
5. Supplement gap with plant protein powder (pea/rice protein) — see PROTEIN SUPPLEMENTATION section above.
Avoid all dairy: no paneer, no curd, no milk, no ghee in meals.
`;
  }

  // Conditional protein distribution lines to avoid contradictions with co-existing conditions
  const hasThyroidBoost = ['thyroid', 'hypothyroid', 'hyperthyroid', 'hashimoto', 'graves'].some((kw) => conditionText.includes(kw));
  // Breakfast: tofu/soy is forbidden for thyroid patients
  const breakfastList = hasThyroidBoost
    ? 'besan chilla / moong dal chilla / paneer paratha / Greek yogurt with oats'
    : 'besan chilla / moong dal chilla / paneer paratha / Greek yogurt with oats / tofu scramble';
  // Lunch: rajma/chole are high-purine — swap for moong/toor dal for uric acid clients
  const lunchDistLine = hasUricAcid
    ? '100–150g paneer sabzi OR moong dal/toor dal (1.5 cups) PLUS another dal — NO rajma or chole (high-purine) — paneer MUST appear at lunch or dinner'
    : '100–150g paneer sabzi OR rajma/chole (1.5 cups) PLUS dal — paneer MUST appear at lunch or dinner, not skipped';
  // Snack + dinner curd: 150g for poor digestion (consistent with curdAnchor above)
  const snackYogurt = hasPoorDigestion ? '150g curd (room temperature)' : '1 cup Greek yogurt (200g)';
  const dinnerCurd  = hasPoorDigestion
    ? '100g+ paneer OR 1.5 cups dal + 150g curd (soft, room temperature — not cold)'
    : '100g+ paneer OR 1.5 cups dal + 200g curd';

  // Uric acid: rajma, chole, masoor dal are high-purine — substitute with moong/toor
  const legumeAnchor = hasUricAcid
    ? '2. Moong Dal / Toor Dal: minimum 2 cups cooked (~14–16g protein) — use ONLY moong/toor; DO NOT include rajma, chole, or masoor dal (high-purine, contraindicated for uric acid)'
    : hasPoorDigestion
      ? '2. Moong Dal (soft-cooked): minimum 2 cups cooked (~14g protein) — prefer soft moong over rajma or chole which are heavier to digest'
      : '2. Dal / Rajma / Chole / Moong: minimum 1.5 cups cooked (~15–18g protein)';

  // Poor digestion: avoid curd in large amounts (can cause bloating); prefer smaller portions of soft curd
  const curdAnchor = hasPoorDigestion
    ? '3. Curd (soft, room temperature): 150g (~5–7g protein) — do NOT serve cold curd; small portions are easier to digest'
    : '3. Curd or Greek Yogurt: minimum 200g (~7–11g protein)';

  return `
VEGETARIAN HIGH-PROTEIN REQUIREMENT (MANDATORY — to hit ${nt.proteinTarget}g protein/day):
Each day MUST include AT LEAST these protein anchors:
1. Paneer: minimum 150g total across all meals (~27g protein)
${legumeAnchor}
${curdAnchor}
4. Roasted Chana or Mixed Nuts: 40–50g as snack (~9–10g protein)
5. Whole grains (chapati, roti, oats): at least 3 servings (~9–12g protein)
Avoid low-protein fillers like plain rice, plain poha, or plain fruit as a complete meal.

PROTEIN DISTRIBUTION — structure every day like this to reliably hit ${nt.proteinTarget}g:
- Breakfast (target 15–20g): ${breakfastList}
- Lunch (target 25–35g): ${lunchDistLine}
- Snack (target 10–15g): 50g roasted chana OR 30–40g mixed nuts OR ${snackYogurt}
- Dinner (target 20–25g): ${dinnerCurd}

CRITICAL: Before writing total_protein_g for any day, SUM the protein_g of every meal item you listed. If the sum is below ${nt.proteinMin}g, add more paneer or dal to that day — do NOT echo ${nt.proteinTarget}g as the total when the meals do not actually contain it.
`;
};

// Decides whether to suggest whey or plant-based protein supplementation.
// Logic: only fire when the protein target is genuinely hard to hit from whole food alone.
// Adjusts recommendation based on diet type, digestive health, and contraindications.
const wheyProteinBlock = (form: DietForm, nt: ReturnType<typeof calcNutritionTargets>): string => {
  const conditionText = [
    ...((form.medical_conditions ?? []) as string[]),
    form.other_condition ?? '',
  ].join(' ').toLowerCase();

  // Hard stop: kidney/renal patients must never get high-protein supplements
  const hasKidney = ['kidney', 'ckd', 'renal', 'creatinine'].some((kw) => conditionText.includes(kw));
  if (hasKidney) return '';

  const goals = ((form.goals ?? []) as string[]).map((g) => g.toLowerCase());
  const isMuscle  = goals.some((g) => g.includes('muscle') || g.includes('strength') || g.includes('bulk'));
  const isVeg     = form.diet_type === 'vegetarian';
  const isEgg     = form.diet_type === 'eggetarian';
  const isNonVeg  = form.diet_type === 'non_vegetarian';

  // Threshold: is the protein target realistically hard to cover from whole food alone?
  // Vegetarian Indian food tops out at ~70g/day without supplements.
  // Eggetarian can go higher with eggs (~90g). Non-veg can go higher still.
  const needsWhey =
    (isVeg    && nt.proteinTarget > 70)  ||   // pure veg food cannot reliably exceed 70g/day
    (isEgg    && nt.proteinTarget > 90)  ||   // eggs help but >90g is still hard
    (isNonVeg && isMuscle && nt.proteinTarget > 130); // non-veg at very high bulk targets

  if (!needsWhey) return '';

  // Check for dairy/lactose contraindications
  const allergyText = ((form.food_allergies ?? []) as string[]).join(' ').toLowerCase();
  const hasDairyAllergy  = ['milk', 'dairy', 'whey'].some((kw) => allergyText.includes(kw));
  const hasLactoseIssue  = ['lactose'].some((kw) => conditionText.includes(kw) || allergyText.includes(kw));
  const hasPoorDigestion = form.digestive_health === 'poor';

  // Plant-based protein: when dairy/whey is allergic
  if (hasDairyAllergy) {
    return `
PROTEIN SUPPLEMENTATION — PLANT PROTEIN REQUIRED (dairy allergy):
This client's protein target of ${nt.proteinTarget}g/day is hard to reach from food alone, and they have a dairy/whey allergy so whey protein is NOT suitable.
1. Include 1 scoop (25–30g) of PLANT-BASED PROTEIN POWDER (pea protein, brown rice protein, or hemp protein) as an afternoon snack or post-workout — this adds ~20–25g protein.
2. Mix with water or a non-dairy drink (coconut milk, oat milk). Do NOT mix with dairy milk.
3. Count the supplement protein toward that day's total_protein_g.
4. Only include it on days where meals alone fall short of the protein target — skip it on days where whole food already covers ${nt.proteinTarget}g.
5. Mention in weekly_notes: "On days when your meals fall short of your protein goal, 1 scoop of plant protein (pea/rice protein) in water can help — discuss with your dietitian before starting."
`;
  }

  // Whey isolate: for lactose intolerance or poor digestion
  if (hasLactoseIssue || hasPoorDigestion) {
    return `
PROTEIN SUPPLEMENTATION — WHEY ISOLATE RECOMMENDED (digestive sensitivity):
This client's protein target of ${nt.proteinTarget}g/day is hard to reach from food alone. Since they have digestive sensitivity or lactose issues, recommend WHEY ISOLATE (not whey concentrate) — isolate is virtually lactose-free and much easier to digest.
1. Include 1 scoop (25–30g) of WHEY ISOLATE as an afternoon snack or post-workout — this adds ~24–27g protein.
2. Mix with water only (not milk) to further reduce lactose load.
3. Count the supplement protein toward that day's total_protein_g.
4. Only include it on days where food alone falls short of ${nt.proteinTarget}g protein — do NOT add it on days that already hit the target from meals.
5. Mention in weekly_notes: "If whole-food meals don't reach your protein goal, 1 scoop of Whey Isolate in water can help — isolate is gentler on digestion than concentrate. Discuss with your dietitian before starting."
`;
  }

  // Standard recommendation — vegetarian gets a clearer label
  const wheyLabel = isVeg || isEgg
    ? 'Whey Protein (Whey Concentrate or Whey Isolate — both are vegetarian-friendly as they are derived from milk, not meat)'
    : 'Whey Protein (Whey Concentrate or Whey Isolate)';

  const usageNote = isMuscle
    ? `include it especially on workout days in the post-workout or snack slot (within 30–60 min after training)`
    : `include it in the afternoon snack slot on days when meals are expected to fall short of the protein target`;

  return `
PROTEIN SUPPLEMENTATION — WHEY PROTEIN RECOMMENDED:
This client's protein target of ${nt.proteinTarget}g/day ${isVeg ? 'is very difficult to achieve from vegetarian food alone (realistic food max ~65–70g/day)' : isEgg ? 'is hard to achieve consistently without supplementation' : 'is high and may benefit from supplementation on heavy training days'}.
1. Include 1 scoop (25–30g) of ${wheyLabel} — this adds ~22–27g protein per serving.
2. Preferred timing: ${usageNote}.
3. Mix with 200–300ml water or 200ml milk (milk adds another ~7g protein).
4. Count the supplement's protein toward that day's total_protein_g — do not ignore it.
5. IMPORTANT: Only add whey on days where whole-food meals cannot realistically hit ${nt.proteinTarget}g on their own. On days where the meal plan already covers the protein target from paneer, dal, curd, eggs, or meat — skip the supplement for that day.
6. Mention in weekly_notes: "On days when your meals fall short of your protein goal, 1 scoop of Whey Protein in water or milk can bridge the gap — discuss with your dietitian or doctor before starting any supplement."
`;
};

// ── Medication timing engine ──────────────────────────────────────────────────
// Each entry: keywords to detect (lowercase), and the timing/food rule to inject.
// Checked in order — a single medication text can match multiple entries.
const MEDICATION_TIMING_RULES: { keywords: string[]; rule: string }[] = [
  {
    keywords: ['thyroxine', 'levothyroxine', 'thyronorm', 'eltroxin', 'thyroid tablet'],
    rule: 'Thyroid medication (Thyroxine/Levothyroxine): Take on a completely EMPTY STOMACH 30–60 minutes before breakfast. Calcium-rich foods (milk, paneer, curd) eaten too soon after the tablet reduce its absorption by up to 40%. Schedule breakfast no earlier than 30 min after the tablet.',
  },
  {
    keywords: ['metformin', 'glucophage', 'glycomet', 'gluconorm', 'janumet', 'vildagliptin', 'glipizide', 'glimepiride', 'sitagliptin', 'insulin'],
    rule: 'Diabetes medication (Metformin/insulin/oral hypoglycaemics): Always take WITH meals — never on an empty stomach. Space carbohydrates evenly across all meals; avoid large single-meal carb loads. Prefer low-GI foods (oats, bajra, whole wheat, legumes) over refined carbs and sugary foods.',
  },
  {
    keywords: ['iron', 'ferrous', 'ferric', 'haematinic', 'ferrograd', 'fefol', 'orofer'],
    rule: 'Iron supplement: Take on an EMPTY STOMACH or with a Vitamin-C–rich food (lemon juice, amla, orange) to maximise absorption. Avoid tea, coffee, or dairy within 1 hour before and after the iron tablet — calcium and tannins block iron absorption significantly.',
  },
  {
    keywords: ['calcium', 'shelcal', 'calcirol', 'caltrate', 'carbocal'],
    rule: 'Calcium supplement: Take WITH meals (improves absorption). Do NOT take at the same time as an iron tablet or thyroid medication — space them at least 2 hours apart.',
  },
  {
    keywords: ['vitamin d', 'cholecalciferol', 'calcitriol', 'd3', 'arachitol', 'uprise'],
    rule: 'Vitamin D supplement: Take WITH a meal that contains some fat (e.g., with lunch or dinner that includes ghee, nuts, or paneer) — Vitamin D is fat-soluble and absorption is significantly higher with dietary fat.',
  },
  {
    keywords: ['atorvastatin', 'rosuvastatin', 'statin', 'lipitor', 'crestor', 'storvas', 'rosuvas'],
    rule: 'Statin (cholesterol medication): Take in the EVENING or at night — cholesterol synthesis is highest overnight. Avoid large high-fat meals close to the dose. Grapefruit and grapefruit juice should be avoided as they interfere with statin metabolism.',
  },
  {
    keywords: ['warfarin', 'acenocoumarol', 'acitrom', 'blood thinner', 'anticoagulant'],
    rule: 'Blood thinner (Warfarin/Acenocoumarol): Maintain CONSISTENT Vitamin K intake day-to-day — do not suddenly increase or decrease green leafy vegetables (spinach, methi, sarson). Abrupt changes in leafy veg intake can destabilise INR levels. Avoid alcohol.',
  },
  {
    keywords: ['omeprazole', 'pantoprazole', 'rabeprazole', 'esomeprazole', 'lansoprazole', 'ppi', 'antacid', 'pan 40', 'omez'],
    rule: 'Acid-suppressing medication (PPI/antacid): Take 30–60 minutes BEFORE the first meal of the day on an empty stomach for best effect. Avoid spicy, fried, and acidic foods. Eat smaller, more frequent meals rather than 2–3 large meals.',
  },
  {
    keywords: ['aspirin', 'ecosprin', 'disprin', 'clopidogrel', 'plavix'],
    rule: 'Aspirin/antiplatelet: Always take WITH food or milk to prevent stomach irritation and GI bleeding. Avoid on an empty stomach. Omega-3–rich foods (flaxseeds, walnuts) complement antiplatelet therapy.',
  },
  {
    keywords: ['amlodipine', 'telmisartan', 'losartan', 'enalapril', 'ramipril', 'lisinopril', 'bp tablet', 'blood pressure', 'antihypertensive', 'olmesartan', 'metoprolol', 'atenolol'],
    rule: 'Blood pressure medication: Take at the SAME TIME every morning (most BP medications). Reduce sodium intake — limit pickle, papad, processed foods. Increase potassium-rich foods (banana, coconut water, dal, spinach). Avoid grapefruit juice with calcium channel blockers.',
  },
  {
    keywords: ['prednisolone', 'dexamethasone', 'betamethasone', 'steroid', 'corticosteroid', 'methylprednisolone'],
    rule: 'Corticosteroid (steroid): Always take WITH food or milk — never on empty stomach. Steroids increase blood sugar and sodium retention; limit refined carbs, sugar, and salty foods. Increase calcium and Vitamin D foods to counter bone loss from long-term steroid use.',
  },
  {
    keywords: ['b12', 'methylcobalamin', 'cyanocobalamin', 'neurobion', 'cobadex', 'mecobalamin'],
    rule: 'Vitamin B12 supplement: Can be taken at any time, ideally with a meal. For vegetarians, dietary B12 is nearly absent (eggs, dairy are the only sources) — supplementation is essential; do not rely on food alone to correct B12 deficiency.',
  },
];

// Reads form.medications free-text, matches against MEDICATION_TIMING_RULES,
// and returns a formatted block for the AI prompt. Falls back to a general note
// if the client is on medication but no specific rule matches.
const medicationTimingBlock = (form: DietForm): string => {
  if (!form.medications || form.on_medication === 'no') return '';

  const medText = form.medications.toLowerCase();
  const conditionTextMed = [...((form.medical_conditions ?? []) as string[]), form.other_condition ?? ''].join(' ').toLowerCase();
  const hasKidneyMed   = ['kidney', 'ckd', 'renal', 'creatinine'].some((kw) => conditionTextMed.includes(kw));
  const hasUricAcidMed = ['uric acid', 'gout', 'hyperuricemia'].some((kw) => conditionTextMed.includes(kw));

  const matched = MEDICATION_TIMING_RULES.filter((r) =>
    r.keywords.some((kw) => medText.includes(kw)),
  );

  const rules = matched.length > 0
    ? matched.map((r, i) => {
        // BP medication rule: banana/coconut water/spinach must be adjusted for kidney or uric acid
        if (r.keywords.includes('blood pressure')) {
          if (hasKidneyMed) {
            return `${i + 1}. Blood pressure medication: Take at the SAME TIME every morning. Reduce sodium — limit pickle, papad, processed foods. IMPORTANT — kidney disease present: potassium-rich foods (banana, coconut water, spinach) must be RESTRICTED — use small portions of moong/toor dal for potassium instead. Avoid grapefruit juice with calcium channel blockers.`;
          }
          if (hasUricAcidMed) {
            return `${i + 1}. Blood pressure medication: Take at the SAME TIME every morning. Reduce sodium — limit pickle, papad, processed foods. Increase potassium from banana, coconut water, sweet potato, and moong/toor dal — avoid spinach for potassium (high-purine, restricted for uric acid). Avoid grapefruit juice with calcium channel blockers.`;
          }
        }
        return `${i + 1}. ${r.rule}`;
      }).join('\n')
    : `1. Client is on medication (${form.medications}). Advise them to consult their doctor for specific food-drug timing. As a general rule, avoid recommending large meals immediately before or after any tablet.`;

  return `\nMEDICATION & FOOD TIMING (MANDATORY — mention these in weekly_notes or general_tips):\n${rules}\n`;
};

// ── Deficiency & condition food-guidance engine ───────────────────────────────
// Scans both medical_conditions[] and other_condition free text for known
// deficiencies / conditions and injects specific food-pairing and avoidance
// rules into the prompt. This is separate from medicalConstraintsBlock (which
// handles macro-level DB overrides) — here we handle qualitative food rules.
const DEFICIENCY_RULES: { keywords: string[]; rules: string[] }[] = [
  {
    keywords: ['iron deficiency', 'anaemia', 'anemia', 'low iron', 'iron deficient', 'low haemoglobin', 'low hemoglobin'],
    rules: [
      'Iron deficiency: Include iron-rich foods DAILY — spinach (palak), methi, rajma, chole, masoor dal, ragi, sesame seeds (til), jaggery (gur).',
      'Iron absorption: ALWAYS pair iron-rich foods with a Vitamin C source — squeeze lemon on dal/sabzi, add amla chutney, or serve with a small glass of nimbu pani. This doubles iron absorption.',
      'Iron blockers: Do NOT serve tea, coffee, or dairy products within 1 hour of an iron-rich meal — tannins and calcium block iron absorption. Schedule tea as a mid-morning break, not with meals.',
    ],
  },
  {
    keywords: ['b12 deficiency', 'vitamin b12', 'b-12', 'cobalamin deficiency', 'low b12'],
    rules: [
      'B12 deficiency (vegetarian): Dietary B12 is found ONLY in animal products. For vegetarians, reliable sources are: milk (2 glasses/day), curd/dahi (200g/day), paneer, and fortified foods. Include at least 2 of these EVERY day.',
      'B12 note: Food alone is usually insufficient to correct a B12 deficiency in vegetarians — mention in general_tips that the client should discuss B12 supplementation with their doctor.',
    ],
  },
  {
    keywords: ['vitamin d deficiency', 'vitamin d3', 'vit d', 'low vitamin d', 'vit-d', 'd deficiency'],
    rules: [
      'Vitamin D deficiency: Include fat-containing meals at lunch (ghee on roti, nuts, paneer) since Vitamin D from supplements absorbs best with dietary fat.',
      'Vitamin D note: Sun exposure (10–15 min of morning sunlight on arms and legs) is the most effective natural source. Mention this in general_tips. Dietary sources are limited but include fortified milk, mushrooms (if not disliked), and egg yolk (for non-vegetarians).',
    ],
  },
  {
    keywords: ['thyroid', 'hypothyroid', 'hyperthyroid', 'hashimoto', 'graves'],
    rules: [
      'Thyroid condition: Goitrogenic vegetables (cabbage, cauliflower, broccoli, kale, radish) can interfere with thyroid function when eaten raw. Always cook these vegetables before serving — cooking deactivates most goitrogens.',
      'Thyroid condition: Avoid recommending raw cabbage salads or uncooked cruciferous vegetables. Cooked versions (stir-fried, steamed, in sabzi) are fine in moderate amounts.',
      'Thyroid & soy: Soy and soy-based foods (tofu, soy milk, soya chunks, soya granules) can inhibit thyroid hormone absorption — exclude these from all meals.',
    ],
  },
  {
    keywords: ['diabetes', 'diabetic', 'type 2', 'type2', 'blood sugar', 'hyperglycemia', 'prediabetes', 'insulin resistance'],
    rules: [
      'Diabetes: Prioritise low-GI foods — oats, barley, bajra, jowar, whole wheat, rajma, chole, moong dal over white rice, maida, or refined grains.',
      'Diabetes: Limit fruit portions to 1 small serving/meal and avoid fruit juices. Prefer whole fruits with fibre over juices.',
      'Diabetes: Never give a carbohydrate-only meal (e.g., plain rice + dal without sabzi/protein). Always balance carbs with protein and fat to blunt the blood sugar spike.',
    ],
  },
  {
    keywords: ['pcod', 'pcos', 'polycystic', 'hormonal imbalance'],
    rules: [
      'PCOD/PCOS: Prioritise anti-inflammatory foods — turmeric, ginger, flaxseeds, walnuts, leafy greens. Limit refined carbs, sugar, and fried foods.',
      'PCOD/PCOS: Include inositol-rich foods (legumes, whole grains) and magnesium-rich foods (pumpkin seeds, dark leafy greens, almonds) to support insulin sensitivity.',
    ],
  },
  {
    keywords: ['high cholesterol', 'elevated cholesterol', 'dyslipidemia', 'dyslipidaemia', 'high ldl', 'elevated ldl', 'triglycerides', 'lipid'],
    rules: [
      'High Cholesterol: Include soluble fibre daily — oats, barley, apples, psyllium (isabgol), rajma, and chole are excellent. Soluble fibre reduces LDL.',
      'High Cholesterol: Replace saturated fats (butter, cream, coconut oil in excess) with unsaturated fats — use mustard oil, olive oil, or flaxseed oil in cooking. Include walnuts and flaxseeds as snacks.',
      'High Cholesterol: Avoid trans fats completely — no vanaspati, margarine, packaged biscuits, or commercial namkeen.',
    ],
  },
  {
    keywords: ['hypertension', 'high blood pressure', 'bp high', 'elevated bp'],
    rules: [
      'Hypertension: Strictly limit sodium — no extra salt at the table, limit pickle, papad, processed/packaged foods, and namkeen. Daily sodium target: under 2000mg.',
      'Hypertension: Increase potassium-rich foods (banana, coconut water, dal, spinach, sweet potato) to help lower blood pressure naturally.',
    ],
  },
  {
    keywords: ['low cholesterol', 'low hdl', 'low lipid'],
    rules: [
      'Low cholesterol/Low HDL: Include healthy fat sources — avocado (if available), nuts (almonds, walnuts), seeds (flaxseed, chia), olive oil, and fatty foods like paneer and full-fat curd to support HDL levels.',
    ],
  },
  {
    keywords: ['uric acid', 'gout', 'hyperuricemia'],
    rules: [
      'High uric acid/Gout: Avoid high-purine foods — limit rajma, chole, masoor dal, spinach, and mushrooms. Prefer moong dal and toor dal as lower-purine legume options.',
      'High uric acid: Increase water intake to at least 3 litres/day to help flush uric acid. Avoid fructose-rich foods (fruit juices, packaged sweets).',
    ],
  },
  {
    keywords: ['ckd', 'kidney', 'renal', 'creatinine'],
    rules: [
      'Kidney/CKD: Limit high-potassium foods (banana, orange, tomato in large amounts, potatoes) and high-phosphorus foods (dairy in large amounts, nuts, seeds) unless advised otherwise by nephrologist.',
      'Kidney/CKD: Keep protein portions moderate — do NOT push high-protein foods. Use only the protein target specified in the macros above.',
    ],
  },
];

// Scans medical_conditions array AND other_condition free text together
// Returns a formatted block for the AI prompt, or empty string if nothing matched
const deficiencyGuidanceBlock = (form: DietForm): string => {
  const conditionText = [
    ...((form.medical_conditions ?? []) as string[]),
    form.other_condition ?? '',
  ].join(' ').toLowerCase();

  if (!conditionText.trim()) return '';

  const matchedRules: string[] = [];
  for (const entry of DEFICIENCY_RULES) {
    if (entry.keywords.some((kw) => conditionText.includes(kw))) {
      matchedRules.push(...entry.rules);
    }
  }

  if (matchedRules.length === 0) return '';

  // Multi-condition conflict detection — each pair gives opposing food guidance.
  // Inject resolution notes so the AI doesn't blindly follow contradictory rules.
  const hasIron         = ['iron deficiency', 'iron deficient', 'anaemia', 'anemia', 'low iron', 'low haemoglobin', 'low hemoglobin'].some((kw) => conditionText.includes(kw));
  const hasUricAcid     = ['uric acid', 'gout', 'hyperuricemia'].some((kw) => conditionText.includes(kw));
  const hasCholesterol  = ['high cholesterol', 'elevated cholesterol', 'dyslipidemia', 'dyslipidaemia', 'high ldl', 'elevated ldl', 'triglycerides', 'lipid'].some((kw) => conditionText.includes(kw));
  const hasHypertension = ['hypertension', 'high blood pressure', 'bp high', 'elevated bp'].some((kw) => conditionText.includes(kw));
  const hasDiabetesDef  = ['diabetes', 'diabetic', 'type 2', 'type2', 'blood sugar', 'hyperglycemia', 'prediabetes', 'insulin resistance'].some((kw) => conditionText.includes(kw));
  const hasPCOSDef      = ['pcod', 'pcos', 'polycystic', 'hormonal imbalance'].some((kw) => conditionText.includes(kw));
  const hasKidneyDef    = ['ckd', 'kidney', 'renal', 'creatinine'].some((kw) => conditionText.includes(kw));
  const isSugarSensitiveDef = hasDiabetesDef || hasPCOSDef;

  // Iron + uric acid: rajma, chole, masoor dal, spinach are both iron-rich AND high-purine
  if (hasIron && hasUricAcid) {
    const ironUricNote = isSugarSensitiveDef
      ? 'CONFLICT — Iron deficiency + High Uric Acid + Sugar-Sensitive (Diabetes/PCOS): Avoid rajma, chole, masoor dal, spinach (high-purine) AND jaggery/dates (high-GI). Use ONLY: ragi (finger millet), sesame seeds (til), cooked methi leaves, beetroot. Always pair with Vitamin C (lemon/amla) for absorption.'
      : 'CONFLICT — Iron deficiency AND High Uric Acid: Do NOT use rajma, chole, masoor dal, or spinach for iron (they are high-purine). Instead use these LOW-PURINE iron sources: ragi (finger millet), sesame seeds (til), jaggery (gur), methi leaves (cooked), beetroot, and dates. Always pair with Vitamin C (lemon juice, amla) for absorption.';
    matchedRules.push(ironUricNote);
  }

  // Iron + diabetes/PCOS (no uric acid): jaggery is a standard iron source but is high-GI
  if (hasIron && isSugarSensitiveDef && !hasUricAcid) {
    matchedRules.push('CONFLICT — Iron deficiency AND Diabetes/PCOS: Jaggery is a common iron-rich food but is high-GI and will spike blood sugar. Use these LOW-GI iron sources instead: ragi (finger millet), sesame seeds (til), cooked methi leaves, and beetroot. Always pair with Vitamin C (lemon/amla) for absorption — exclude jaggery as an iron source.');
  }

  // High cholesterol + uric acid: rajma/chole are recommended for soluble fibre but are high-purine
  if (hasCholesterol && hasUricAcid) {
    matchedRules.push('CONFLICT — High Cholesterol AND High Uric Acid: Rajma and chole are excellent for LDL-lowering soluble fibre but are high-purine (uric acid restriction). Use oats, barley, psyllium husk (isabgol), apple, flaxseeds, and moong dal for soluble fibre instead — these reduce LDL AND are low-purine.');
  }

  // Hypertension + uric acid: spinach is recommended for potassium but is high-purine
  if (hasHypertension && hasUricAcid) {
    matchedRules.push('CONFLICT — Hypertension AND High Uric Acid: Spinach is recommended for potassium (blood pressure) but is high-purine (uric acid restriction). Use banana, coconut water, sweet potato, and moong/toor dal for potassium instead — these are low-purine and effective for blood pressure control.');
  }

  // Hypertension + kidney: banana and coconut water recommended for BP but restricted in kidney (high potassium)
  if (hasHypertension && hasKidneyDef) {
    matchedRules.push('CONFLICT — Hypertension AND Kidney Disease: Banana, coconut water, and spinach are recommended for potassium (blood pressure) but must be restricted in kidney disease (high potassium load). Use small portions of well-cooked moong dal and vegetables for potassium instead. Sodium restriction remains essential — no pickle, papad, or processed foods.');
  }

  // Diabetes + uric acid: rajma/chole are low-GI (good for diabetes) but high-purine (bad for uric acid)
  if (hasDiabetesDef && hasUricAcid) {
    matchedRules.push('CONFLICT — Diabetes AND High Uric Acid: Rajma and chole are recommended as low-GI options for diabetes but are high-purine (uric acid restriction) — DO NOT include rajma or chole. Use moong dal, oats, barley, bajra, and whole wheat as low-GI carbohydrate sources instead — these are diabetes-friendly AND low-purine.');
  }

  // B12 deficiency + dairy allergy: the B12 rule above lists milk/curd/paneer but dairy is excluded
  const allergyTextDef = ((form.food_allergies ?? []) as string[]).join(' ').toLowerCase();
  const hasDairyAllergyDef = ['milk', 'dairy', 'whey'].some((kw) => allergyTextDef.includes(kw));
  const hasB12Def = ['b12 deficiency', 'vitamin b12', 'b-12', 'cobalamin deficiency', 'low b12'].some((kw) => conditionText.includes(kw));
  if (hasB12Def && hasDairyAllergyDef) {
    matchedRules.push('CORRECTION — B12 deficiency + Dairy Allergy: Milk, curd, and paneer (listed above as B12 sources) are EXCLUDED due to dairy allergy. For dairy-allergic vegetarians, dietary B12 is essentially unavailable — supplementation (Methylcobalamin tablets or injections) is critical, not optional. Only possible food sources: B12-fortified non-dairy foods (fortified oat milk, nutritional yeast) if available.');
  }

  return `\nDIETARY GUIDANCE FOR CLIENT'S CONDITIONS (MANDATORY — integrate into meals and tips):\n${matchedRules.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n`;
};

// Formats medical constraint notes into a prompt section (empty string if no conditions)
const medicalConstraintsBlock = (medicalNotes: string[]): string =>
  medicalNotes.length === 0
    ? ''
    : `\nMEDICAL NUTRITION CONSTRAINTS (MANDATORY — follow strictly for every meal):\n${medicalNotes.map((n, i) => `${i + 1}. ${n}`).join('\n')}\n`;

// Injects meal guidelines based on digestive health status.
// 'excellent' and 'good' → no rules needed (AI default is fine).
// 'average' → gentle guidance. 'poor' → strict easy-to-digest rules.
const digestiveHealthBlock = (form: DietForm): string => {
  const dh = form.digestive_health;
  if (!dh || dh === 'excellent' || dh === 'good') return '';

  if (dh === 'poor') {
    const allergyText = ((form.food_allergies ?? []) as string[]).join(' ').toLowerCase();
    const hasDairyAllergy = ['milk', 'dairy', 'whey'].some((kw) => allergyText.includes(kw));

    const conditionTextDig = [...((form.medical_conditions ?? []) as string[]), form.other_condition ?? ''].join(' ').toLowerCase();
    const hasThyroidDig = ['thyroid', 'hypothyroid', 'hyperthyroid', 'hashimoto', 'graves'].some((kw) => conditionTextDig.includes(kw));

    const probioticLine = hasDairyAllergy
      ? '3. Include gut-healing foods DAILY: soft khichdi, idli, dosa, kanji (rice water) — curd and buttermilk are excluded due to dairy allergy.'
      : '3. Include probiotic and gut-healing foods DAILY: curd/dahi (200g), buttermilk/chaas (200ml), soft khichdi, idli, or dosa.';

    // Tofu (soy) is excluded for thyroid patients — soy blocks thyroid hormone absorption
    const proteinLine = hasDairyAllergy
      ? (hasThyroidDig
        ? '4. Prefer easy-to-digest proteins: moong dal (soft-cooked) — avoid heavy legumes (rajma, chole) in large portions. No paneer or curd (dairy allergy). Tofu excluded due to thyroid condition (soy blocks thyroid hormone absorption).'
        : '4. Prefer easy-to-digest proteins: moong dal (soft-cooked), tofu (if not allergic to soy) — avoid heavy legumes (rajma, chole) in large portions. No paneer or curd (dairy allergy).')
      : '4. Prefer easy-to-digest proteins: moong dal, soft paneer, curd — avoid heavy legumes (rajma, chole) in large portions.';

    return `
DIGESTIVE HEALTH — POOR (MANDATORY for every meal):
1. Avoid all spicy, oily, and deep-fried foods — no samosas, pakoras, puri, bhatura, spicy gravies. Use minimal spices (jeera, haldi, ajwain only).
2. Avoid raw salads and raw cruciferous vegetables — always serve vegetables cooked or steamed.
${probioticLine}
${proteinLine}
5. Keep meals small and frequent (every 2–3 hours) instead of large heavy meals — suggest this in weekly_notes.
6. Include soothing foods in cooking: ajwain (carom seeds), jeera water between meals, fresh ginger in sabzi.
7. Spread fiber across the day — avoid a full high-fiber load at one meal (e.g. large rajma + whole bran together).
`;
  }

  // average
  const allergyTextAvg = ((form.food_allergies ?? []) as string[]).join(' ').toLowerCase();
  const hasDairyAllergyAvg = ['milk', 'dairy', 'whey'].some((kw) => allergyTextAvg.includes(kw));
  const gutHealthLine = hasDairyAllergyAvg
    ? '2. Include gut-healing foods daily: kanji (fermented rice water), idli, dosa, or soft khichdi — curd and chaas excluded due to dairy allergy.'
    : '2. Include curd or chaas (buttermilk) daily for gut health and natural probiotics.';

  return `
DIGESTIVE HEALTH — AVERAGE (gentle guidelines):
1. Limit spicy, fried, and oily preparations — prefer lightly cooked, steamed, or baked.
${gutHealthLine}
3. Prefer cooked vegetables over large raw salads — lightly stir-fried or steamed is easier to digest.
4. Avoid very large meals at once — keep portion sizes moderate and consistent across all meals.
`;
};

// Injects dietary guidance based on smoking and/or alcohol habits.
// 'neither' → no block. Otherwise injects targeted nutritional compensation rules.
const smokeAlcoholBlock = (form: DietForm): string => {
  const sa = form.smoke_alcohol;
  if (!sa || sa === 'neither') return '';

  const smokes = sa === 'smoke' || sa === 'occasionally_smoke' || sa === 'both';
  const drinks = sa === 'alcohol' || sa === 'occasionally_drink' || sa === 'both';

  const rules: string[] = [];

  if (smokes) {
    rules.push(
      'Smoking depletes Vitamin C — include high-Vitamin C foods DAILY: amla (1–2 pieces), guava, lemon juice squeezed over meals, tomatoes, capsicum (bell pepper).',
      'Smoking depletes B vitamins and zinc — include whole grains, moong dal, pumpkin seeds, and sunflower seeds regularly.',
      'Include anti-inflammatory and lung-supportive foods: fresh ginger, turmeric (haldi) in dal/sabzi, garlic in cooking.',
      'Avoid packaged, processed, or smoked foods — these worsen oxidative stress already elevated by smoking.',
    );
  }

  if (drinks) {
    const conditionTextSA = [
      ...((form.medical_conditions ?? []) as string[]),
      form.other_condition ?? '',
    ].join(' ').toLowerCase();
    const hasKidneySA = ['kidney', 'ckd', 'renal'].some((kw) => conditionTextSA.includes(kw));

    // Kidney patients must avoid high-potassium foods — banana and coconut water are restricted
    const bVitaminLine = hasKidneySA
      ? 'Alcohol depletes B vitamins (B1, B6, B9, B12), zinc, and magnesium — prioritise whole grains, dal, leafy greens, nuts, and seeds daily. Banana excluded due to kidney condition (high potassium).'
      : 'Alcohol depletes B vitamins (B1, B6, B9, B12), zinc, and magnesium — prioritise whole grains, dal, leafy greens, bananas, nuts, and seeds daily.';
    const hydrationLine = hasKidneySA
      ? 'Emphasise hydration — alcohol is dehydrating. Water target: minimum 3 litres/day. Include nimbu pani as a mid-day option — avoid coconut water (high potassium, restricted for kidney condition).'
      : 'Emphasise hydration — alcohol is dehydrating. Water target: minimum 3 litres/day. Include coconut water or nimbu pani as a mid-day option.';

    rules.push(
      bVitaminLine,
      'Include liver-supportive foods DAILY: turmeric (haldi), amla, garlic, and green leafy vegetables.',
      hydrationLine,
      'Avoid high-sodium foods (pickle, papad, packaged namkeen) — alcohol causes water retention and sodium worsens this.',
      'Never include alcohol in any meal suggestion or calorie calculation — treat the daily calorie range as food-only calories.',
    );
  }

  const label = smokes && drinks ? 'SMOKING & ALCOHOL' : smokes ? 'SMOKING' : 'ALCOHOL';
  return `\nLIFESTYLE GUIDANCE — ${label} (MANDATORY — integrate into meals and general_tips):\n${rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n`;
};

// Gender-specific general nutrition guidance — iron/calcium/hormones for female; zinc/healthy-fats for male.
// Returns '' for 'other' / 'prefer_not_to_say' to avoid assumptions.
// Adjusts recommendations based on co-existing conditions (uric acid, diabetes/PCOS, dairy allergy).
const genderNutritionBlock = (form: DietForm, nt: ReturnType<typeof calcNutritionTargets>): string => {
  const gender = form.gender;
  if (!gender || gender === 'other' || gender === 'prefer_not_to_say') return '';

  const goals = ((form.goals ?? []) as string[]).map((g) => g.toLowerCase());
  const isMuscle = goals.some((g) => g.includes('muscle') || g.includes('strength') || g.includes('bulk'));

  const conditionText = [...((form.medical_conditions ?? []) as string[]), form.other_condition ?? ''].join(' ').toLowerCase();
  const allergyText   = ((form.food_allergies ?? []) as string[]).join(' ').toLowerCase();

  const hasDairyAllergy  = ['milk', 'dairy', 'whey'].some((kw) => allergyText.includes(kw));
  const hasUricAcid      = ['uric acid', 'gout', 'hyperuricemia'].some((kw) => conditionText.includes(kw));
  // Jaggery and dates are high-GI and should be avoided in sugar-sensitive conditions
  const isSugarSensitive = ['diabetes', 'diabetic', 'pcod', 'pcos', 'polycystic', 'insulin resistance', 'prediabetes', 'blood sugar'].some((kw) => conditionText.includes(kw));

  if (gender === 'female') {
    const rules: string[] = [];

    // Iron sources: exclude jaggery and dates for diabetic/PCOS (high sugar)
    const ironSources = isSugarSensitive
      ? 'ragi, cooked methi, sesame seeds (til), or beetroot — jaggery and dates excluded due to sugar-sensitive condition'
      : 'ragi, cooked methi, sesame seeds (til), jaggery (gur), dates, or beetroot';
    rules.push(`Iron: Women require 18 mg iron/day (vs 8 mg for men) due to menstrual cycle — include iron-rich foods at least once daily: ${ironSources}. ALWAYS pair with a Vitamin C source (lemon squeeze, tomatoes, amla) in the same meal to maximise absorption. Avoid tea/coffee for 1 hour after iron-rich meals.`);

    // Calcium sources: adjust for dairy allergy + uric acid (rajma is high-purine)
    let calciumLine: string;
    if (hasDairyAllergy) {
      calciumLine = hasUricAcid
        ? 'Calcium: Women need ~1000 mg calcium/day for bone health. Dairy allergy + high uric acid present — rely on ragi flour (roti or chilla), sesame seeds (til), and cooked green leafy vegetables (except spinach) as daily calcium sources. Avoid rajma for calcium (high-purine, contraindicated for uric acid).'
        : 'Calcium: Women need ~1000 mg calcium/day for bone health. Dairy allergy present — rely on ragi flour (roti or chilla), sesame seeds (til), rajma, and green leafy vegetables as daily calcium sources.';
    } else {
      calciumLine = 'Calcium: Women need ~1000 mg calcium/day for bone health — include at least one calcium-rich food at each main meal: milk (150–200 ml), curd (200 g), paneer (100 g+), or ragi flour. These also support muscle function and hormone regulation.';
    }
    rules.push(calciumLine);

    rules.push('Hormonal balance: Include ground flaxseeds (1 tbsp added to roti/smoothie/curd) and walnuts (5–6 pieces) or ghee (1 tsp per meal) daily — omega-3 and healthy-fat sources that support oestrogen balance, reduce inflammation, and improve skin and mood.');

    if (isMuscle) {
      rules.push(`Muscle goal for women — LEAN MUSCLE & TONING (NOT bulking): Women have significantly lower testosterone than men, so a large calorie surplus leads to fat gain, not muscle mass. Keep meals high-protein (at the ${nt.proteinTarget} g target) but within the calorie range. Frame the plan around toning, strength, and energy — not size or mass gain.`);
    }

    return `\nGENDER-SPECIFIC NUTRITION — FEMALE (mandatory — integrate into meals and general_tips):\n${rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n`;
  }

  if (gender === 'male') {
    const rules: string[] = [];

    // Zinc sources: rajma is high-purine — exclude for uric acid clients
    const zincLine = hasUricAcid
      ? 'Zinc: Men need 11 mg zinc/day for testosterone, immune function, and muscle repair — include zinc-rich foods daily: pumpkin seeds (30 g as snack), whole wheat roti, and moong dal. Avoid rajma (high-purine, contraindicated for uric acid).'
      : 'Zinc: Men need 11 mg zinc/day for testosterone, immune function, and muscle repair — include zinc-rich foods daily: pumpkin seeds (30 g as snack), whole wheat roti, rajma, or moong dal.';
    rules.push(zincLine);

    rules.push('Healthy fats: Include ghee (1–2 tsp/day), walnuts (5–6 pieces), or ground flaxseeds (1 tbsp) daily to support testosterone levels and cardiovascular health.');

    if (isMuscle) {
      const preWorkout = hasDairyAllergy
        ? 'oats with plant milk, roti with moong dal, or banana with peanut butter'
        : 'oats with curd, roti with dal, or banana with peanut butter';
      let postWorkoutFoods: string;
      if (hasDairyAllergy) {
        postWorkoutFoods = form.diet_type === 'vegetarian'
          ? 'moong dal, plant protein powder (pea/rice protein), or nuts and seeds'
          : 'eggs, chicken or fish, or plant protein powder in water';
      } else if (form.diet_type === 'vegetarian') {
        postWorkoutFoods = 'curd, paneer, or Greek yogurt';
      } else {
        postWorkoutFoods = 'curd, paneer, eggs, or chicken/fish';
      }
      rules.push(`Muscle gain for men — MASS & STRENGTH: A calorie surplus of 200–300 kcal above the daily target is acceptable on training days to support muscle growth. Pre-workout meal (1–2 hours before training): complex carbs + moderate protein (${preWorkout}). Post-workout window (within 30–60 min after training): prioritise high-protein foods (${postWorkoutFoods}) to maximise muscle protein synthesis.`);
    }

    return `\nGENDER-SPECIFIC NUTRITION — MALE (integrate into meals and tips):\n${rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n`;
  }

  return '';
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

// Returns an unambiguous diet type label + hard rule so GPT-4o can't misinterpret it
const dietTypeLabel = (dietType: string | null): string => {
  switch (dietType) {
    case 'vegetarian':
      return 'Vegetarian — STRICTLY NO eggs, NO meat, NO fish, NO chicken, NO seafood. Only dairy (milk, paneer, curd, ghee) and plant-based foods are allowed.';
    case 'eggetarian':
      return 'Eggetarian — Eggs are allowed. NO meat, NO fish, NO chicken, NO seafood.';
    case 'non_vegetarian':
      return 'Non-Vegetarian — All foods including eggs, meat, fish, and chicken are allowed.';
    default:
      return 'Vegetarian — STRICTLY NO eggs, NO meat, NO fish, NO chicken, NO seafood. Only dairy (milk, paneer, curd, ghee) and plant-based foods are allowed.';
  }
};

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
- Diet Type: ${dietTypeLabel(form.diet_type ?? null)}
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

// Injected just before the JSON template in every prompt.
// Forces the model to confirm it has read every constraint before writing its first meal.
const finalCheckBlock = (form: DietForm, nt: ReturnType<typeof calcNutritionTargets>): string => {
  const items: string[] = [];

  items.push(`Diet type: ${dietTypeLabel(form.diet_type ?? null)} — apply to EVERY single meal item without exception`);

  const allergies = ((form.food_allergies ?? []) as string[]).filter(Boolean);
  if (allergies.length > 0) {
    items.push(`Food allergies: ${allergies.join(', ')} — these must NEVER appear in any meal, snack, or recipe`);
  }

  if (form.foods_dislike) {
    items.push(`Foods disliked: ${form.foods_dislike} — never include any of these in any meal`);
  }

  if (form.favorite_foods) {
    items.push(`Favourite foods: ${form.favorite_foods} — include these where appropriate to improve adherence`);
  }

  const conditions = [
    ...((form.medical_conditions ?? []) as string[]),
    form.other_condition ?? '',
  ].filter(Boolean);
  if (conditions.length > 0) {
    items.push(`Medical conditions: ${conditions.join(', ')} — all dietary constraints for these conditions listed above MUST be followed in every meal`);
  }

  if (form.medications && form.on_medication !== 'no') {
    items.push(`Medications: ${form.medications} — food-drug timing rules listed above MUST be reflected in meal timing notes`);
  }

  if (form.digestive_health === 'poor' || form.digestive_health === 'average') {
    items.push(`Digestive health is ${form.digestive_health} — all digestive guidelines above MUST be applied; no spicy/oily/fried foods`);
  }

  if (form.smoke_alcohol && form.smoke_alcohol !== 'neither') {
    items.push(`Lifestyle — ${formatLabel(form.smoke_alcohol)}: nutritional compensation rules above MUST appear in meals and general_tips`);
  }

  if (form.health_notes) {
    items.push(`Health notes from client: "${form.health_notes}" — factor this into meal planning`);
  }

  if (form.final_notes) {
    items.push(`Personal goals from client: "${form.final_notes}" — reflect this in the plan focus`);
  }

  items.push(`Calorie target: ${nt.calorieMin}–${nt.calorieMax} kcal/day — every day MUST fall within this range`);
  items.push(`Protein target: ${nt.proteinMin}–${nt.proteinMax} g/day — calculate from actual meal items, do NOT echo the target blindly`);
  items.push(`Fiber target: ~${nt.fiberTarget} g/day — distribute across all meals throughout the day`);

  const goals = ((form.goals ?? []) as string[]).map((g) => g.toLowerCase());
  const isMuscleGoal = goals.some((g) => g.includes('muscle') || g.includes('strength') || g.includes('bulk'));
  if (form.diet_type === 'vegetarian' && isMuscleGoal) {
    const allergyTextFC = ((form.food_allergies ?? []) as string[]).join(' ').toLowerCase();
    const hasDairyAllergyFC = ['milk', 'dairy', 'whey'].some((kw) => allergyTextFC.includes(kw));
    if (hasDairyAllergyFC) {
      items.push(`Vegetarian protein check (dairy allergy — NO paneer/curd): before finalising each day, confirm: (a) moong or toor dal appears in at least 2 cups cooked, (b) nuts or seeds appear in at least 50g, (c) the SUM of all protein_g values across breakfast+lunch+snack+dinner is ≥${nt.proteinMin}g. If not, add more dal or nuts before writing the day.`);
    } else {
      items.push(`Vegetarian protein check — before finalising each day, confirm: (a) paneer appears in at least one meal at ≥100g, (b) dal or legumes appear at ≥1.5 cups, (c) the SUM of all protein_g values across breakfast+lunch+snack+dinner is ≥${nt.proteinMin}g. If not, revise the meals before writing the day.`);
    }
  }

  return `
=== MANDATORY FINAL CHECKLIST — VERIFY EVERY POINT BEFORE WRITING ANY MEAL ===
${items.map((item, i) => `${i + 1}. ${item}`).join('\n')}
Do NOT start generating the JSON until you have confirmed every point above is satisfied in your plan.
=== END CHECKLIST ===
`;
};

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
- Daily Fiber Target: ~${nt.fiberTarget} g/day (from dal, sabzi, whole grains, fruits — essential for digestion and nutrient absorption)
${medicalConstraintsBlock(nt.medicalNotes)}${deficiencyGuidanceBlock(form)}${digestiveHealthBlock(form)}${smokeAlcoholBlock(form)}${genderNutritionBlock(form, nt)}${medicationTimingBlock(form)}${supplementGuidanceBlock(form)}${vegetarianProteinBoostBlock(form, nt)}${wheyProteinBlock(form, nt)}
INSTRUCTIONS:
1. Recipes must respect the diet type and strictly avoid disliked foods and allergens.
2. Use Indian home-style recipes suited to their cuisine preference.
3. Generate EXACTLY 4 featured recipes — no more, no fewer.
4. Each recipe must include: name, cook_time, servings, calories, ingredients (6–8 items), steps (4–6 steps), macros.
5. QUANTITY FORMAT (MANDATORY for all recipe ingredients): All ingredient quantities must be in grams (g) or millilitres (ml). Examples: "150g paneer", "200ml curd", "2 medium tomatoes (100g)", "1 tsp cumin seeds (3g)". NEVER use vague amounts like "some", "a handful", or "as needed".
6. Recipe calorie counts must be consistent with the daily calorie range above.
7. general_tips MUST include any supplement guidance notes provided above — frame them as "Discuss with your doctor".
8. Return VALID JSON only — no markdown, no comments, no code blocks.
9. All numeric fields must be numbers, not strings.
${finalCheckBlock(form, nt)}
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
  usedSwaps: string[] = [],
): string => {
  const mk = Math.round((nt.calorieMin + nt.calorieMax) / 2); // midpoint kcal for examples
  const mp = nt.proteinTarget;
  return `
You are an expert Indian clinical dietitian. Generate EXACTLY 7 days for Week 1 of a ${totalWeeks}-week personalized Indian diet plan in strict JSON format.

${clientBlock(form, vitals)}

CALORIE & MACRO TARGETS (calculated from client's TDEE of ${vitals.tdee} kcal/day and their goals):
- Daily Calorie Range: ${nt.calorieRange}
- Daily Protein Target: ${nt.proteinRange}
- Daily Fiber Target: ~${nt.fiberTarget} g/day (from dal, sabzi, whole grains, fruits)
${medicalConstraintsBlock(nt.medicalNotes)}${deficiencyGuidanceBlock(form)}${digestiveHealthBlock(form)}${smokeAlcoholBlock(form)}${genderNutritionBlock(form, nt)}${medicationTimingBlock(form)}${vegetarianProteinBoostBlock(form, nt)}${wheyProteinBlock(form, nt)}
CRITICAL RULES:
- You MUST generate all 7 days: day 1, day 2, day 3, day 4, day 5, day 6, day 7. Do NOT stop early.
- The "days" array must contain exactly 7 objects.
- All meals must respect the diet type and strictly avoid disliked foods and allergens.
- Use Indian home-style meals suited to their cuisine preference.
- Each day must have breakfast, lunch, snack, and dinner as arrays of meal items.
- Each meal item MUST include "protein_g": the estimated protein in grams for that item using standard Indian food nutrition values.
- QUANTITY FORMAT (MANDATORY for every item across ALL 7 days): Always specify quantities in grams (g) or millilitres (ml). If using common units, always add the gram/ml equivalent in brackets. Examples: "2 medium chapati (60g)", "1 bowl dal (200ml)", "1 cup cooked rice (180g)", "150g paneer", "200ml curd". NEVER use vague quantities like "1 bowl", "1 cup", "1 piece", or "some" without the gram/ml value.
- Include meal_timing for each day with realistic Indian meal times.
- Set "total_protein_g" as the actual SUM of all protein_g values across breakfast + lunch + snack + dinner. Do NOT just echo the target.
- Keep total_kcal between ${nt.calorieMin}–${nt.calorieMax} and total_protein_g between ${nt.proteinMin}–${nt.proteinMax} g/day.
- Include water_liters (2.5–3.5) for each day.
- Never repeat the same meal across days within this week.
- Include 3 smart_swaps and 3 weekly_notes.
${smartSwapConstraintsBlock(form, usedSwaps)}- Return VALID JSON only — no markdown, no comments, no code blocks.
- All numeric fields must be numbers, not strings.
${finalCheckBlock(form, nt)}
Return ONLY this JSON structure (days array must have exactly 7 items):
{
  "week": {
    "week": 1,
    "title": "...",
    "description": "...",
    "focus": ["...", "...", "..."],
    "what_to_expect": "...",
    "days": [
      { "day": 1, "breakfast": [{"food":"...","quantity":"...","protein_g":0},{"food":"...","quantity":"...","protein_g":0}], "lunch": [{"food":"...","quantity":"...","protein_g":0},{"food":"...","quantity":"...","protein_g":0}], "snack": [{"food":"...","quantity":"...","protein_g":0}], "dinner": [{"food":"...","quantity":"...","protein_g":0},{"food":"...","quantity":"...","protein_g":0}], "meal_timing": {"breakfast":"8:00 AM","lunch":"1:00 PM","snack":"5:00 PM","dinner":"8:00 PM"}, "total_kcal": ${mk - 50}, "total_protein_g": ${mp - 5}, "total_fiber_g": ${nt.fiberTarget}, "water_liters": 3 },
      { "day": 2, "breakfast": [...], "lunch": [...], "snack": [...], "dinner": [...], "meal_timing": {"breakfast":"8:00 AM","lunch":"1:00 PM","snack":"5:00 PM","dinner":"8:00 PM"}, "total_kcal": ${mk - 20}, "total_protein_g": ${mp - 2}, "total_fiber_g": ${nt.fiberTarget}, "water_liters": 3 },
      { "day": 3, "breakfast": [...], "lunch": [...], "snack": [...], "dinner": [...], "meal_timing": {"breakfast":"8:00 AM","lunch":"1:00 PM","snack":"5:00 PM","dinner":"8:00 PM"}, "total_kcal": ${mk - 40}, "total_protein_g": ${mp - 4}, "total_fiber_g": ${nt.fiberTarget - 2}, "water_liters": 2.5 },
      { "day": 4, "breakfast": [...], "lunch": [...], "snack": [...], "dinner": [...], "meal_timing": {"breakfast":"8:00 AM","lunch":"1:00 PM","snack":"5:00 PM","dinner":"8:00 PM"}, "total_kcal": ${mk - 30}, "total_protein_g": ${mp - 3}, "total_fiber_g": ${nt.fiberTarget}, "water_liters": 3 },
      { "day": 5, "breakfast": [...], "lunch": [...], "snack": [...], "dinner": [...], "meal_timing": {"breakfast":"8:00 AM","lunch":"1:00 PM","snack":"5:00 PM","dinner":"8:00 PM"}, "total_kcal": ${mk}, "total_protein_g": ${mp}, "total_fiber_g": ${nt.fiberTarget + 2}, "water_liters": 3.5 },
      { "day": 6, "breakfast": [...], "lunch": [...], "snack": [...], "dinner": [...], "meal_timing": {"breakfast":"8:00 AM","lunch":"1:00 PM","snack":"5:00 PM","dinner":"8:00 PM"}, "total_kcal": ${mk - 50}, "total_protein_g": ${mp - 5}, "total_fiber_g": ${nt.fiberTarget}, "water_liters": 3 },
      { "day": 7, "breakfast": [...], "lunch": [...], "snack": [...], "dinner": [...], "meal_timing": {"breakfast":"8:00 AM","lunch":"1:00 PM","snack":"5:00 PM","dinner":"8:00 PM"}, "total_kcal": ${mk - 10}, "total_protein_g": ${mp - 1}, "total_fiber_g": ${nt.fiberTarget + 1}, "water_liters": 3 }
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
  usedSwaps: string[] = [],
): string => {
  const mk = Math.round((nt.calorieMin + nt.calorieMax) / 2);
  const mp = nt.proteinTarget;
  return `
You are an expert Indian clinical dietitian. Generate Week ${weekNumber} of a ${totalWeeks}-week personalized diet plan in strict JSON format.

${clientBlock(form, vitals)}

CALORIE & MACRO TARGETS (calculated from client's TDEE of ${vitals.tdee} kcal/day and their goals):
- Daily Calorie Range: ${nt.calorieRange}
- Daily Protein Target: ${nt.proteinRange}
- Daily Fiber Target: ~${nt.fiberTarget} g/day (from dal, sabzi, whole grains, fruits)
${medicalConstraintsBlock(nt.medicalNotes)}${deficiencyGuidanceBlock(form)}${digestiveHealthBlock(form)}${smokeAlcoholBlock(form)}${genderNutritionBlock(form, nt)}${medicationTimingBlock(form)}${vegetarianProteinBoostBlock(form, nt)}${wheyProteinBlock(form, nt)}
MEALS ALREADY USED IN PREVIOUS WEEKS — do NOT repeat any of these:
${usedMeals.slice(0, 150).join(', ')}

INSTRUCTIONS:
1. All meals must respect the diet type and strictly avoid disliked foods and allergens.
2. Use Indian home-style meals suited to their cuisine preference.
3. Each day must have Breakfast, Lunch, Snack, and Dinner as arrays of meal items.
4. Each meal item MUST include "protein_g": the estimated protein in grams for that item using standard Indian food nutrition values.
5. QUANTITY FORMAT (MANDATORY for every item across ALL 7 days): Always specify quantities in grams (g) or millilitres (ml). If using common units, always add the gram/ml equivalent in brackets. Examples: "2 medium chapati (60g)", "1 bowl dal (200ml)", "1 cup cooked rice (180g)", "150g paneer", "200ml curd". NEVER use vague quantities like "1 bowl", "1 cup", "1 piece", or "some" without the gram/ml value.
6. Include meal_timing for each day with realistic Indian meal times.
7. Set "total_protein_g" as the actual SUM of all protein_g values across all meals. Do NOT just echo the target.
8. Keep total_kcal between ${nt.calorieMin}–${nt.calorieMax} and total_protein_g between ${nt.proteinMin}–${nt.proteinMax} g/day.
9. Include water_liters (2.5–3.5) for each day.
10. Generate exactly 7 days for Week ${weekNumber}.
11. Never repeat the same meals within this week or from the already used meals list above.
12. Include smart swaps and weekly tips for Week ${weekNumber}.
${smartSwapConstraintsBlock(form, usedSwaps)}13. Return VALID JSON only — no markdown, no comments, no code blocks.
14. All numeric fields must be numbers, not strings.
${finalCheckBlock(form, nt)}
Return ONLY this JSON structure (days array MUST have exactly 7 items):
{
  "week": {
    "week": ${weekNumber},
    "title": "...",
    "description": "...",
    "focus": ["...", "...", "..."],
    "what_to_expect": "...",
    "days": [
      { "day": 1, "breakfast": [{"food":"...","quantity":"...","protein_g":0},{"food":"...","quantity":"...","protein_g":0}], "lunch": [{"food":"...","quantity":"...","protein_g":0},{"food":"...","quantity":"...","protein_g":0}], "snack": [{"food":"...","quantity":"...","protein_g":0}], "dinner": [{"food":"...","quantity":"...","protein_g":0},{"food":"...","quantity":"...","protein_g":0}], "meal_timing": {"breakfast":"8:00 AM","lunch":"1:00 PM","snack":"5:00 PM","dinner":"8:00 PM"}, "total_kcal": ${mk - 50}, "total_protein_g": ${mp - 5}, "total_fiber_g": ${nt.fiberTarget}, "water_liters": 3 },
      { "day": 2, "breakfast": [{"food":"...","quantity":"...","protein_g":0},{"food":"...","quantity":"...","protein_g":0}], "lunch": [{"food":"...","quantity":"...","protein_g":0},{"food":"...","quantity":"...","protein_g":0}], "snack": [{"food":"...","quantity":"...","protein_g":0}], "dinner": [{"food":"...","quantity":"...","protein_g":0},{"food":"...","quantity":"...","protein_g":0}], "meal_timing": {"breakfast":"8:00 AM","lunch":"1:00 PM","snack":"5:00 PM","dinner":"8:00 PM"}, "total_kcal": ${mk - 20}, "total_protein_g": ${mp - 2}, "total_fiber_g": ${nt.fiberTarget}, "water_liters": 3 },
      { "day": 3, "breakfast": [{"food":"...","quantity":"...","protein_g":0},{"food":"...","quantity":"...","protein_g":0}], "lunch": [{"food":"...","quantity":"...","protein_g":0},{"food":"...","quantity":"...","protein_g":0}], "snack": [{"food":"...","quantity":"...","protein_g":0}], "dinner": [{"food":"...","quantity":"...","protein_g":0},{"food":"...","quantity":"...","protein_g":0}], "meal_timing": {"breakfast":"8:00 AM","lunch":"1:00 PM","snack":"5:00 PM","dinner":"8:00 PM"}, "total_kcal": ${mk - 40}, "total_protein_g": ${mp - 4}, "total_fiber_g": ${nt.fiberTarget - 2}, "water_liters": 2.5 },
      { "day": 4, "breakfast": [{"food":"...","quantity":"...","protein_g":0},{"food":"...","quantity":"...","protein_g":0}], "lunch": [{"food":"...","quantity":"...","protein_g":0},{"food":"...","quantity":"...","protein_g":0}], "snack": [{"food":"...","quantity":"...","protein_g":0}], "dinner": [{"food":"...","quantity":"...","protein_g":0},{"food":"...","quantity":"...","protein_g":0}], "meal_timing": {"breakfast":"8:00 AM","lunch":"1:00 PM","snack":"5:00 PM","dinner":"8:00 PM"}, "total_kcal": ${mk - 30}, "total_protein_g": ${mp - 3}, "total_fiber_g": ${nt.fiberTarget}, "water_liters": 3 },
      { "day": 5, "breakfast": [{"food":"...","quantity":"...","protein_g":0},{"food":"...","quantity":"...","protein_g":0}], "lunch": [{"food":"...","quantity":"...","protein_g":0},{"food":"...","quantity":"...","protein_g":0}], "snack": [{"food":"...","quantity":"...","protein_g":0}], "dinner": [{"food":"...","quantity":"...","protein_g":0},{"food":"...","quantity":"...","protein_g":0}], "meal_timing": {"breakfast":"8:00 AM","lunch":"1:00 PM","snack":"5:00 PM","dinner":"8:00 PM"}, "total_kcal": ${mk}, "total_protein_g": ${mp}, "total_fiber_g": ${nt.fiberTarget + 2}, "water_liters": 3.5 },
      { "day": 6, "breakfast": [{"food":"...","quantity":"...","protein_g":0},{"food":"...","quantity":"...","protein_g":0}], "lunch": [{"food":"...","quantity":"...","protein_g":0},{"food":"...","quantity":"...","protein_g":0}], "snack": [{"food":"...","quantity":"...","protein_g":0}], "dinner": [{"food":"...","quantity":"...","protein_g":0},{"food":"...","quantity":"...","protein_g":0}], "meal_timing": {"breakfast":"8:00 AM","lunch":"1:00 PM","snack":"5:00 PM","dinner":"8:00 PM"}, "total_kcal": ${mk - 50}, "total_protein_g": ${mp - 5}, "total_fiber_g": ${nt.fiberTarget}, "water_liters": 3 },
      { "day": 7, "breakfast": [{"food":"...","quantity":"...","protein_g":0},{"food":"...","quantity":"...","protein_g":0}], "lunch": [{"food":"...","quantity":"...","protein_g":0},{"food":"...","quantity":"...","protein_g":0}], "snack": [{"food":"...","quantity":"...","protein_g":0}], "dinner": [{"food":"...","quantity":"...","protein_g":0},{"food":"...","quantity":"...","protein_g":0}], "meal_timing": {"breakfast":"8:00 AM","lunch":"1:00 PM","snack":"5:00 PM","dinner":"8:00 PM"}, "total_kcal": ${mk - 10}, "total_protein_g": ${mp - 1}, "total_fiber_g": ${nt.fiberTarget + 1}, "water_liters": 3 }
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

      // Cross-check: sum protein_g from every meal item — if the stated total deviates by
      // more than 15g from the itemised sum, the AI echoed the target instead of calculating.
      // In that case, use the itemised sum (capped at proteinMax) as the honest value.
      const allItems = [
        ...(day.breakfast ?? []),
        ...(day.lunch     ?? []),
        ...(day.snack     ?? []),
        ...(day.dinner    ?? []),
      ];
      const itemisedProtein = allItems.reduce((sum, item) => sum + (Number(item.protein_g) || 0), 0);
      if (itemisedProtein > 5 && Math.abs(protein - itemisedProtein) > 15) {
        console.warn(
          `[validation] form ${formId} W${week.week} D${day.day}: total_protein_g=${protein} vs itemised sum=${itemisedProtein} — using itemised sum`,
        );
        protein = Math.min(itemisedProtein, nt.proteinMax);
      }

      // Fix: clearly invalid protein (missing, zero, or under 10 g)
      if (!protein || protein < 10) {
        console.warn(`[validation] form ${formId} W${week.week} D${day.day}: total_protein_g=${protein} invalid — replacing with target ${nt.proteinTarget}`);
        protein = nt.proteinTarget;
      } else if (protein < proteinLow || protein > proteinHigh) {
        console.warn(`[validation] form ${formId} W${week.week} D${day.day}: total_protein_g=${protein} outside range ${nt.proteinMin}–${nt.proteinMax} (±25% threshold: ${proteinLow}–${proteinHigh})`);
      }

      // Fix: clearly invalid fiber (missing, zero, or negative) — replace with target
      let fiber = Number(day.total_fiber_g ?? 0);
      if (!fiber || fiber < 1) {
        console.warn(`[validation] form ${formId} W${week.week} D${day.day}: total_fiber_g=${fiber} invalid — replacing with target ${nt.fiberTarget}`);
        fiber = nt.fiberTarget;
      } else if (fiber < 10 || fiber > 60) {
        console.warn(`[validation] form ${formId} W${week.week} D${day.day}: total_fiber_g=${fiber} outside plausible range 10–60g`);
      }

      return { ...day, total_kcal: kcal, total_protein_g: protein, total_fiber_g: fiber };
    }),
  }));
};

// Scan generated weeks for egg/meat keywords that must not appear in vegetarian/eggetarian plans.
// Logs a warning per violation so we know the AI hallucinated a forbidden ingredient.
// For vegetarian: removes the offending item and substitutes paneer so the day isn't left empty.
const EGG_KEYWORDS   = ['egg', 'eggs', 'omelette', 'omelet', 'boiled egg', 'scrambled egg', 'egg bhurji', 'egg white', 'egg yolk', 'anda'];
const MEAT_KEYWORDS  = ['chicken', 'mutton', 'lamb', 'beef', 'pork', 'fish', 'prawn', 'shrimp', 'tuna', 'salmon', 'crab', 'lobster', 'keema', 'kheema'];

const forbiddenKeywordsForDiet = (dietType: string | null): string[] => {
  if (dietType === 'vegetarian') return [...EGG_KEYWORDS, ...MEAT_KEYWORDS];
  if (dietType === 'eggetarian') return MEAT_KEYWORDS;
  return []; // non_vegetarian — nothing is forbidden
};

const sanitizeForbiddenFoods = (
  weeks: WeekPlan[],
  dietType: string | null,
  formId: number,
  form?: DietForm | null,
): WeekPlan[] => {
  const forbidden = forbiddenKeywordsForDiet(dietType);
  if (forbidden.length === 0) return weeks;

  // Determine safest replacement for the client's specific constraints:
  // dairy allergy → can't use paneer; thyroid + dairy allergy → can't use tofu/soy either
  const allergyTextSan = ((form?.food_allergies ?? []) as string[]).join(' ').toLowerCase();
  const hasDairyAllergySan = ['milk', 'dairy', 'whey'].some((kw) => allergyTextSan.includes(kw));
  const conditionTextSan = [...((form?.medical_conditions ?? []) as string[]), form?.other_condition ?? ''].join(' ').toLowerCase();
  const hasThyroidSan = ['thyroid', 'hypothyroid', 'hyperthyroid', 'hashimoto', 'graves'].some((kw) => conditionTextSan.includes(kw));
  const replacementFood = hasDairyAllergySan
    ? (hasThyroidSan ? 'Moong Dal (cooked, soft)' : 'Tofu (firm)')
    : 'Paneer (cubed)';

  const isForbidden = (food: string) => {
    const lower = food.toLowerCase();
    return forbidden.some((kw) => {
      // Use word boundaries to avoid false positives like 'veggie' matching 'egg'
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b${escaped}\\b`).test(lower);
    });
  };

  return weeks.map((week) => ({
    ...week,
    days: (week.days ?? []).map((day) => {
      const sanitizeMeal = (items: { food: string; quantity: string; protein_g: number }[], mealName: string) =>
        items.map((item) => {
          if (isForbidden(item.food)) {
            console.warn(
              `[diet-type-guard] form ${formId} W${week.week} D${day.day} ${mealName}: ` +
              `"${item.food}" is forbidden for ${dietType ?? 'vegetarian'} — replaced with ${replacementFood}`,
            );
            return { ...item, food: replacementFood, quantity: item.quantity };
          }
          return item;
        });

      return {
        ...day,
        breakfast: sanitizeMeal(day.breakfast ?? [], 'breakfast'),
        lunch:     sanitizeMeal(day.lunch     ?? [], 'lunch'),
        snack:     sanitizeMeal(day.snack     ?? [], 'snack'),
        dinner:    sanitizeMeal(day.dinner    ?? [], 'dinner'),
      };
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

// Extract "instead_of" values from smart_swaps to prevent repetition in later weeks
const extractUsedSwaps = (week: WeekPlan): string[] =>
  (week.smart_swaps ?? []).map((s) => s.instead_of).filter(Boolean);

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
    const usedSwaps  = extractUsedSwaps(week1Result.week as WeekPlan);

    // Weeks 2 to N — smaller focused calls, each avoids repeating prior meals or swaps
    for (let w = 2; w <= totalWeeks; w++) {
      console.log(`[delivery] Generating week ${w}/${totalWeeks} for form ${formId}…`);
      const weekResult = await callOpenAIWithRetry(buildWeekNPrompt(form, vitals, w, totalWeeks, usedMeals, nt, usedSwaps), `week-${w}`);
      const weekData = weekResult.week as WeekPlan;
      allWeeks.push(weekData);
      usedMeals.push(...extractMealNames(weekData));
      usedSwaps.push(...extractUsedSwaps(weekData));
    }

    // Validate and fix any clearly broken calorie/protein values before saving
    const validatedWeeks = validateAndFixWeeks(allWeeks, nt, formId);

    // Remove any forbidden foods the AI hallucinated (e.g. eggs in a vegetarian plan)
    const sanitizedWeeks = sanitizeForbiddenFoods(validatedWeeks, form.diet_type ?? null, formId, form);

    // Merge into the same final structure — response shape is unchanged
    generatedData = {
      summary:          week1Result.summary,
      hydration_guide:  week1Result.hydration_guide,
      general_tips:     week1Result.general_tips,
      featured_recipes: week1Result.featured_recipes,
      weeks:            sanitizedWeeks,
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
