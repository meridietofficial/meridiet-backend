import type { Request, Response } from 'express';
import { query, execute } from '../config/database';
import { successResponse, errorResponse } from '../utils/response';

const isStr = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
const isNum = (v: unknown) => v !== undefined && v !== null && v !== '' && !isNaN(Number(v));

// GET /api/v1/admin/food-allergies
export const listFoodAllergies = async (_req: Request, res: Response) => {
  try {
    const rows = await query(
      'SELECT * FROM food_allergies ORDER BY display_order ASC, id ASC',
    );
    return successResponse(res, 200, 'Food allergies fetched', rows);
  } catch (err) {
    console.error('[foodAllergies] listFoodAllergies:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// POST /api/v1/admin/food-allergies
export const createFoodAllergy = async (req: Request, res: Response) => {
  try {
    const { allergy_key, label, description, display_order } = req.body as Record<string, unknown>;

    if (!isStr(allergy_key) || !isStr(label)) {
      return errorResponse(res, 400, 'allergy_key and label are required');
    }

    const result = await execute(
      'INSERT INTO food_allergies (allergy_key, label, description, display_order) VALUES (?, ?, ?, ?)',
      [
        String(allergy_key).trim().toLowerCase(),
        String(label).trim(),
        isStr(description) ? String(description).trim() : null,
        isNum(display_order) ? Number(display_order) : 0,
      ],
    );
    return successResponse(res, 201, 'Food allergy created', { id: result.insertId });
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException & { code?: string }).code === 'ER_DUP_ENTRY') {
      return errorResponse(res, 409, 'An allergy with this allergy_key already exists');
    }
    console.error('[foodAllergies] createFoodAllergy:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// PUT /api/v1/admin/food-allergies/:id
export const updateFoodAllergy = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid id');

    const { label, description, display_order, is_active, is_deleted } = req.body as Record<string, unknown>;

    const fields: string[] = [];
    const values: unknown[] = [];

    if (isStr(label))              { fields.push('label = ?');         values.push(String(label).trim()); }
    if (description !== undefined) { fields.push('description = ?');   values.push(isStr(description) ? String(description).trim() : null); }
    if (isNum(display_order))      { fields.push('display_order = ?'); values.push(Number(display_order)); }
    if (is_active !== undefined)   { fields.push('is_active = ?');     values.push(is_active ? 1 : 0); }
    if (is_deleted !== undefined)  { fields.push('is_deleted = ?');    values.push(is_deleted ? 1 : 0); }

    if (fields.length === 0) return errorResponse(res, 400, 'No valid fields provided to update');

    values.push(id);
    await execute(`UPDATE food_allergies SET ${fields.join(', ')} WHERE id = ?`, values);
    return successResponse(res, 200, 'Food allergy updated');
  } catch (err) {
    console.error('[foodAllergies] updateFoodAllergy:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// DELETE /api/v1/admin/food-allergies/:id  (soft delete)
export const deleteFoodAllergy = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid id');

    await execute('UPDATE food_allergies SET is_deleted = 1, is_active = 0 WHERE id = ?', [id]);
    return successResponse(res, 200, 'Food allergy deleted');
  } catch (err) {
    console.error('[foodAllergies] deleteFoodAllergy:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};
