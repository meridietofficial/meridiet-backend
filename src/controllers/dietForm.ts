import type { Request, Response } from 'express';
import { createDietForm, updateDietForm, findDietFormById, findDietFormByUserId } from '../models/DietForm';
import { successResponse, errorResponse } from '../utils/response';

// POST /api/v1/diet-form
// Logged-in user → send Bearer token, user_id is auto-attached
// Guest          → no token needed, user_id will be null
export const submitDietForm = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub ? Number(req.user.sub) : null;

    const form = await createDietForm({
      user_id: userId,
      ...req.body,
    });

    return successResponse(res, 201, 'Diet form submitted successfully', form);
  } catch (err) {
    console.error('Submit diet form error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// PUT /api/v1/diet-form/:id
// Update an existing diet form by id
export const updateDietFormById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id) return errorResponse(res, 400, 'Form id is required');

    const existing = await findDietFormById(id);
    if (!existing) return errorResponse(res, 404, 'Diet form not found');

    const form = await updateDietForm(id, req.body);
    return successResponse(res, 200, 'Diet form updated successfully', form);
  } catch (err) {
    console.error('Update diet form error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/diet-form/:id
// Get a diet form by id
export const getDietFormById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id) return errorResponse(res, 400, 'Form id is required');

    const form = await findDietFormById(id);
    if (!form) return errorResponse(res, 404, 'Diet form not found');

    return successResponse(res, 200, 'Diet form fetched successfully', form);
  } catch (err) {
    console.error('Get diet form error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/diet-form/my
// Get the diet form of the currently logged-in user  (requires auth)
export const getMyDietForm = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.sub);
    const form = await findDietFormByUserId(userId);
    if (!form) return errorResponse(res, 404, 'No diet form found for this user');

    return successResponse(res, 200, 'Diet form fetched successfully', form);
  } catch (err) {
    console.error('Get my diet form error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};
