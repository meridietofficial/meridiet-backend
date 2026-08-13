import type { Request, Response } from 'express';
import { createDietForm, updateDietForm, findDietFormById, findDietFormByUserId, findAllDietFormsByUserId, markDietFormSubmitted } from '../models/DietForm';
import { findDietPlanByFormId } from '../models/DietPlan';
import { successResponse, errorResponse } from '../utils/response';
import { sendEmail } from '../services/email';
import { dietFormConfirmationEmail } from '../services/emails/dietFormConfirmation';
import { generateAndDeliverDietPlan } from '../services/dietPlanDelivery';
import { sendFormReceivedWhatsApp } from '../services/whatsapp';

const PLAN_DURATION_LABELS: Record<number, string> = {
  1: '1 Week',
  2: '1 Month',
  3: '3 Months',
};

// POST /api/v1/diet-form
// Creates a draft diet form — does NOT trigger plan generation yet.
// Logged-in user → send Bearer token, user_id is auto-attached
// Guest          → no token needed, user_id will be null
export const submitDietForm = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub ? Number(req.user.sub) : null;

    const form = await createDietForm({
      user_id: userId,
      ...req.body,
    });

    return successResponse(res, 201, 'Diet form saved successfully', form);
  } catch (err) {
    console.error('Submit diet form error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// POST /api/v1/diet-form/:id/submit
// Final submission — triggers plan generation + sends confirmation email.
// Call this after all 5 steps are saved.
export const finalizeDietForm = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id) return errorResponse(res, 400, 'Form id is required');

    const form = await findDietFormById(id);
    if (!form) return errorResponse(res, 404, 'Diet form not found');

    const userId = form.user_id;

    // Mark as submitted so the payment reminder cron can track timing
    void markDietFormSubmitted(id).catch((err) => {
      console.error('[dietForm] markDietFormSubmitted error:', err);
    });

    const deliveryMethods = (form.delivery_method as string[]) ?? [];
    const wantsEmail     = deliveryMethods.includes('email');
    const wantsWhatsApp  = deliveryMethods.includes('whatsapp');

    // Fire-and-forget confirmation email
    if (wantsEmail && form.email) {
      const { subject, html, text } = dietFormConfirmationEmail(
        form.full_name ?? 'there',
        {
          goals:        (form.goals as string[]) ?? [],
          dietType:     form.diet_type ?? null,
          planDuration: PLAN_DURATION_LABELS[form.plan_type ?? 1] ?? '1 Week',
        },
      );
      void sendEmail({ to: form.email, subject, html, text }).catch((err) => {
        console.error('Diet form confirmation email failed:', err);
      });
    }

    // Fire-and-forget WhatsApp confirmation
    if (wantsWhatsApp && form.whatsapp) {
      void sendFormReceivedWhatsApp(form.whatsapp, form.full_name ?? 'there').catch((err) => {
        console.error('Diet form confirmation WhatsApp failed:', err);
      });
    }

    // Background: generate plan → PDF → S3 → cashback → email
    // Only trigger for logged-in users (user_id must be present)
    if (userId) {
      void generateAndDeliverDietPlan(id, userId).catch((err) => {
        console.error('[dietForm] delivery pipeline error:', err);
      });
    }

    return successResponse(res, 200, 'Diet form submitted successfully. Your plan is being generated!', form);
  } catch (err) {
    console.error('Finalize diet form error:', err);
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
// Only returns forms where the user has completed at least Step 5 (email is present),
// meaning they reached the payment screen. Incomplete/abandoned drafts are excluded.
export const getMyAllDietForms = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.sub);
    const allForms = await findAllDietFormsByUserId(userId);

    // Filter: only include forms where Step 5 (contact details) is filled in
    // email is a Step 5 field — if it's present the user reached the payment screen
    const forms = allForms.filter((f) => f.email !== null && f.email !== '');

    const plans = await Promise.all(forms.map((f) => findDietPlanByFormId(f.id)));

    const formsWithPlanStatus = forms.map((form, i) => {
      const plan = plans[i];
      return {
        ...form,
        plan_id:          plan?.id          ?? null,
        plan_status:      plan?.status       ?? null,   // 'generating' | 'completed' | 'failed' | null
        plan_pdf_url:     plan?.pdf_url      ?? null,
        plan_generated:   plan?.status === 'completed' || plan?.status === 'sent',
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
