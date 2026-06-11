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
  dietitian_id: number | null;
  appointment_id: number | null;
  status: 'generating' | 'completed' | 'failed' | 'draft' | 'archived';

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

  notes: string | null;
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

export const createDietPlan = async (
  form_id: number,
  user_id: number | null,
  dietitian_id?: number | null,
  appointment_id?: number | null,
) => {
  const result = await execute(
    'INSERT INTO diet_plans (form_id, user_id, dietitian_id, appointment_id, status) VALUES (?, ?, ?, ?, ?)',
    [form_id, user_id, dietitian_id ?? null, appointment_id ?? null, 'generating'],
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

export const createDraftDietPlan = async (
  form_id: number,
  user_id: number | null,
  dietitian_id: number,
  appointment_id: number,
  data: {
    client_name?: string;
    calorie_range?: string;
    protein_target_g?: number;
    carbs_target_g?: number;
    fat_target_g?: number;
    primary_goal?: string;
    plan_duration?: string;
    diet_type?: string;
    hydration_guide?: string;
    weeks?: WeekPlan[];
    general_tips?: string[];
    featured_recipes?: FeaturedRecipe[];
    notes?: string;
  },
) => {
  const result = await execute(
    `INSERT INTO diet_plans
       (form_id, user_id, dietitian_id, appointment_id, status,
        client_name, calorie_range, protein_target_g, carbs_target_g, fat_target_g,
        primary_goal, plan_duration, diet_type, hydration_guide,
        weeks, general_tips, featured_recipes, notes)
     VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      form_id, user_id, dietitian_id, appointment_id,
      data.client_name ?? null,
      data.calorie_range ?? null,
      data.protein_target_g ?? null,
      data.carbs_target_g ?? null,
      data.fat_target_g ?? null,
      data.primary_goal ?? null,
      data.plan_duration ?? null,
      data.diet_type ?? null,
      data.hydration_guide ?? null,
      data.weeks ? JSON.stringify(data.weeks) : null,
      data.general_tips ? JSON.stringify(data.general_tips) : null,
      data.featured_recipes ? JSON.stringify(data.featured_recipes) : null,
      data.notes ?? null,
    ],
  );
  const rows = await query<DietPlan>('SELECT * FROM diet_plans WHERE id = ? LIMIT 1', [result.insertId]);
  return rows[0] ? parse(rows[0]) : null;
};

export interface DietPlanListRow {
  id: number;
  form_id: number;
  appointment_id: number | null;
  user_id: number | null;
  client_name: string | null;
  status: DietPlan['status'];
  primary_goal: string | null;
  plan_duration: string | null;
  diet_type: string | null;
  pdf_url: string | null;
  created_at: Date;
  updated_at: Date;
  appointment_date: string | null;
  slot: string | null;
  user_full_name: string | null;
  user_avatar_url: string | null;
  // Form fields (from diet_forms JOIN)
  form_full_name: string | null;
  form_age: number | null;
  form_gender: string | null;
  form_height: string | null;
  form_height_unit: string | null;
  form_weight: number | null;
  form_weight_unit: string | null;
  form_goals: string | null;
  form_activity_level: string | null;
  form_diet_type: string | null;
  form_medical_conditions: string | null;
  form_plan_type: number | null;
}

export const findDietPlansByDietitianId = async (
  dietitianId: number,
  status: string | undefined,
  page: number,
  limit: number,
) => {
  const offset = (page - 1) * limit;
  const whereStatus = status ? 'AND dp.status = ?' : '';
  const params: unknown[] = status ? [dietitianId, status] : [dietitianId];

  const [rows, countRows] = await Promise.all([
    query<DietPlanListRow>(
      `SELECT
         dp.id, dp.form_id, dp.appointment_id, dp.user_id,
         dp.client_name, dp.status, dp.primary_goal, dp.plan_duration, dp.diet_type,
         dp.pdf_url, dp.created_at, dp.updated_at,
         DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointment_date,
         TIME_FORMAT(a.slot, '%H:%i')                AS slot,
         u.full_name                                 AS user_full_name,
         u.avatar_url                                AS user_avatar_url,
         f.full_name                                 AS form_full_name,
         f.age                                       AS form_age,
         f.gender                                    AS form_gender,
         f.height                                    AS form_height,
         f.height_unit                               AS form_height_unit,
         f.weight                                    AS form_weight,
         f.weight_unit                               AS form_weight_unit,
         f.goals                                     AS form_goals,
         f.activity_level                            AS form_activity_level,
         f.diet_type                                 AS form_diet_type,
         f.medical_conditions                        AS form_medical_conditions,
         f.plan_type                                 AS form_plan_type
       FROM diet_plans dp
       LEFT JOIN appointments a  ON dp.appointment_id = a.id
       LEFT JOIN users u         ON dp.user_id = u.id AND u.is_delete = 0
       LEFT JOIN diet_forms f    ON dp.form_id = f.id
       WHERE dp.dietitian_id = ? ${whereStatus}
       ORDER BY dp.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params,
    ),
    query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM diet_plans dp
       WHERE dp.dietitian_id = ? ${whereStatus}`,
      params,
    ),
  ]);

  const plans = rows.map((r) => ({
    ...r,
    client_name:   r.client_name ?? r.form_full_name ?? null,
    form_goals:             parseJson<string[]>(r.form_goals as unknown as string | null),
    form_medical_conditions: parseJson<string[]>(r.form_medical_conditions as unknown as string | null),
  }));

  return { plans, total: countRows[0]?.total ?? 0 };
};

export const updateDietPlanStatus = async (
  id: number,
  status: DietPlan['status'],
) => {
  await execute('UPDATE diet_plans SET status = ? WHERE id = ?', [status, id]);
};

export const updateDraftPlanData = async (
  id: number,
  data: {
    client_name?: string;
    calorie_range?: string;
    protein_target_g?: number;
    carbs_target_g?: number;
    fat_target_g?: number;
    primary_goal?: string;
    plan_duration?: string;
    diet_type?: string;
    hydration_guide?: string;
    weeks?: WeekPlan[];
    general_tips?: string[];
    featured_recipes?: FeaturedRecipe[];
    notes?: string;
  },
) => {
  const sets: string[] = [];
  const vals: unknown[] = [];

  const add = (col: string, val: unknown) => { sets.push(`${col} = ?`); vals.push(val); };

  if (data.client_name      !== undefined) add('client_name',      data.client_name);
  if (data.calorie_range    !== undefined) add('calorie_range',    data.calorie_range);
  if (data.protein_target_g !== undefined) add('protein_target_g', data.protein_target_g);
  if (data.carbs_target_g   !== undefined) add('carbs_target_g',   data.carbs_target_g);
  if (data.fat_target_g     !== undefined) add('fat_target_g',     data.fat_target_g);
  if (data.primary_goal     !== undefined) add('primary_goal',     data.primary_goal);
  if (data.plan_duration    !== undefined) add('plan_duration',    data.plan_duration);
  if (data.diet_type        !== undefined) add('diet_type',        data.diet_type);
  if (data.hydration_guide  !== undefined) add('hydration_guide',  data.hydration_guide);
  if (data.weeks            !== undefined) add('weeks',            JSON.stringify(data.weeks));
  if (data.general_tips     !== undefined) add('general_tips',     JSON.stringify(data.general_tips));
  if (data.featured_recipes !== undefined) add('featured_recipes', JSON.stringify(data.featured_recipes));
  if (data.notes            !== undefined) add('notes',            data.notes);

  if (sets.length === 0) return;
  vals.push(id);
  await execute(`UPDATE diet_plans SET ${sets.join(', ')} WHERE id = ?`, vals);
};
