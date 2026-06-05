import type { Request, Response } from 'express';
import { geminiModel } from '../config/gemini';
import { findDietFormById } from '../models/DietForm';
import { createDietPlan, updateDietPlanData, findDietPlanByFormId } from '../models/DietPlan';
import type { WeekPlan, FeaturedRecipe } from '../models/DietPlan';
import { successResponse, errorResponse } from '../utils/response';
import type { DietForm } from '../models/DietForm';

const PLAN_LABELS: Record<number, string> = { 1: '1 Week', 2: '1 Month (4 Weeks)', 3: '3 Months (12 Weeks)' };
const PLAN_WEEKS:  Record<number, number> = { 1: 1, 2: 4, 3: 12 };

const ACTIVITY_MULTIPLIER: Record<string, number> = {
  sedentary:          1.2,
  lightly_active:     1.375,
  moderately_active:  1.55,
  very_active:        1.725,
  super_active:       1.9,
};

const calcVitals = (form: DietForm) => {
  // Normalize height to cm
  let heightCm = parseFloat(String(form.height ?? 0));
  if (form.height_unit === 'ft_in') {
    // e.g. 5.10 means 5 ft 10 in
    const parts = String(form.height ?? '0').split('.');
    const ft    = parseInt(parts[0] ?? '0');
    const inch  = parseInt(parts[1] ?? '0');
    heightCm    = ft * 30.48 + inch * 2.54;
  }

  // Normalize weight to kg
  let weightKg = parseFloat(String(form.weight ?? 0));
  if (form.weight_unit === 'lbs') weightKg = weightKg * 0.453592;

  const age    = form.age ?? 25;
  const gender = form.gender ?? 'male';

  // BMI
  const heightM  = heightCm / 100;
  const bmi      = heightM > 0 ? parseFloat((weightKg / (heightM * heightM)).toFixed(2)) : 0;
  const bmi_category =
    bmi < 18.5 ? 'Underweight' :
    bmi < 25   ? 'Normal weight' :
    bmi < 30   ? 'Overweight' : 'Obese';

  // BMR — Mifflin-St Jeor
  const bmr = parseFloat((
    gender === 'female'
      ? 10 * weightKg + 6.25 * heightCm - 5 * age - 161
      : 10 * weightKg + 6.25 * heightCm - 5 * age + 5
  ).toFixed(2));

  // TDEE
  const multiplier = ACTIVITY_MULTIPLIER[form.activity_level ?? 'sedentary'] ?? 1.2;
  const tdee       = parseFloat((bmr * multiplier).toFixed(2));

  return { bmi, bmi_category, bmr, tdee, weightKg, heightCm };
};

const PLAN_TYPE_LABELS: Record<number, string> = { 1: '1 Week', 2: '1 Month', 3: '3 Months' };

const formatLabel = (val: string) =>
  val.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const buildClientProfile = (form: DietForm, vitals: ReturnType<typeof calcVitals>) => ({
  personal_information: {
    full_name:    form.full_name ?? null,
    age:          form.age ?? null,
    gender:       form.gender ? formatLabel(form.gender) : null,
    date_of_birth: form.dob ?? null,
    height:       `${vitals.heightCm.toFixed(1)} cm`,
    weight:       `${vitals.weightKg.toFixed(1)} kg`,
    phone:        form.whatsapp ?? null,
    email:        form.email ?? null,
    city:         form.city ?? null,
    state:        form.state ?? null,
  },
  current_vitals: {
    weight_kg:    vitals.weightKg.toFixed(1),
    height_cm:    vitals.heightCm.toFixed(1),
    bmi:          vitals.bmi,
    bmi_category: vitals.bmi_category,
    bmr_kcal:     vitals.bmr,
    tdee_kcal:    vitals.tdee,
  },
  health_and_fitness_goals: {
    goals:        form.goals ?? [],
    plan_type:    PLAN_TYPE_LABELS[form.plan_type ?? 1] ?? '1 Week',
    health_notes: form.health_notes ?? null,
    final_notes:  form.final_notes ?? null,
  },
  lifestyle_overview: {
    activity_level:  form.activity_level ? formatLabel(form.activity_level) : null,
    work_type:       form.work_type      ? formatLabel(form.work_type)      : null,
    workout_type:    form.workout_type   ? formatLabel(form.workout_type)   : null,
    smoke_alcohol:   form.smoke_alcohol  ? formatLabel(form.smoke_alcohol)  : null,
    digestive_health: form.digestive_health ? formatLabel(form.digestive_health) : null,
  },
  medical_information: {
    medical_conditions: form.medical_conditions ?? [],
    other_condition:    form.other_condition ?? null,
    on_medication:      form.on_medication ? formatLabel(form.on_medication) : null,
    medications:        form.medications ?? null,
    food_allergies:     form.food_allergies ?? [],
  },
  dietary_information: {
    diet_type:          form.diet_type ? formatLabel(form.diet_type) : null,
    cuisine_preference: form.cuisine_preference ?? [],
    foods_dislike:      form.foods_dislike ?? null,
    favorite_foods:     form.favorite_foods ?? null,
  },
  contact_details: {
    contact_name:    form.contact_name ?? null,
    whatsapp:        form.whatsapp ?? null,
    email:           form.email ?? null,
    delivery_method: form.delivery_method ?? [],
  },
});

