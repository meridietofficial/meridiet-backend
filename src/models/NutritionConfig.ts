import { query } from '../config/database';

// ── Row shapes returned from each table ───────────────────────────────────────

interface BmiCategoryRow {
  min_bmi: number;
  max_bmi: number | null;
  category_name: string;
}

interface ActivityMultiplierRow {
  activity_key: string;
  multiplier: number;
}

interface GoalSettingRow {
  goal_key: string;
  calorie_min_offset: number;
  calorie_max_offset: number;
  protein_per_kg: number;
}

interface CalorieFloorRow {
  gender: string;
  min_calories: number;
}

export interface MedicalAdjustmentRow {
  condition_key: string;
  detection_keywords: string;
  priority: number;
  fat_percent: number | null;
  protein_per_kg_override: number | null;
  carb_max_percent: number | null;
  prompt_note: string;
}

interface GeneralSettingRow {
  setting_key: string;
  value: string;
  data_type: 'int' | 'float';
}

// ── The single config object passed into all calculation functions ─────────────

export interface NutritionConfig {
  // BMI: sorted by min_bmi ascending — first matching range wins
  bmiCategories: BmiCategoryRow[];

  // Activity key → PAL multiplier (e.g. 'sedentary' → 1.2)
  activityMultipliers: Record<string, number>;

  // Goal key → offsets and protein target (e.g. 'weight_loss' → { -500, -300, 1.6 })
  goalSettings: Record<string, { calorie_min_offset: number; calorie_max_offset: number; protein_per_kg: number }>;

  // Gender → minimum safe calories (e.g. 'male' → 1500)
  calorieFloors: Record<string, number>;

  // Ordered by priority ascending — used to detect and apply medical condition rules
  medicalAdjustments: MedicalAdjustmentRow[];

  // All general scalar settings pre-cast to numbers (e.g. 'min_carbs_per_day' → 130)
  general: Record<string, number>;
}

// ── Loader — reads all 6 tables in parallel ───────────────────────────────────

export const loadNutritionConfig = async (): Promise<NutritionConfig> => {
  const [bmiRows, actRows, goalRows, floorRows, medRows, genRows] = await Promise.all([
    query<BmiCategoryRow>(
      'SELECT min_bmi, max_bmi, category_name FROM nutrition_bmi_categories WHERE is_active = 1 ORDER BY display_order ASC',
    ),
    query<ActivityMultiplierRow>(
      'SELECT activity_key, multiplier FROM nutrition_activity_multipliers WHERE is_active = 1',
    ),
    query<GoalSettingRow>(
      'SELECT goal_key, calorie_min_offset, calorie_max_offset, protein_per_kg FROM nutrition_goal_settings WHERE is_active = 1',
    ),
    query<CalorieFloorRow>(
      'SELECT gender, min_calories FROM nutrition_calorie_floors',
    ),
    query<MedicalAdjustmentRow>(
      'SELECT condition_key, detection_keywords, priority, fat_percent, protein_per_kg_override, carb_max_percent, prompt_note FROM nutrition_medical_adjustments WHERE is_active = 1 ORDER BY priority ASC',
    ),
    query<GeneralSettingRow>(
      'SELECT setting_key, value, data_type FROM nutrition_general_settings',
    ),
  ]);

  const activityMultipliers: Record<string, number> = {};
  for (const r of actRows) activityMultipliers[r.activity_key] = Number(r.multiplier);

  const goalSettings: Record<string, { calorie_min_offset: number; calorie_max_offset: number; protein_per_kg: number }> = {};
  for (const r of goalRows) {
    goalSettings[r.goal_key] = {
      calorie_min_offset: Number(r.calorie_min_offset),
      calorie_max_offset: Number(r.calorie_max_offset),
      protein_per_kg:     Number(r.protein_per_kg),
    };
  }

  const calorieFloors: Record<string, number> = {};
  for (const r of floorRows) calorieFloors[r.gender] = Number(r.min_calories);

  const general: Record<string, number> = {};
  for (const r of genRows) {
    general[r.setting_key] = r.data_type === 'int'
      ? parseInt(r.value, 10)
      : parseFloat(r.value);
  }

  return {
    bmiCategories:      bmiRows,
    activityMultipliers,
    goalSettings,
    calorieFloors,
    medicalAdjustments: medRows,
    general,
  };
};
