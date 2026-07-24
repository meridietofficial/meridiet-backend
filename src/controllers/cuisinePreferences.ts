import type { Request, Response } from 'express';
import { query, execute } from '../config/database';
import { successResponse, errorResponse } from '../utils/response';

const isStr = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
const isNum = (v: unknown) => v !== undefined && v !== null && v !== '' && !isNaN(Number(v));

// GET /api/v1/admin/cuisine-preferences
export const listCuisinePreferences = async (_req: Request, res: Response) => {
  try {
    const rows = await query(
      'SELECT * FROM cuisine_preferences ORDER BY display_order ASC, id ASC',
    );
    return successResponse(res, 200, 'Cuisine preferences fetched', rows);
  } catch (err) {
    console.error('[cuisinePreferences] listCuisinePreferences:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// POST /api/v1/admin/cuisine-preferences
export const createCuisinePreference = async (req: Request, res: Response) => {
  try {
    const { cuisine_key, label, description, display_order } = req.body as Record<string, unknown>;

    if (!isStr(cuisine_key) || !isStr(label)) {
      return errorResponse(res, 400, 'cuisine_key and label are required');
    }

    const result = await execute(
      'INSERT INTO cuisine_preferences (cuisine_key, label, description, display_order) VALUES (?, ?, ?, ?)',
      [
        String(cuisine_key).trim().toLowerCase(),
        String(label).trim(),
        isStr(description) ? String(description).trim() : null,
        isNum(display_order) ? Number(display_order) : 0,
      ],
    );
    return successResponse(res, 201, 'Cuisine preference created', { id: result.insertId });
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException & { code?: string }).code === 'ER_DUP_ENTRY') {
      return errorResponse(res, 409, 'A cuisine with this cuisine_key already exists');
    }
    console.error('[cuisinePreferences] createCuisinePreference:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// PUT /api/v1/admin/cuisine-preferences/:id
export const updateCuisinePreference = async (req: Request, res: Response) => {
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
    await execute(`UPDATE cuisine_preferences SET ${fields.join(', ')} WHERE id = ?`, values);
    return successResponse(res, 200, 'Cuisine preference updated');
  } catch (err) {
    console.error('[cuisinePreferences] updateCuisinePreference:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// DELETE /api/v1/admin/cuisine-preferences/:id  (soft delete)
export const deleteCuisinePreference = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid id');

    await execute('UPDATE cuisine_preferences SET is_deleted = 1, is_active = 0 WHERE id = ?', [id]);
    return successResponse(res, 200, 'Cuisine preference deleted');
  } catch (err) {
    console.error('[cuisinePreferences] deleteCuisinePreference:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};