const buildPrompt = (form: DietForm, vitals: ReturnType<typeof calcVitals>): string => {
  const planType  = form.plan_type ?? 1;
  const weeks     = PLAN_WEEKS[planType] ?? 1;
  const duration  = PLAN_LABELS[planType] ?? '1 Week';

  return `
You are an expert Indian clinical dietitian. Generate a personalized diet plan in strict JSON format based on the client details below.

CLIENT DETAILS:
- Name: ${form.full_name ?? 'Client'}
- Age: ${form.age ?? 'N/A'} | Gender: ${form.gender ?? 'N/A'}
- Height: ${vitals.heightCm.toFixed(1)} cm | Weight: ${vitals.weightKg.toFixed(1)} kg
- BMI: ${vitals.bmi} (${vitals.bmi_category})
- BMR: ${vitals.bmr} kcal/day (calories needed at complete rest)
- TDEE: ${vitals.tdee} kcal/day (total daily energy expenditure)
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
- Meals Per Day: 3 main meals + 1-2 snacks
- Plan Duration: ${duration} (${weeks} week${weeks > 1 ? 's' : ''})
- City/State: ${form.city ?? ''}, ${form.state ?? ''}
- Health Notes: ${form.health_notes ?? 'none'}
- Final Notes: ${form.final_notes ?? 'none'}

INSTRUCTIONS:
1. All meals must respect the diet type (${form.diet_type}) and strictly avoid disliked foods and allergens.
2. Use Indian home-style meals suited to their cuisine preference.
3. Each day must have Breakfast, Lunch, Snack, and Dinner as arrays of meal items with food name and quantity.
4. Include meal_timing for each day with realistic Indian meal times (e.g. Breakfast: 8:00 AM, Lunch: 1:00 PM, Snack: 5:00 PM, Dinner: 8:00 PM).
5. Keep calories between 1400–1600 kcal/day and protein between 90–110 g/day.
6. Include water_liters (2.5–3.5) for each day based on activity and goals.
7. Generate exactly ${weeks} week(s) with exactly 7 days each week.
8. Each week must have a theme (Week 1: Reset & Cleanse, Week 2: Balance & Nourish, Week 3: Strength & Sustain, Week 4: Transform & Maintain).
9. Never repeat the same breakfast, lunch, snack, or dinner within the same week.
10. All meal items must be realistic Indian home-style with clear quantity guidance (e.g. "1 cup", "100g", "2 pieces").
11. Include smart swaps and weekly tips for each week.
12. Include 4–6 featured recipes with full ingredients, step-by-step instructions, and macros.
13. Return VALID JSON only — no markdown, no comments, no code blocks, no text outside the JSON.
14. All numeric fields must be numbers, not strings.

Return ONLY this JSON structure:
{
  "summary": {
    "client_name": "${form.full_name ?? 'Client'}",
    "calorie_range": "1400-1600 kcal/day",
    "protein_target_g": 100,
    "carbs_target_g": 150,
    "fat_target_g": 50,
    "primary_goal": "...",
    "plan_duration": "${duration}",
    "diet_type": "${form.diet_type}"
  },
  "weeks": [
    {
      "week": 1,
      "title": "Reset & Cleanse",
      "description": "...",
      "focus": ["...", "..."],
      "what_to_expect": "...",
      "days": [
        {
          "day": 1,
          "breakfast": [
            { "food": "Vegetable Poha", "quantity": "1 cup (150g)" },
            { "food": "Green Tea", "quantity": "1 cup" }
          ],
          "lunch": [
            { "food": "Dal", "quantity": "1 cup (200ml)" },
            { "food": "Whole Wheat Roti", "quantity": "2 pieces" },
            { "food": "Green Salad", "quantity": "1 bowl" }
          ],
          "snack": [
            { "food": "Roasted Chana", "quantity": "30g" }
          ],
          "dinner": [
            { "food": "Paneer Bhurji", "quantity": "100g" },
            { "food": "Whole Wheat Roti", "quantity": "2 pieces" }
          ],
          "meal_timing": {
            "breakfast": "8:00 AM",
            "lunch": "1:00 PM",
            "snack": "5:00 PM",
            "dinner": "8:00 PM"
          },
          "total_kcal": 1450,
          "total_protein_g": 95,
          "water_liters": 3
        }
      ],
      "weekly_notes": ["...", "..."],
      "smart_swaps": [
        { "instead_of": "...", "choose": "..." }
      ]
    }
  ],
  "hydration_guide": "Drink 2.5-3L water daily",
  "general_tips": ["...", "..."],
  "featured_recipes": [
    {
      "name": "...",
      "cook_time": "20 mins",
      "servings": 1,
      "calories": 320,
      "ingredients": ["...", "..."],
      "steps": ["...", "..."],
      "macros": {
        "carbs_g": 48,
        "protein_g": 8,
        "fat_g": 10,
        "fiber_g": 4
      }
    }
  ]
}
`;
};

