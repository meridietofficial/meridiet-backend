import type { Request, Response } from 'express';
import { query, execute } from '../config/database';
import { successResponse, errorResponse } from '../utils/response';

const isStr = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
const isNum = (v: unknown) => v !== undefined && v !== null && v !== '' && !isNaN(Number(v));

// GET /api/v1/admin/medicines
export const listMedicines = async (_req: Request, res: Response) => {
  try {
    const rows = await query(
      'SELECT * FROM medicines ORDER BY display_order ASC, id ASC',
    );
    return successResponse(res, 200, 'Medicines fetched', rows);
  } catch (err) {
    console.error('[medicines] listMedicines:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// POST /api/v1/admin/medicines
export const createMedicine = async (req: Request, res: Response) => {
  try {
    const { medicine_key, label, category, description, display_order } = req.body as Record<string, unknown>;

    if (!isStr(medicine_key) || !isStr(label)) {
      return errorResponse(res, 400, 'medicine_key and label are required');
    }

    const result = await execute(
      'INSERT INTO medicines (medicine_key, label, category, description, display_order) VALUES (?, ?, ?, ?, ?)',
      [
        String(medicine_key).trim().toLowerCase(),
        String(label).trim(),
        isStr(category) ? String(category).trim().toLowerCase() : null,
        isStr(description) ? String(description).trim() : null,
        isNum(display_order) ? Number(display_order) : 0,
      ],
    );
    return successResponse(res, 201, 'Medicine created', { id: result.insertId });
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException & { code?: string }).code === 'ER_DUP_ENTRY') {
      return errorResponse(res, 409, 'A medicine with this medicine_key already exists');
    }
    console.error('[medicines] createMedicine:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// PUT /api/v1/admin/medicines/:id
export const updateMedicine = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid id');

    const { label, category, description, display_order, is_active, is_deleted } = req.body as Record<string, unknown>;

    const fields: string[] = [];
    const values: unknown[] = [];

    if (isStr(label))              { fields.push('label = ?');         values.push(String(label).trim()); }
    if (category !== undefined)    { fields.push('category = ?');      values.push(isStr(category) ? String(category).trim().toLowerCase() : null); }
    if (description !== undefined) { fields.push('description = ?');   values.push(isStr(description) ? String(description).trim() : null); }
    if (isNum(display_order))      { fields.push('display_order = ?'); values.push(Number(display_order)); }
    if (is_active !== undefined)   { fields.push('is_active = ?');     values.push(is_active ? 1 : 0); }
    if (is_deleted !== undefined)  { fields.push('is_deleted = ?');    values.push(is_deleted ? 1 : 0); }

    if (fields.length === 0) return errorResponse(res, 400, 'No valid fields provided to update');

    values.push(id);
    await execute(`UPDATE medicines SET ${fields.join(', ')} WHERE id = ?`, values);
    return successResponse(res, 200, 'Medicine updated');
  } catch (err) {
    console.error('[medicines] updateMedicine:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// DELETE /api/v1/admin/medicines/:id  (soft delete)
export const deleteMedicine = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid id');

    await execute('UPDATE medicines SET is_deleted = 1, is_active = 0 WHERE id = ?', [id]);
    return successResponse(res, 200, 'Medicine deleted');
  } catch (err) {
    console.error('[medicines] deleteMedicine:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};
