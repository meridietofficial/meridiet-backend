import { query, execute } from '../config/database';

export interface DietForm {
  id: number;
  user_id: number | null;
  full_name: string | null;
  age: number | null;
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say' | null;
  dob: Date | null;
  height_unit: 'cm' | 'ft_in' | null;
  height: string | null;
  weight_unit: 'kg' | 'lbs' | null;
  weight: number | null;
  body_type: 'slim' | 'average' | 'overweight' | 'obese' | 'athletic' | null;
  basic_notes: string | null;
  goals: string[] | null;
  activity_level: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'super_active' | null;
  sleep_duration: 'less_than_5' | '5_6' | '6_7' | '7_8' | 'more_than_8' | null;
  water_intake: 'less_than_1l' | '1_2l' | '2_3l' | '3_4l' | 'more_than_4l' | null;
  work_type: 'desk_job' | 'standing_job' | 'physical_job' | null;
  workout_frequency: 'never' | '1x' | '2_3x' | '4_5x' | 'daily' | null;
  workout_type: 'none' | 'gym' | 'yoga' | 'running' | 'sports' | 'mixed' | null;
  daily_steps: 'less_2k' | '2k_5k' | '5k_8k' | '8k_12k' | 'more_12k' | null;
  diet_type: 'vegetarian' | 'non_vegetarian' | 'eggetarian' | null;
  cuisine_preference: string[] | null;
  preferred_meals: 'home_cooked' | 'restaurant' | 'meal_prep' | 'no_preference' | null;
  food_allergies: string[] | null;
  foods_dislike: string | null;
  favorite_foods: string | null;
  breakfast_time: string | null;
  mid_morning_time: string | null;
  lunch_time: string | null;
  evening_snack_time: string | null;
  dinner_time: string | null;
  medical_conditions: string[] | null;
  other_condition: string | null;
  on_medication: 'yes_regularly' | 'yes_occasionally' | 'no' | null;
  medications: string | null;
  food_intolerances: string[] | null;
  other_intolerance: string | null;
  digestive_health: 'excellent' | 'good' | 'average' | 'poor' | null;
  smoke_alcohol: 'neither' | 'smoke' | 'alcohol' | 'both' | null;
  health_notes: string | null;
  budget: 'under_500' | '500_1k' | '1k_2k' | '2k_3k' | 'above_3k' | null;
  meal_preference: 'home_cooked' | 'meal_prep' | 'ready_to_eat' | 'food_delivery' | null;
  prep_time: 'less_30min' | '30_60min' | '1_2hrs' | 'more_2hrs' | null;
  grocery_shopping: 'online' | 'local_market' | 'both' | null;
  cooking_support: 'self' | 'someone_helps' | 'full_time_help' | null;
  other_preferences: string | null;
  contact_name: string | null;
  whatsapp: string | null;
  email: string | null;
  delivery_method: 'whatsapp' | 'email' | null;
  city: string | null;
  state: string | null;
  final_notes: string | null;
  created_at: Date;
  updated_at: Date;
}

const JSON_FIELDS = ['goals', 'cuisine_preference', 'food_allergies', 'medical_conditions', 'food_intolerances'];

const parse = (row: DietForm) => {
  const r = row as unknown as Record<string, unknown>;
  for (const field of JSON_FIELDS) {
    if (typeof r[field] === 'string') {
      r[field] = JSON.parse(r[field] as string);
    }
  }
  return row;
};

const serialize = (data: Partial<DietForm>) => {
  const payload: Record<string, unknown> = { ...data };
  for (const field of JSON_FIELDS) {
    if (Array.isArray(payload[field])) {
      payload[field] = JSON.stringify(payload[field]);
    }
  }
  return payload;
};

export const findDietFormById = async (id: number) => {
  const rows = await query<DietForm>('SELECT * FROM diet_forms WHERE id = ? LIMIT 1', [id]);
  return rows[0] ? parse(rows[0]) : null;
};

export const findDietFormByUserId = async (user_id: number) => {
  const rows = await query<DietForm>('SELECT * FROM diet_forms WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [user_id]);
  return rows[0] ? parse(rows[0]) : null;
};

export const createDietForm = async (data: Partial<DietForm>) => {
  const payload = serialize(data);
  const fields = Object.keys(payload).join(', ');
  const placeholders = Object.keys(payload).map(() => '?').join(', ');
  const result = await execute(
    `INSERT INTO diet_forms (${fields}) VALUES (${placeholders})`,
    Object.values(payload),
  );
  return findDietFormById(result.insertId);
};

export const updateDietForm = async (id: number, data: Partial<DietForm>) => {
  const payload = serialize(data);
  const fields = Object.keys(payload).map((k) => `${k} = ?`).join(', ');
  await execute(`UPDATE diet_forms SET ${fields} WHERE id = ?`, [...Object.values(payload), id]);
  return findDietFormById(id);
};
