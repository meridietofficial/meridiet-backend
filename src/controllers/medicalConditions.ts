import type { Request, Response } from 'express';
import { query, execute } from '../config/database';
import { successResponse, errorResponse } from '../utils/response';

const isStr = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
const isNum = (v: unknown) => v !== undefined && v !== null && v !== '' && !isNaN(Number(v));

// GET /api/v1/admin/medical-conditions
export const listMedicalConditions = async (_req: Request, res: Response) => {
  try {
    const rows = await query(
      'SELECT * FROM medical_conditions ORDER BY display_order ASC, id ASC',
    );
    return successResponse(res, 200, 'Medical conditions fetched', rows);
  } catch (err) {
    console.error('[medicalConditions] listMedicalConditions:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// POST /api/v1/admin/medical-conditions
export const createMedicalCondition = async (req: Request, res: Response) => {
  try {
    const { condition_key, label, description, display_order } = req.body as Record<string, unknown>;

    if (!isStr(condition_key) || !isStr(label)) {
      return errorResponse(res, 400, 'condition_key and label are required');
    }

    const result = await execute(
      'INSERT INTO medical_conditions (condition_key, label, description, display_order) VALUES (?, ?, ?, ?)',
      [
        String(condition_key).trim().toLowerCase(),
        String(label).trim(),
        isStr(description) ? String(description).trim() : null,
        isNum(display_order) ? Number(display_order) : 0,
      ],
    );
    return successResponse(res, 201, 'Medical condition created', { id: result.insertId });
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException & { code?: string }).code === 'ER_DUP_ENTRY') {
      return errorResponse(res, 409, 'A condition with this condition_key already exists');
    }
    console.error('[medicalConditions] createMedicalCondition:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// PUT /api/v1/admin/medical-conditions/:id
export const updateMedicalCondition = async (req: Request, res: Response) => {
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
    await execute(`UPDATE medical_conditions SET ${fields.join(', ')} WHERE id = ?`, values);
    return successResponse(res, 200, 'Medical condition updated');
  } catch (err) {
    console.error('[medicalConditions] updateMedicalCondition:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// DELETE /api/v1/admin/medical-conditions/:id  (soft delete)
export const deleteMedicalCondition = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid id');

    await execute('UPDATE medical_conditions SET is_deleted = 1, is_active = 0 WHERE id = ?', [id]);
    return successResponse(res, 200, 'Medical condition deleted');
  } catch (err) {
    console.error('[medicalConditions] deleteMedicalCondition:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};
