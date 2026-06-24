import { query, execute } from '../config/database';

export interface MealItem {
  food: string;
  quantity: string;
  protein_g: number;
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
  total_fiber_g: number;
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

export const findDietPlanByAppointmentId = async (appointment_id: number) => {
  const rows = await query<DietPlan>(
    'SELECT * FROM diet_plans WHERE appointment_id = ? ORDER BY created_at DESC LIMIT 1',
    [appointment_id],
  );
  return rows[0] ? parse(rows[0]) : null;
};

export const findDietPlanById = async (id: number) => {
  const rows = await query<DietPlan>('SELECT * FROM diet_plans WHERE id = ? LIMIT 1', [id]);
  return rows[0] ? parse(rows[0]) : null;
};

export interface DietPlanWithForm extends DietPlan {
  form: {
    id: number;
    full_name: string | null;
    age: number | null;
    gender: string | null;
    dob: string | null;
    height: string | null;
    height_unit: string | null;
    weight: number | null;
    weight_unit: string | null;
    goals: string[] | null;
    activity_level: string | null;
    work_type: string | null;
    workout_type: string | null;
    diet_type: string | null;
    cuisine_preference: string[] | null;
    food_allergies: string[] | null;
    foods_dislike: string | null;
    favorite_foods: string | null;
    medical_conditions: string[] | null;
    other_condition: string | null;
    on_medication: string | null;
    medications: string | null;
    digestive_health: string | null;
    smoke_alcohol: string | null;
    health_notes: string | null;
    plan_type: number | null;
  } | null;
}

export const findDietPlanWithFormById = async (id: number): Promise<DietPlanWithForm | null> => {
  const rows = await query<DietPlan & {
    f_id: number | null; f_full_name: string | null; f_age: number | null;
    f_gender: string | null; f_dob: string | null; f_height: string | null;
    f_height_unit: string | null; f_weight: number | null; f_weight_unit: string | null;
    f_goals: string | null; f_activity_level: string | null; f_work_type: string | null;
    f_workout_type: string | null; f_diet_type: string | null;
    f_cuisine_preference: string | null; f_food_allergies: string | null;
    f_foods_dislike: string | null; f_favorite_foods: string | null;
    f_medical_conditions: string | null; f_other_condition: string | null;
    f_on_medication: string | null; f_medications: string | null;
    f_digestive_health: string | null; f_smoke_alcohol: string | null;
    f_health_notes: string | null; f_plan_type: number | null;
  }>(
    `SELECT dp.*,
       f.id            AS f_id,
       f.full_name     AS f_full_name,
       f.age           AS f_age,
       f.gender        AS f_gender,
       f.dob           AS f_dob,
       f.height        AS f_height,
       f.height_unit   AS f_height_unit,
       f.weight        AS f_weight,
       f.weight_unit   AS f_weight_unit,
       f.goals         AS f_goals,
       f.activity_level       AS f_activity_level,
       f.work_type            AS f_work_type,
       f.workout_type         AS f_workout_type,
       f.diet_type            AS f_diet_type,
       f.cuisine_preference   AS f_cuisine_preference,
       f.food_allergies       AS f_food_allergies,
       f.foods_dislike        AS f_foods_dislike,
       f.favorite_foods       AS f_favorite_foods,
       f.medical_conditions   AS f_medical_conditions,
       f.other_condition      AS f_other_condition,
       f.on_medication        AS f_on_medication,
       f.medications          AS f_medications,
       f.digestive_health     AS f_digestive_health,
       f.smoke_alcohol        AS f_smoke_alcohol,
       f.health_notes         AS f_health_notes,
       f.plan_type            AS f_plan_type
     FROM diet_plans dp
     LEFT JOIN diet_forms f ON f.id = dp.form_id
     WHERE dp.id = ? LIMIT 1`,
    [id],
  );
  if (!rows[0]) return null;
  const r = rows[0];
  const plan = parse(r as unknown as DietPlan) as DietPlanWithForm;
  plan.form = r.f_id == null ? null : {
    id:                  r.f_id,
    full_name:           r.f_full_name,
    age:                 r.f_age,
    gender:              r.f_gender,
    dob:                 r.f_dob,
    height:              r.f_height,
    height_unit:         r.f_height_unit,
    weight:              r.f_weight,
    weight_unit:         r.f_weight_unit,
    goals:               parseJson<string[]>(r.f_goals),
    activity_level:      r.f_activity_level,
    work_type:           r.f_work_type,
    workout_type:        r.f_workout_type,
    diet_type:           r.f_diet_type,
    cuisine_preference:  parseJson<string[]>(r.f_cuisine_preference),
    food_allergies:      parseJson<string[]>(r.f_food_allergies),
    foods_dislike:       r.f_foods_dislike,
    favorite_foods:      r.f_favorite_foods,
    medical_conditions:  parseJson<string[]>(r.f_medical_conditions),
    other_condition:     r.f_other_condition,
    on_medication:       r.f_on_medication,
    medications:         r.f_medications,
    digestive_health:    r.f_digestive_health,
    smoke_alcohol:       r.f_smoke_alcohol,
    health_notes:        r.f_health_notes,
    plan_type:           r.f_plan_type,
  };
  return plan;
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