// POST /api/v1/diet-plan/generate
// Body: { form_id: number }
export const generateDietPlan = async (req: Request, res: Response) => {
  try {
    const { form_id } = req.body as { form_id?: number };
    if (!form_id) return errorResponse(res, 400, 'form_id is required');

    const form = await findDietFormById(Number(form_id));
    if (!form) return errorResponse(res, 404, 'Diet form not found');

    // Prevent duplicate — if a completed plan already exists, return it
    const existing = await findDietPlanByFormId(Number(form_id));
    if (existing && existing.status === 'completed') {
      return errorResponse(res, 409, 'A diet plan has already been generated for this form. Use GET /api/v1/diet-plan/:form_id to retrieve it.');
    }

    const userId = req.user?.sub ? Number(req.user.sub) : form.user_id;

    // Calculate BMI / BMR / TDEE before calling AI
    const vitals        = calcVitals(form);
    const clientProfile = buildClientProfile(form, vitals);

    // Create a record with generating status
    const plan = await createDietPlan(Number(form_id), userId);
    if (!plan) return errorResponse(res, 500, 'Failed to create diet plan record');

    // Call Gemini
    const prompt = buildPrompt(form, vitals);
    let generatedData: object;

    try {
      const result = await geminiModel.generateContent(prompt);
      const text = result.response.text();
      generatedData = JSON.parse(text);
    } catch (aiErr) {
      await updateDietPlanData(plan.id, {
        bmi: vitals.bmi, bmi_category: vitals.bmi_category, bmr: vitals.bmr, tdee: vitals.tdee,
        client_profile: clientProfile,
        client_name: '', calorie_range: '',
        protein_target_g: 0, carbs_target_g: 0, fat_target_g: 0,
        primary_goal: '', plan_duration: '', diet_type: '', hydration_guide: '',
        weeks: [], general_tips: [], featured_recipes: [],
      }, 'failed');
      console.error('Gemini error:', aiErr);
      return errorResponse(res, 502, 'Failed to generate diet plan from AI');
    }

    const d = generatedData as Record<string, unknown>;
    const summary = (d.summary ?? {}) as Record<string, string>;

    await updateDietPlanData(plan.id, {
      bmi:              vitals.bmi,
      bmi_category:     vitals.bmi_category,
      bmr:              vitals.bmr,
      tdee:             vitals.tdee,
      client_profile:   clientProfile,
      client_name:      summary.client_name      ?? form.full_name ?? '',
      calorie_range:    summary.calorie_range     ?? '',
      protein_target_g: Number(summary.protein_target_g) || 0,
      carbs_target_g:   Number(summary.carbs_target_g)   || 0,
      fat_target_g:     Number(summary.fat_target_g)     || 0,
      primary_goal:     summary.primary_goal      ?? '',
      plan_duration:    summary.plan_duration     ?? '',
      diet_type:        summary.diet_type         ?? '',
      hydration_guide:  (d.hydration_guide as string) ?? '',
      weeks:            (d.weeks as WeekPlan[])          ?? [],
      general_tips:     (d.general_tips as string[])     ?? [],
      featured_recipes: (d.featured_recipes as FeaturedRecipe[]) ?? [],
    }, 'completed');

    return successResponse(res, 201, 'Diet plan generated successfully', {
      plan_id:        plan.id,
      form_id,
      client_profile: clientProfile,
      ...generatedData,
    });
  } catch (err) {
    console.error('Generate diet plan error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/diet-plan/:form_id
export const getDietPlan = async (req: Request, res: Response) => {
  try {
    const form_id = Number(req.params.form_id);
    if (isNaN(form_id)) return errorResponse(res, 400, 'Invalid form_id');

    const plan = await findDietPlanByFormId(form_id);
    if (!plan) return errorResponse(res, 404, 'No diet plan found for this form');

    return successResponse(res, 200, 'Diet plan fetched successfully', {
      plan_id:        plan.id,
      form_id:        plan.form_id,
      status:         plan.status,
      client_profile: plan.client_profile,
      summary: {
        client_name:      plan.client_name,
        calorie_range:    plan.calorie_range,
        protein_target_g: plan.protein_target_g,
        carbs_target_g:   plan.carbs_target_g,
        fat_target_g:     plan.fat_target_g,
        primary_goal:     plan.primary_goal,
        plan_duration:    plan.plan_duration,
        diet_type:        plan.diet_type,
      },
      hydration_guide:  plan.hydration_guide,
      weeks:            plan.weeks,
      general_tips:     plan.general_tips,
      featured_recipes: plan.featured_recipes,
    });
  } catch (err) {
    console.error('Get diet plan error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};
