import type { Request, Response } from 'express';
import { findDietitianByUserId } from '../models/Dietitian';
import { findAppointmentById } from '../models/Appointment';
import { findUserById } from '../models/User';
import { createDietForm, updateDietForm } from '../models/DietForm';
import {
  findDietPlanById,
  findDietPlanWithFormById,
  findDietPlansByDietitianId,
  createDraftDietPlan,
  updateDietPlanStatus,
} from '../models/DietPlan';
import { generateAndDeliverDietPlan } from '../services/dietPlanDelivery';
import { successResponse, errorResponse } from '../utils/response';

// ── helpers ────────────────────────────────────────────────────────────────────

const getDietitianOrFail = async (userId: number, res: Response) => {
  const d = await findDietitianByUserId(userId);
  if (!d) { errorResponse(res, 404, 'Dietitian profile not found'); return null; }
  return d;
};

const getOwnedPlanOrFail = async (planId: number, dietitianId: number, res: Response) => {
  const plan = await findDietPlanById(planId);
  if (!plan) { errorResponse(res, 404, 'Diet plan not found'); return null; }
  if (plan.dietitian_id !== dietitianId) { errorResponse(res, 403, 'Access denied'); return null; }
  return plan;
};

// ── POST /api/v1/dietitian/diet-plans ─────────────────────────────────────────
// Dietitian fills the diet form for the user and saves it as a draft.
// Name / email / phone are auto-filled from the appointment's user record — dietitian
// only needs to provide health/lifestyle details.
// Body: { appointment_id, age, gender, height, height_unit, weight, weight_unit,
//         goals, activity_level, work_type, workout_type, diet_type,
//         cuisine_preference, food_allergies, foods_dislike, favorite_foods,
//         medical_conditions, other_condition, on_medication, medications,
//         digestive_health, smoke_alcohol, health_notes, plan_type }
export const saveDraft = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.sub);
    const dietitian = await getDietitianOrFail(userId, res);
    if (!dietitian) return;

    const { appointment_id, ...formFields } = req.body as { appointment_id?: number } & Record<string, unknown>;
    if (!appointment_id) return errorResponse(res, 400, 'appointment_id is required');

    const appointment = await findAppointmentById(Number(appointment_id));
    if (!appointment) return errorResponse(res, 404, 'Appointment not found');
    if (appointment.dietitian_id !== dietitian.id) return errorResponse(res, 403, 'Access denied');

    // Auto-fill name / email / phone from the user record (or appointment fallback)
    let clientName  = appointment.name;
    let clientEmail = appointment.email ?? null;
    let clientPhone = appointment.phone ?? null;

    if (appointment.user_id) {
      const user = await findUserById(appointment.user_id);
      if (user) {
        clientName  = user.full_name  ?? clientName;
        clientEmail = user.email      ?? clientEmail;
        clientPhone = user.phone_number ?? clientPhone;
      }
    }

    const form = await createDietForm({
      user_id:      appointment.user_id ?? null,
      full_name:    clientName,
      email:        clientEmail ?? null,
      whatsapp:     clientPhone ?? null,
      contact_name: clientName,
      ...formFields,
    });
    if (!form) return errorResponse(res, 500, 'Failed to create diet form');

    const plan = await createDraftDietPlan(form.id, appointment.user_id, dietitian.id, appointment.id, {});
    if (!plan) return errorResponse(res, 500, 'Failed to create draft plan');

    return successResponse(res, 201, 'Draft saved successfully', { plan_id: plan.id, form_id: form.id, status: plan.status });
  } catch (err) {
    console.error('Save draft error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// ── PUT /api/v1/dietitian/diet-plans/:id ──────────────────────────────────────
// Update the diet form fields of a draft (dietitian edits before generating).
// Body: same form fields as saveDraft (all optional).
export const updateDraft = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.sub);
    const planId = Number(req.params.id);
    if (isNaN(planId)) return errorResponse(res, 400, 'Invalid plan id');

    const dietitian = await getDietitianOrFail(userId, res);
    if (!dietitian) return;

    const plan = await getOwnedPlanOrFail(planId, dietitian.id, res);
    if (!plan) return;
    if (plan.status !== 'draft') return errorResponse(res, 400, 'Only draft plans can be edited');

    await updateDietForm(plan.form_id, req.body as Record<string, unknown>);
    return successResponse(res, 200, 'Draft updated successfully');
  } catch (err) {
    console.error('Update draft error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// ── POST /api/v1/dietitian/diet-plans/:id/generate ───────────────────────────
// Triggers AI generation on a saved draft.
// Uses the draft's existing form data — no extra body needed.
// Diet chart PDF is automatically emailed to the user when generation completes.
export const generateFromDraft = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.sub);
    const planId = Number(req.params.id);
    if (isNaN(planId)) return errorResponse(res, 400, 'Invalid plan id');

    const dietitian = await getDietitianOrFail(userId, res);
    if (!dietitian) return;

    const plan = await getOwnedPlanOrFail(planId, dietitian.id, res);
    if (!plan) return;

    if (plan.status === 'generating') {
      return successResponse(res, 202, 'Generation already in progress');
    }
    if (plan.status === 'completed') {
      return errorResponse(res, 409, 'Plan is already generated');
    }
    if (plan.status === 'archived') {
      return errorResponse(res, 400, 'Cannot generate an archived plan');
    }
    if (plan.status !== 'draft') {
      return errorResponse(res, 400, 'Plan must be in draft status to generate');
    }

    // Run existing pipeline in background — it will:
    //   1. Generate via Gemini AI
    //   2. Create PDF
    //   3. Email the diet chart to the user automatically
    void generateAndDeliverDietPlan(
      plan.form_id,
      plan.user_id,
      undefined,
      dietitian.id,
      plan.appointment_id,
      plan.id,          // reuse this draft plan record (don't create a new one)
    ).catch((err) => console.error('[dietitian generate] pipeline error:', err));

    return successResponse(res, 202, 'Generation started. The diet chart will be emailed to the user once ready.');
  } catch (err) {
    console.error('Generate from draft error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// ── PUT /api/v1/dietitian/diet-plans/:id/archive ──────────────────────────────
export const archivePlan = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.sub);
    const planId = Number(req.params.id);
    if (isNaN(planId)) return errorResponse(res, 400, 'Invalid plan id');

    const dietitian = await getDietitianOrFail(userId, res);
    if (!dietitian) return;

    const plan = await getOwnedPlanOrFail(planId, dietitian.id, res);
    if (!plan) return;
    if (plan.status === 'archived') return errorResponse(res, 400, 'Plan is already archived');

    await updateDietPlanStatus(planId, 'archived');
    return successResponse(res, 200, 'Plan archived successfully');
  } catch (err) {
    console.error('Archive plan error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// ── GET /api/v1/dietitian/diet-plans ──────────────────────────────────────────
// Query: ?status=draft|completed|archived|generating&page=1&limit=10
export const listDietitianPlans = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.sub);
    const dietitian = await getDietitianOrFail(userId, res);
    if (!dietitian) return;

    const page   = Math.max(1, Number(req.query.page)  || 1);
    const limit  = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const status = req.query.status as string | undefined;

    const VALID = ['generating', 'completed', 'failed', 'draft', 'archived'];
    if (status && !VALID.includes(status)) {
      return errorResponse(res, 400, `status must be one of: ${VALID.join(', ')}`);
    }

    const { plans, total } = await findDietPlansByDietitianId(dietitian.id, status, page, limit);
    return successResponse(res, 200, 'Diet plans fetched', {
      plans,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('List dietitian plans error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// ── GET /api/v1/dietitian/diet-plans/:id ──────────────────────────────────────
// Returns the plan + the full diet form data filled for the patient.
// Use this for both preview (status=draft) and viewing the complete plan (status=completed).
export const getDietitianPlan = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.sub);
    const planId = Number(req.params.id);
    if (isNaN(planId)) return errorResponse(res, 400, 'Invalid plan id');

    const dietitian = await getDietitianOrFail(userId, res);
    if (!dietitian) return;

    const plan = await findDietPlanWithFormById(planId);
    if (!plan) return errorResponse(res, 404, 'Diet plan not found');
    if (plan.dietitian_id !== dietitian.id) return errorResponse(res, 403, 'Access denied');

    return successResponse(res, 200, 'Diet plan fetched', { plan });
  } catch (err) {
    console.error('Get dietitian plan error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};
