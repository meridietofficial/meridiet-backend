import { query, execute } from '../config/database';

export interface DietForm {
  id: number;
  user_id: number | null;
  plan_type: number | null;

  // Step 1: Basic Details & Goals
  full_name: string | null;
  age: number | null;
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say' | null;
  dob: string | null;
  height_unit: 'cm' | 'ft_in' | null;
  height: string | null;
  weight_unit: 'kg' | 'lbs' | null;
  weight: number | null;
  goals: string[] | null;

  // Step 2: Lifestyle
  activity_level: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'super_active' | null;
  work_type: 'desk_job' | 'standing_job' | 'physical_job' | null;
  workout_type: 'none' | 'gym' | 'yoga' | 'running' | 'sports' | 'mixed' | null;

  // Step 3: Food Preferences
  diet_type: 'vegetarian' | 'non_vegetarian' | 'eggetarian' | null;
  cuisine_preference: string[] | null;
  food_allergies: string[] | null;
  foods_dislike: string | null;
  favorite_foods: string | null;

  // Step 4: Health & Medical
  medical_conditions: string[] | null;
  other_condition: string | null;
  on_medication: 'yes_regularly' | 'yes_occasionally' | 'no' | null;
  medications: string | null;
  digestive_health: 'excellent' | 'good' | 'average' | 'poor' | null;
  smoke_alcohol: 'neither' | 'smoke' | 'occasionally_smoke' | 'alcohol' | 'occasionally_drink' | 'both' | null;
  health_notes: string | null;

  // Step 5: Contact Details
  contact_name: string | null;
  whatsapp: string | null;
  email: string | null;
  delivery_method: string[] | null;
  city: string | null;
  state: string | null;
  state_code: string | null;
  final_notes: string | null;

  created_at: Date;
  updated_at: Date;
}

const JSON_FIELDS = [
  'goals',
  'cuisine_preference',
  'food_allergies',
  'medical_conditions',
  'delivery_method',
];

const ALLOWED_FIELDS = new Set([
  'user_id', 'plan_type', 'full_name', 'age', 'gender', 'dob',
  'height_unit', 'height', 'weight_unit', 'weight', 'goals',
  'activity_level', 'work_type', 'workout_type', 'diet_type',
  'cuisine_preference', 'food_allergies', 'foods_dislike', 'favorite_foods',
  'medical_conditions', 'other_condition', 'on_medication', 'medications',
  'digestive_health', 'smoke_alcohol', 'health_notes', 'contact_name',
  'whatsapp', 'email', 'delivery_method', 'city', 'state', 'state_code', 'final_notes',
]);

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
  const filtered = Object.fromEntries(Object.entries(data).filter(([k]) => ALLOWED_FIELDS.has(k)));
  const payload = serialize(filtered as Partial<DietForm>);
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
