import type { Request, Response } from 'express';
import { query, execute } from '../config/database';
import { successResponse, errorResponse } from '../utils/response';

// ── helpers ────────────────────────────────────────────────────────────────────

const isNum    = (v: unknown) => v !== undefined && v !== null && v !== '' && !isNaN(Number(v));
const isStr    = (v: unknown) => typeof v === 'string' && v.trim().length > 0;

// ══════════════════════════════════════════════════════════════════════════════
// 1. BMI CATEGORIES
// GET    /api/v1/admin/nutrition/bmi-categories
// POST   /api/v1/admin/nutrition/bmi-categories
// PUT    /api/v1/admin/nutrition/bmi-categories/:id
// DELETE /api/v1/admin/nutrition/bmi-categories/:id
// ══════════════════════════════════════════════════════════════════════════════

export const getBmiCategories = async (_req: Request, res: Response) => {
  try {
    const rows = await query('SELECT * FROM nutrition_bmi_categories ORDER BY display_order ASC');
    return successResponse(res, 200, 'BMI categories fetched', rows);
  } catch (err) {
    console.error('[nutritionConfig] getBmiCategories:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

export const createBmiCategory = async (req: Request, res: Response) => {
  try {
    const { min_bmi, max_bmi, category_name, display_order } = req.body as Record<string, unknown>;
    if (!isNum(min_bmi) || !isStr(category_name)) {
      return errorResponse(res, 400, 'min_bmi (number) and category_name (string) are required');
    }
    const result = await execute(
      'INSERT INTO nutrition_bmi_categories (min_bmi, max_bmi, category_name, display_order) VALUES (?, ?, ?, ?)',
      [Number(min_bmi), max_bmi != null ? Number(max_bmi) : null, String(category_name).trim(), Number(display_order ?? 0)],
    );
    return successResponse(res, 201, 'BMI category created', { id: result.insertId });
  } catch (err) {
    console.error('[nutritionConfig] createBmiCategory:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

export const updateBmiCategory = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid id');

    const { min_bmi, max_bmi, category_name, display_order, is_active } = req.body as Record<string, unknown>;

    const fields: string[] = [];
    const values: unknown[] = [];

    if (isNum(min_bmi))       { fields.push('min_bmi = ?');       values.push(Number(min_bmi)); }
    if (max_bmi !== undefined) { fields.push('max_bmi = ?');       values.push(max_bmi != null ? Number(max_bmi) : null); }
    if (isStr(category_name)) { fields.push('category_name = ?'); values.push(String(category_name).trim()); }
    if (isNum(display_order)) { fields.push('display_order = ?'); values.push(Number(display_order)); }
    if (is_active !== undefined) { fields.push('is_active = ?'); values.push(is_active ? 1 : 0); }

    if (fields.length === 0) return errorResponse(res, 400, 'No valid fields provided to update');

    values.push(id);
    await execute(`UPDATE nutrition_bmi_categories SET ${fields.join(', ')} WHERE id = ?`, values);
    return successResponse(res, 200, 'BMI category updated');
  } catch (err) {
    console.error('[nutritionConfig] updateBmiCategory:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

export const deleteBmiCategory = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid id');
    await execute('DELETE FROM nutrition_bmi_categories WHERE id = ?', [id]);
    return successResponse(res, 200, 'BMI category deleted');
  } catch (err) {
    console.error('[nutritionConfig] deleteBmiCategory:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 2. ACTIVITY MULTIPLIERS
// GET /api/v1/admin/nutrition/activity-multipliers
// PUT /api/v1/admin/nutrition/activity-multipliers/:id
// ══════════════════════════════════════════════════════════════════════════════

export const getActivityMultipliers = async (_req: Request, res: Response) => {
  try {
    const rows = await query('SELECT * FROM nutrition_activity_multipliers ORDER BY display_order ASC');
    return successResponse(res, 200, 'Activity multipliers fetched', rows);
  } catch (err) {
    console.error('[nutritionConfig] getActivityMultipliers:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

export const updateActivityMultiplier = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid id');

    const { multiplier, label, description, is_active } = req.body as Record<string, unknown>;

    const fields: string[] = [];
    const values: unknown[] = [];

    if (isNum(multiplier)) {
      const val = Number(multiplier);
      if (val <= 0 || val > 3) return errorResponse(res, 400, 'multiplier must be between 0 and 3');
      fields.push('multiplier = ?'); values.push(val);
    }
    if (isStr(label))       { fields.push('label = ?');       values.push(String(label).trim()); }
    if (isStr(description)) { fields.push('description = ?'); values.push(String(description).trim()); }
    if (is_active !== undefined) { fields.push('is_active = ?'); values.push(is_active ? 1 : 0); }

    if (fields.length === 0) return errorResponse(res, 400, 'No valid fields provided to update');

    values.push(id);
    await execute(`UPDATE nutrition_activity_multipliers SET ${fields.join(', ')} WHERE id = ?`, values);
    return successResponse(res, 200, 'Activity multiplier updated');
  } catch (err) {
    console.error('[nutritionConfig] updateActivityMultiplier:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 3. GOAL SETTINGS
// GET /api/v1/admin/nutrition/goal-settings
// PUT /api/v1/admin/nutrition/goal-settings/:id
// ══════════════════════════════════════════════════════════════════════════════

export const getGoalSettings = async (_req: Request, res: Response) => {
  try {
    const rows = await query('SELECT * FROM nutrition_goal_settings ORDER BY display_order ASC');
    return successResponse(res, 200, 'Goal settings fetched', rows);
  } catch (err) {
    console.error('[nutritionConfig] getGoalSettings:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

export const updateGoalSetting = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid id');

    const { calorie_min_offset, calorie_max_offset, protein_per_kg, label, description, is_active } = req.body as Record<string, unknown>;

    const fields: string[] = [];
    const values: unknown[] = [];

    if (isNum(calorie_min_offset)) { fields.push('calorie_min_offset = ?'); values.push(Math.round(Number(calorie_min_offset))); }
    if (isNum(calorie_max_offset)) { fields.push('calorie_max_offset = ?'); values.push(Math.round(Number(calorie_max_offset))); }
    if (isNum(protein_per_kg)) {
      const val = Number(protein_per_kg);
      if (val <= 0 || val > 4) return errorResponse(res, 400, 'protein_per_kg must be between 0 and 4');
      fields.push('protein_per_kg = ?'); values.push(val);
    }
    if (isStr(label))       { fields.push('label = ?');       values.push(String(label).trim()); }
    if (isStr(description)) { fields.push('description = ?'); values.push(String(description).trim()); }
    if (is_active !== undefined) { fields.push('is_active = ?'); values.push(is_active ? 1 : 0); }

    if (fields.length === 0) return errorResponse(res, 400, 'No valid fields provided to update');

    // Validate min < max if both are being updated
    if (isNum(calorie_min_offset) && isNum(calorie_max_offset)) {
      if (Number(calorie_min_offset) >= Number(calorie_max_offset)) {
        return errorResponse(res, 400, 'calorie_min_offset must be less than calorie_max_offset');
      }
    }

    values.push(id);
    await execute(`UPDATE nutrition_goal_settings SET ${fields.join(', ')} WHERE id = ?`, values);
    return successResponse(res, 200, 'Goal setting updated');
  } catch (err) {
    console.error('[nutritionConfig] updateGoalSetting:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 4. CALORIE FLOORS
// GET /api/v1/admin/nutrition/calorie-floors
// PUT /api/v1/admin/nutrition/calorie-floors/:id
// ══════════════════════════════════════════════════════════════════════════════

export const getCalorieFloors = async (_req: Request, res: Response) => {
  try {
    const rows = await query('SELECT * FROM nutrition_calorie_floors ORDER BY id ASC');
    return successResponse(res, 200, 'Calorie floors fetched', rows);
  } catch (err) {
    console.error('[nutritionConfig] getCalorieFloors:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

export const updateCalorieFloor = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid id');

    const { min_calories, description } = req.body as Record<string, unknown>;

    const fields: string[] = [];
    const values: unknown[] = [];

    if (isNum(min_calories)) {
      const val = Math.round(Number(min_calories));
      if (val < 800 || val > 3000) return errorResponse(res, 400, 'min_calories must be between 800 and 3000');
      fields.push('min_calories = ?'); values.push(val);
    }
    if (isStr(description)) { fields.push('description = ?'); values.push(String(description).trim()); }

    if (fields.length === 0) return errorResponse(res, 400, 'No valid fields provided to update');

    values.push(id);
    await execute(`UPDATE nutrition_calorie_floors SET ${fields.join(', ')} WHERE id = ?`, values);
    return successResponse(res, 200, 'Calorie floor updated');
  } catch (err) {
    console.error('[nutritionConfig] updateCalorieFloor:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 5. MEDICAL ADJUSTMENTS
// GET    /api/v1/admin/nutrition/medical-adjustments
// POST   /api/v1/admin/nutrition/medical-adjustments
// PUT    /api/v1/admin/nutrition/medical-adjustments/:id
// DELETE /api/v1/admin/nutrition/medical-adjustments/:id
// ══════════════════════════════════════════════════════════════════════════════

export const getMedicalAdjustments = async (_req: Request, res: Response) => {
  try {
    const rows = await query('SELECT * FROM nutrition_medical_adjustments ORDER BY priority ASC');
    return successResponse(res, 200, 'Medical adjustments fetched', rows);
  } catch (err) {
    console.error('[nutritionConfig] getMedicalAdjustments:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

export const createMedicalAdjustment = async (req: Request, res: Response) => {
  try {
    const { condition_key, condition_label, detection_keywords, priority, fat_percent, protein_per_kg_override, carb_max_percent, prompt_note } = req.body as Record<string, unknown>;

    if (!isStr(condition_key) || !isStr(condition_label) || !isStr(detection_keywords) || !isStr(prompt_note)) {
      return errorResponse(res, 400, 'condition_key, condition_label, detection_keywords, and prompt_note are required strings');
    }

    const result = await execute(
      `INSERT INTO nutrition_medical_adjustments
        (condition_key, condition_label, detection_keywords, priority, fat_percent, protein_per_kg_override, carb_max_percent, prompt_note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(condition_key).trim().toLowerCase(),
        String(condition_label).trim(),
        String(detection_keywords).trim(),
        Number(priority ?? 10),
        fat_percent              != null ? Number(fat_percent)              : null,
        protein_per_kg_override  != null ? Number(protein_per_kg_override)  : null,
        carb_max_percent         != null ? Number(carb_max_percent)         : null,
        String(prompt_note).trim(),
      ],
    );
    return successResponse(res, 201, 'Medical adjustment created', { id: result.insertId });
  } catch (err: unknown) {
    const isDuplicate = (err as { code?: string }).code === 'ER_DUP_ENTRY';
    if (isDuplicate) return errorResponse(res, 409, 'A condition with this condition_key already exists');
    console.error('[nutritionConfig] createMedicalAdjustment:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

export const updateMedicalAdjustment = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid id');

    const { condition_label, detection_keywords, priority, fat_percent, protein_per_kg_override, carb_max_percent, prompt_note, is_active } = req.body as Record<string, unknown>;

    const fields: string[] = [];
    const values: unknown[] = [];

    if (isStr(condition_label))      { fields.push('condition_label = ?');         values.push(String(condition_label).trim()); }
    if (isStr(detection_keywords))   { fields.push('detection_keywords = ?');       values.push(String(detection_keywords).trim()); }
    if (isNum(priority))             { fields.push('priority = ?');                values.push(Number(priority)); }
    if (isStr(prompt_note))          { fields.push('prompt_note = ?');             values.push(String(prompt_note).trim()); }
    if (is_active !== undefined)     { fields.push('is_active = ?');               values.push(is_active ? 1 : 0); }

    // Nullable numeric fields — allow setting to null explicitly
    if (fat_percent !== undefined)             { fields.push('fat_percent = ?');             values.push(fat_percent != null ? Number(fat_percent) : null); }
    if (protein_per_kg_override !== undefined) { fields.push('protein_per_kg_override = ?'); values.push(protein_per_kg_override != null ? Number(protein_per_kg_override) : null); }
    if (carb_max_percent !== undefined)        { fields.push('carb_max_percent = ?');        values.push(carb_max_percent != null ? Number(carb_max_percent) : null); }

    if (fields.length === 0) return errorResponse(res, 400, 'No valid fields provided to update');

    values.push(id);
    await execute(`UPDATE nutrition_medical_adjustments SET ${fields.join(', ')} WHERE id = ?`, values);
    return successResponse(res, 200, 'Medical adjustment updated');
  } catch (err) {
    console.error('[nutritionConfig] updateMedicalAdjustment:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

export const deleteMedicalAdjustment = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid id');
    await execute('DELETE FROM nutrition_medical_adjustments WHERE id = ?', [id]);
    return successResponse(res, 200, 'Medical adjustment deleted');
  } catch (err) {
    console.error('[nutritionConfig] deleteMedicalAdjustment:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 6. GENERAL SETTINGS
// GET /api/v1/admin/nutrition/general-settings
// PUT /api/v1/admin/nutrition/general-settings/:id
// ══════════════════════════════════════════════════════════════════════════════

export const getGeneralSettings = async (_req: Request, res: Response) => {
  try {
    const rows = await query('SELECT * FROM nutrition_general_settings ORDER BY category ASC, setting_key ASC');
    return successResponse(res, 200, 'General settings fetched', rows);
  } catch (err) {
    console.error('[nutritionConfig] getGeneralSettings:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

export const updateGeneralSetting = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid id');

    const { value } = req.body as Record<string, unknown>;
    if (value === undefined || value === null || String(value).trim() === '') {
      return errorResponse(res, 400, 'value is required');
    }

    // Fetch the row to validate the value against its data_type
    const rows = await query<{ data_type: string; setting_key: string }>(
      'SELECT setting_key, data_type FROM nutrition_general_settings WHERE id = ?',
      [id],
    );
    if (rows.length === 0) return errorResponse(res, 404, 'Setting not found');

    const row = rows[0];
    const rawValue = String(value).trim();

    if (row.data_type === 'int') {
      if (!Number.isInteger(Number(rawValue))) return errorResponse(res, 400, `${row.setting_key} must be a whole number`);
    } else {
      if (isNaN(Number(rawValue))) return errorResponse(res, 400, `${row.setting_key} must be a number`);
    }

    await execute('UPDATE nutrition_general_settings SET value = ? WHERE id = ?', [rawValue, id]);
    return successResponse(res, 200, 'Setting updated');
  } catch (err) {
    console.error('[nutritionConfig] updateGeneralSetting:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};
