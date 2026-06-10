import type { Request, Response } from 'express';
import { createDietForm, updateDietForm, findDietFormById, findDietFormByUserId, findAllDietFormsByUserId } from '../models/DietForm';
import { findDietPlanByFormId } from '../models/DietPlan';
import { successResponse, errorResponse } from '../utils/response';
import { sendEmail } from '../services/email';
import { dietFormConfirmationEmail } from '../services/emails/dietFormConfirmation';
import { generateAndDeliverDietPlan } from '../services/dietPlanDelivery';

const PLAN_DURATION_LABELS: Record<number, string> = {
  1: '2 Weeks',
  2: '1 Month',
  3: '3 Months',
};

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

    // Fire-and-forget confirmation email — never block the response
    const recipientEmail = form?.email ?? null;
    if (recipientEmail && form) {
      const { subject, html, text } = dietFormConfirmationEmail(
        form.full_name ?? 'there',
        {
          goals:        (form.goals as string[]) ?? [],
          dietType:     form.diet_type ?? null,
          planDuration: PLAN_DURATION_LABELS[form.plan_type ?? 1] ?? '2 Weeks',
        },
      );
      void sendEmail({ to: recipientEmail, subject, html, text }).catch((err) => {
        console.error('Diet form confirmation email failed:', err);
      });
    }

    // Background: generate plan → PDF → S3 → cashback → email
    if (form) {
      void generateAndDeliverDietPlan(form.id, userId).catch((err) => {
        console.error('[dietForm] delivery pipeline error:', err);
      });
    }

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

// GET /api/v1/diet-form/my/all
// Get all diet forms submitted by the currently logged-in user with count
export const getMyAllDietForms = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.sub);
    const forms = await findAllDietFormsByUserId(userId);

    const plans = await Promise.all(forms.map((f) => findDietPlanByFormId(f.id)));

    const formsWithPlanStatus = forms.map((form, i) => {
      const plan = plans[i];
      return {
        ...form,
        plan_id:          plan?.id          ?? null,
        plan_status:      plan?.status       ?? null,   // 'generating' | 'completed' | 'failed' | null
        plan_pdf_url:     plan?.pdf_url      ?? null,
        plan_generated:   plan?.status === 'completed', // boolean shortcut for frontend
      };
    });

    return successResponse(res, 200, 'Diet forms fetched successfully', {
      total: forms.length,
      forms: formsWithPlanStatus,
    });
  } catch (err) {
    console.error('Get my all diet forms error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};
