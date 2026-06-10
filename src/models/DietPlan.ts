import { query, execute } from '../config/database';

export interface MealItem {
  food: string;
  quantity: string;
}

export interface FeaturedRecipe {
  name: string;
  cook_time: string;
  servings: number;
  calories: number;
  ingredients: string[];
  steps: string[];
  macros: {
    carbs_g: number;
    protein_g: number;
    fat_g: number;
    fiber_g: number;
  };
}

export interface WeekDay {
  day: number;
  breakfast: MealItem[];
  lunch: MealItem[];
  snack: MealItem[];
  dinner: MealItem[];
  meal_timing: {
    breakfast: string;
    lunch: string;
    snack: string;
    dinner: string;
  };
  total_kcal: number;
  total_protein_g: number;
  water_liters: number;
}

export interface WeekPlan {
  week: number;
  title: string;
  description: string;
  focus: string[];
  what_to_expect: string;
  days: WeekDay[];
  weekly_notes: string[];
  smart_swaps: { instead_of: string; choose: string }[];
}

export interface DietPlan {
  id: number;
  form_id: number;
  user_id: number | null;
  status: 'generating' | 'completed' | 'failed';

  // Calculated vitals
  bmi: number | null;
  bmi_category: string | null;
  bmr: number | null;
  tdee: number | null;

  // Summary
  client_name: string | null;
  calorie_range: string | null;
  protein_target_g: number | null;
  carbs_target_g: number | null;
  fat_target_g: number | null;
  primary_goal: string | null;
  plan_duration: string | null;
  diet_type: string | null;
  hydration_guide: string | null;

  // JSON columns
  client_profile: object | string | null;
  weeks: WeekPlan[] | string | null;
  general_tips: string[] | string | null;
  featured_recipes: FeaturedRecipe[] | string | null;

  pdf_url: string | null;
  created_at: Date;
  updated_at: Date;
}

const parseJson = <T>(val: T | string | null): T | null => {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') {
    try { return JSON.parse(val) as T; } catch { return null; }
  }
  return val as T;
};

const parse = (row: DietPlan): DietPlan => {
  row.client_profile   = parseJson<object>(row.client_profile);
  row.weeks            = parseJson<WeekPlan[]>(row.weeks);
  row.general_tips     = parseJson<string[]>(row.general_tips);
  row.featured_recipes = parseJson<FeaturedRecipe[]>(row.featured_recipes);
  return row;
};

export const createDietPlan = async (form_id: number, user_id: number | null) => {
  const result = await execute(
    'INSERT INTO diet_plans (form_id, user_id, status) VALUES (?, ?, ?)',
    [form_id, user_id, 'generating'],
  );
  const rows = await query<DietPlan>('SELECT * FROM diet_plans WHERE id = ? LIMIT 1', [result.insertId]);
  return rows[0] ? parse(rows[0]) : null;
};

export const updateDietPlanData = async (id: number, data: {
  bmi: number;
  bmi_category: string;
  bmr: number;
  tdee: number;
  client_name: string;
  calorie_range: string;
  protein_target_g: number;
  carbs_target_g: number;
  fat_target_g: number;
  primary_goal: string;
  plan_duration: string;
  diet_type: string;
  hydration_guide: string;
  client_profile: object;
  weeks: WeekPlan[];
  general_tips: string[];
  featured_recipes: FeaturedRecipe[];
}, status: 'completed' | 'failed') => {
  await execute(
    `UPDATE diet_plans SET
      status = ?,
      bmi = ?, bmi_category = ?, bmr = ?, tdee = ?,
      client_name = ?, calorie_range = ?,
      protein_target_g = ?, carbs_target_g = ?, fat_target_g = ?,
      primary_goal = ?, plan_duration = ?, diet_type = ?, hydration_guide = ?,
      client_profile = ?, weeks = ?, general_tips = ?, featured_recipes = ?
     WHERE id = ?`,
    [
      status,
      data.bmi, data.bmi_category, data.bmr, data.tdee,
      data.client_name, data.calorie_range,
      data.protein_target_g, data.carbs_target_g, data.fat_target_g,
      data.primary_goal, data.plan_duration, data.diet_type, data.hydration_guide,
      JSON.stringify(data.client_profile),
      JSON.stringify(data.weeks),
      JSON.stringify(data.general_tips),
      JSON.stringify(data.featured_recipes),
      id,
    ],
  );
};

export const findDietPlanByFormId = async (form_id: number) => {
  const rows = await query<DietPlan>(
    'SELECT * FROM diet_plans WHERE form_id = ? ORDER BY created_at DESC LIMIT 1',
    [form_id],
  );
  return rows[0] ? parse(rows[0]) : null;
};

export const findDietPlanById = async (id: number) => {
  const rows = await query<DietPlan>('SELECT * FROM diet_plans WHERE id = ? LIMIT 1', [id]);
  return rows[0] ? parse(rows[0]) : null;
};

export const saveDietPlanPdfUrl = async (id: number, pdf_url: string) => {
  await execute('UPDATE diet_plans SET pdf_url = ? WHERE id = ?', [pdf_url, id]);
};
