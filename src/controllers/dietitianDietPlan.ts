import type { Request, Response } from 'express';
import { findDietitianByUserId } from '../models/Dietitian';
import { findAppointmentById } from '../models/Appointment';
import { findUserById } from '../models/User';
import { createDietForm, updateDietForm, findDietFormById } from '../models/DietForm';
import {
  findDietPlanById,
  findDietPlanWithFormById,
  findDietPlansByDietitianId,
  findManualDietPlansByDietitianId,
  createDraftDietPlan,
  createManualDraftDietPlan,
  updateDietPlanStatus,
  updateDraftPlanData,
  markDietPlanSent,
} from '../models/DietPlan';
import type { WeekPlan, FeaturedRecipe } from '../models/DietPlan';
import { generateAndDeliverDietPlan, deliverDietPlanToUser } from '../services/dietPlanDelivery';
import { debitDietitianForDietPlanGeneration, MANUAL_PLAN_COST } from '../models/DietitianWallet';
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

// ── POST /api/v1/dietitian/diet-forms ─────────────────────────────────────────
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
        clientName  = user.full_name    ?? clientName;
        clientEmail = user.email        ?? clientEmail;
        clientPhone = user.phone_number ?? clientPhone;
      }
    }

    const form = await createDietForm({
      user_id:      appointment.user_id ?? null,
      full_name:    clientName,
      email:        clientEmail ?? null,
      whatsapp:     clientPhone ?? null,
      contact_name: clientName,
      plan_type:    2,   // default to 1 month (4 weeks) for dietitian-created plans
      ...formFields,     // body can override plan_type if dietitian explicitly sends it
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

// ── POST /api/v1/dietitian/diet-plans/manual ──────────────────────────────────
// Dietitian creates a manual diet plan for any external client (no appointment needed).
// Body: full_name, email, whatsapp (required) + all health/lifestyle form fields.
// ₹100 is deducted from wallet at generation time (POST /diet-forms/:id/generate).
export const saveManualDraft = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.sub);
    const dietitian = await getDietitianOrFail(userId, res);
    if (!dietitian) return;

    const { full_name, email, whatsapp, ...formFields } = req.body as Record<string, unknown>;

    if (!full_name || String(full_name).trim() === '') {
      return errorResponse(res, 400, 'full_name is required');
    }

    const form = await createDietForm({
      user_id:      null,
      full_name:    String(full_name).trim(),
      email:        email ? String(email).trim() : null,
      whatsapp:     whatsapp ? String(whatsapp).trim() : null,
      contact_name: String(full_name).trim(),
      plan_type:    2, // always 1 month (4 weeks) for manual plans
      ...formFields,
    });
    if (!form) return errorResponse(res, 500, 'Failed to create diet form');

    const plan = await createManualDraftDietPlan(form.id, dietitian.id);
    if (!plan) return errorResponse(res, 500, 'Failed to create draft plan');

    return successResponse(res, 201, 'Manual draft created successfully', {
      plan_id: plan.id,
      form_id: form.id,
      status:  plan.status,
      cost:    MANUAL_PLAN_COST,
      note:    `₹${MANUAL_PLAN_COST} will be deducted from your wallet when you generate the plan`,
    });
  } catch (err) {
    console.error('Save manual draft error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// ── PUT /api/v1/dietitian/diet-forms/:id ──────────────────────────────────────
// Update the diet form fields of a draft (dietitian edits form data before generating).
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

// ── POST /api/v1/dietitian/diet-forms/:id/generate ───────────────────────────
// Triggers AI generation on a saved draft.
// Returns 202 immediately — poll GET /diet-forms/:id until status = completed | failed.
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
    if (plan.status === 'completed' || plan.status === 'sent') {
      return errorResponse(res, 409, 'Plan is already generated');
    }
    if (plan.status === 'archived') {
      return errorResponse(res, 400, 'Cannot generate an archived plan');
    }
    if (plan.status !== 'draft') {
      return errorResponse(res, 400, 'Plan must be in draft status to generate');
    }

    // Manual plans (no appointment) cost ₹100 from the dietitian's wallet
    const isManualPlan = plan.appointment_id === null && plan.user_id === null;
    if (isManualPlan) {
      const debit = await debitDietitianForDietPlanGeneration(dietitian.id, plan.id);
      if (!debit.debited) {
        if (debit.reason === 'insufficient_balance') {
          return errorResponse(res, 402, `Insufficient wallet balance. You need at least ₹${MANUAL_PLAN_COST} to generate a manual diet plan.`);
        }
        if (debit.reason === 'already_charged') {
          // Already paid — safe to continue (retry after a failed generation)
        } else {
          return errorResponse(res, 500, 'Failed to process wallet deduction');
        }
      }
    }

    // Run AI pipeline in background — dietitian reviews and sends separately via /send
    void generateAndDeliverDietPlan(
      plan.form_id,
      plan.user_id,
      undefined,
      dietitian.id,
      plan.appointment_id,
      plan.id,
    ).catch((err) => console.error('[dietitian generate] pipeline error:', err));

    return successResponse(res, 202, 'Generation started. Poll GET /diet-forms/:id until status changes to completed or failed.');
  } catch (err) {
    console.error('Generate from draft error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// ── PUT /api/v1/dietitian/diet-forms/:id/content ─────────────────────────────
// Edit the AI-generated plan content after generation, before sending.
// Allowed on status: completed or sent.
// Body (all optional): weeks, general_tips, featured_recipes, notes,
//   client_name, calorie_range, protein_target_g, carbs_target_g,
//   fat_target_g, primary_goal, plan_duration, diet_type, hydration_guide
export const editGeneratedPlan = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.sub);
    const planId = Number(req.params.id);
    if (isNaN(planId)) return errorResponse(res, 400, 'Invalid plan id');

    const dietitian = await getDietitianOrFail(userId, res);
    if (!dietitian) return;

    const plan = await getOwnedPlanOrFail(planId, dietitian.id, res);
    if (!plan) return;

    if (plan.status !== 'completed' && plan.status !== 'sent') {
      return errorResponse(res, 400, `Plan can only be edited when status is completed or sent. Current status: "${plan.status}"`);
    }

    const {
      client_name, calorie_range, protein_target_g, carbs_target_g, fat_target_g,
      primary_goal, plan_duration, diet_type, hydration_guide,
      weeks, general_tips, featured_recipes, notes,
    } = req.body as Record<string, unknown>;

    await updateDraftPlanData(planId, {
      ...(client_name      !== undefined && { client_name:      String(client_name) }),
      ...(calorie_range    !== undefined && { calorie_range:    String(calorie_range) }),
      ...(protein_target_g !== undefined && { protein_target_g: Number(protein_target_g) }),
      ...(carbs_target_g   !== undefined && { carbs_target_g:   Number(carbs_target_g) }),
      ...(fat_target_g     !== undefined && { fat_target_g:     Number(fat_target_g) }),
      ...(primary_goal     !== undefined && { primary_goal:     String(primary_goal) }),
      ...(plan_duration    !== undefined && { plan_duration:    String(plan_duration) }),
      ...(diet_type        !== undefined && { diet_type:        String(diet_type) }),
      ...(hydration_guide  !== undefined && { hydration_guide:  String(hydration_guide) }),
      ...(weeks            !== undefined && { weeks:            weeks as WeekPlan[] }),
      ...(general_tips     !== undefined && { general_tips:     general_tips as string[] }),
      ...(featured_recipes !== undefined && { featured_recipes: featured_recipes as FeaturedRecipe[] }),
      ...(notes            !== undefined && { notes:            String(notes) }),
    });

    return successResponse(res, 200, 'Plan content updated successfully');
  } catch (err) {
    console.error('Edit generated plan error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// ── POST /api/v1/dietitian/diet-forms/:id/send ────────────────────────────────
// Sends the completed diet plan to the patient.
// Automatically sends to all available channels:
//   - Email if the patient has an email address
//   - WhatsApp if the patient has a phone number
// Plan must be in status: completed or sent (re-send is allowed).
export const sendDietitianPlan = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.sub);
    const planId = Number(req.params.id);
    if (isNaN(planId)) return errorResponse(res, 400, 'Invalid plan id');

    const dietitian = await getDietitianOrFail(userId, res);
    if (!dietitian) return;

    const plan = await getOwnedPlanOrFail(planId, dietitian.id, res);
    if (!plan) return;

    if (plan.appointment_id === null && plan.user_id === null) {
      return errorResponse(res, 400, 'Manual plans are delivered by downloading the PDF and sending directly to your client.');
    }

    if (plan.status === 'generating') {
      return errorResponse(res, 400, 'Plan is still being generated. Please wait until it is ready.');
    }
    if (plan.status === 'failed') {
      return errorResponse(res, 400, 'Plan generation failed. Cannot send a failed plan.');
    }
    if (plan.status !== 'completed' && plan.status !== 'sent') {
      return errorResponse(res, 400, `Plan cannot be sent in status "${plan.status}". Generate the plan first.`);
    }

    const form = await findDietFormById(plan.form_id);
    if (!form) return errorResponse(res, 404, 'Associated diet form not found');

    // Send to all available patient contact channels
    const channels: string[] = [
      ...(form.email    ? ['email']    : []),
      ...(form.whatsapp ? ['whatsapp'] : []),
    ];

    if (channels.length === 0) {
      return errorResponse(res, 400, 'Cannot send — patient has no email or phone number on record');
    }

    // Persist delivery channels so deliverDietPlanToUser knows what to send
    await updateDietForm(form.id, { delivery_method: channels } as Parameters<typeof updateDietForm>[1]);

    const { sentEmail, sentWhatsApp } = await deliverDietPlanToUser(planId);

    if (!sentEmail && !sentWhatsApp) {
      return errorResponse(res, 400, 'Delivery failed — check that the patient email/phone is valid and the plan PDF was generated successfully');
    }

    await markDietPlanSent(planId);

    return successResponse(res, 200, 'Diet plan sent successfully', {
      plan_id:       planId,
      sent_email:    sentEmail,
      sent_whatsapp: sentWhatsApp,
      delivery_to: {
        email:    sentEmail    ? (form.email    ?? null) : null,
        whatsapp: sentWhatsApp ? (form.whatsapp ?? null) : null,
      },
    });
  } catch (err) {
    console.error('Send dietitian plan error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// ── PUT /api/v1/dietitian/diet-forms/:id/archive ──────────────────────────────
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

// ── GET /api/v1/dietitian/diet-forms ──────────────────────────────────────────
// Query: ?status=draft|completed|archived|generating|sent&page=1&limit=10
export const listDietitianPlans = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.sub);
    const dietitian = await getDietitianOrFail(userId, res);
    if (!dietitian) return;

    const page   = Math.max(1, Number(req.query.page)  || 1);
    const limit  = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const status = req.query.status as string | undefined;

    const VALID = ['generating', 'completed', 'failed', 'draft', 'archived', 'sent'];
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

// ── GET /api/v1/dietitian/diet-plans/manual ───────────────────────────────────
// List all manual diet plans created by the dietitian (no appointment, no platform user).
// Query: ?status=draft|completed|generating|failed|archived&page=1&limit=10
export const listManualDietitianPlans = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.sub);
    const dietitian = await getDietitianOrFail(userId, res);
    if (!dietitian) return;

    const page   = Math.max(1, Number(req.query.page)  || 1);
    const limit  = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const status = req.query.status as string | undefined;

    const VALID = ['generating', 'completed', 'failed', 'draft', 'archived', 'sent'];
    if (status && !VALID.includes(status)) {
      return errorResponse(res, 400, `status must be one of: ${VALID.join(', ')}`);
    }

    const { plans, total } = await findManualDietPlansByDietitianId(dietitian.id, status, page, limit);
    return successResponse(res, 200, 'Manual diet plans fetched', {
      plans,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('List manual diet plans error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// ── GET /api/v1/dietitian/diet-forms/:id ──────────────────────────────────────
// Returns the full plan + diet form for preview or review.
// Works for any status — draft shows form data only; completed/sent shows full AI content.
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
