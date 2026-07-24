import type { Request, Response } from 'express';
import { query, execute } from '../config/database';
import { successResponse, errorResponse } from '../utils/response';

const isStr = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
const isNum = (v: unknown) => v !== undefined && v !== null && v !== '' && !isNaN(Number(v));

// GET /api/v1/admin/health-goals
export const listHealthGoals = async (_req: Request, res: Response) => {
  try {
    const rows = await query(
      'SELECT * FROM health_goals ORDER BY display_order ASC, id ASC',
    );
    return successResponse(res, 200, 'Health goals fetched', rows);
  } catch (err) {
    console.error('[healthGoals] listHealthGoals:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// POST /api/v1/admin/health-goals
export const createHealthGoal = async (req: Request, res: Response) => {
  try {
    const { goal_key, label, description, display_order } = req.body as Record<string, unknown>;

    if (!isStr(goal_key) || !isStr(label)) {
      return errorResponse(res, 400, 'goal_key and label are required');
    }

    const result = await execute(
      'INSERT INTO health_goals (goal_key, label, description, display_order) VALUES (?, ?, ?, ?)',
      [
        String(goal_key).trim().toLowerCase(),
        String(label).trim(),
        isStr(description) ? String(description).trim() : null,
        isNum(display_order) ? Number(display_order) : 0,
      ],
    );
    return successResponse(res, 201, 'Health goal created', { id: result.insertId });
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException & { code?: string }).code === 'ER_DUP_ENTRY') {
      return errorResponse(res, 409, 'A goal with this goal_key already exists');
    }
    console.error('[healthGoals] createHealthGoal:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// PUT /api/v1/admin/health-goals/:id
export const updateHealthGoal = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid id');

    const { label, description, display_order, is_active, is_deleted } = req.body as Record<string, unknown>;

    const fields: string[] = [];
    const values: unknown[] = [];

    if (isStr(label))               { fields.push('label = ?');         values.push(String(label).trim()); }
    if (description !== undefined)  { fields.push('description = ?');   values.push(isStr(description) ? String(description).trim() : null); }
    if (isNum(display_order))       { fields.push('display_order = ?'); values.push(Number(display_order)); }
    if (is_active !== undefined)    { fields.push('is_active = ?');     values.push(is_active ? 1 : 0); }
    if (is_deleted !== undefined)   { fields.push('is_deleted = ?');    values.push(is_deleted ? 1 : 0); }

    if (fields.length === 0) return errorResponse(res, 400, 'No valid fields provided to update');

    values.push(id);
    await execute(`UPDATE health_goals SET ${fields.join(', ')} WHERE id = ?`, values);
    return successResponse(res, 200, 'Health goal updated');
  } catch (err) {
    console.error('[healthGoals] updateHealthGoal:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// DELETE /api/v1/admin/health-goals/:id  (soft delete)
export const deleteHealthGoal = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid id');

    await execute('UPDATE health_goals SET is_deleted = 1, is_active = 0 WHERE id = ?', [id]);
    return successResponse(res, 200, 'Health goal deleted');
  } catch (err) {
    console.error('[healthGoals] deleteHealthGoal:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};
