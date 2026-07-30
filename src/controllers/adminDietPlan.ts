import type { Request, Response } from 'express';
import {
  findDietPlanById,
  findDietPlanWithFormById,
  findAllDietPlansForAdmin,
  updateAdminDietPlanContent,
  markDietPlanSent,
} from '../models/DietPlan';
import { findDietFormById } from '../models/DietForm';
import { findPaidPaymentByDietFormId } from '../models/Payment';
import { deliverDietPlanToUser, generateAndDeliverDietPlan } from '../services/dietPlanDelivery';
import { successResponse, errorResponse } from '../utils/response';

// GET /api/v1/admin/diet-plans
// Lists all user-submitted AI-generated plans (excludes dietitian-appointment plans).
// Query: ?status=completed|sent|generating|failed  &page=1  &limit=20  &search=name_or_email
export const listDietPlansForAdmin = async (req: Request, res: Response) => {
  try {
    const page   = Math.max(1, Number(req.query.page)  || 1);
    const limit  = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;

    const VALID_STATUSES = ['generating', 'completed', 'failed', 'sent'];
    if (status && !VALID_STATUSES.includes(status)) {
      return errorResponse(res, 400, `status must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    const { plans, total } = await findAllDietPlansForAdmin(status, page, limit, search);

    return successResponse(res, 200, 'Diet plans fetched', {
      plans,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Admin list diet plans error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/admin/diet-plans/:plan_id
// Returns the full plan + form data for the dietitian to review/edit.
export const getDietPlanForAdmin = async (req: Request, res: Response) => {
  try {
    const planId = Number(req.params.plan_id);
    if (isNaN(planId)) return errorResponse(res, 400, 'Invalid plan_id');

    const plan = await findDietPlanWithFormById(planId);
    if (!plan) return errorResponse(res, 404, 'Diet plan not found');

    if (plan.dietitian_id !== null) {
      return errorResponse(res, 403, 'This plan belongs to the dietitian appointment flow');
    }

    const form = await findDietFormById(plan.form_id);
    const deliveryInfo = form
      ? {
          email:           form.email ?? null,
          whatsapp:        form.whatsapp ?? null,
          delivery_method: (form.delivery_method as string[] | null) ?? [],
          full_name:       form.full_name ?? null,
        }
      : null;

    return successResponse(res, 200, 'Diet plan fetched', { plan, delivery_info: deliveryInfo });
  } catch (err) {
    console.error('Admin get diet plan error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// PUT /api/v1/admin/diet-plans/:plan_id
// Allows the dietitian to edit any part of the AI-generated plan before sending.
// All body fields are optional — only supplied fields are updated.
// Accepted: client_name, calorie_range, protein_target_g, carbs_target_g, fat_target_g,
//           primary_goal, plan_duration, diet_type, hydration_guide,
//           weeks, general_tips, featured_recipes, notes
export const editDietPlan = async (req: Request, res: Response) => {
  try {
    const planId = Number(req.params.plan_id);
    if (isNaN(planId)) return errorResponse(res, 400, 'Invalid plan_id');

    const plan = await findDietPlanById(planId);
    if (!plan) return errorResponse(res, 404, 'Diet plan not found');

    if (plan.dietitian_id !== null) {
      return errorResponse(res, 403, 'This plan belongs to the dietitian appointment flow');
    }

    const EDITABLE = ['completed', 'sent'] as const;
    if (!EDITABLE.includes(plan.status as typeof EDITABLE[number])) {
      return errorResponse(res, 400, `Plan cannot be edited in status "${plan.status}". Must be completed or sent.`);
    }

    const {
      client_name, calorie_range, protein_target_g, carbs_target_g, fat_target_g,
      primary_goal, plan_duration, diet_type, hydration_guide,
      weeks, general_tips, featured_recipes, notes,
    } = req.body as Record<string, unknown>;

    await updateAdminDietPlanContent(planId, {
      ...(client_name      !== undefined && { client_name:      String(client_name) }),
      ...(calorie_range    !== undefined && { calorie_range:    String(calorie_range) }),
      ...(protein_target_g !== undefined && { protein_target_g: Number(protein_target_g) }),
      ...(carbs_target_g   !== undefined && { carbs_target_g:   Number(carbs_target_g) }),
      ...(fat_target_g     !== undefined && { fat_target_g:     Number(fat_target_g) }),
      ...(primary_goal     !== undefined && { primary_goal:     String(primary_goal) }),
      ...(plan_duration    !== undefined && { plan_duration:    String(plan_duration) }),
      ...(diet_type        !== undefined && { diet_type:        String(diet_type) }),
      ...(hydration_guide  !== undefined && { hydration_guide:  String(hydration_guide) }),
      ...(weeks            !== undefined && { weeks:            weeks as import('../models/DietPlan').WeekPlan[] }),
      ...(general_tips     !== undefined && { general_tips:     general_tips as string[] }),
      ...(featured_recipes !== undefined && { featured_recipes: featured_recipes as import('../models/DietPlan').FeaturedRecipe[] }),
      ...(notes            !== undefined && { notes:            String(notes) }),
    });

    return successResponse(res, 200, 'Diet plan updated successfully');
  } catch (err) {
    console.error('Admin edit diet plan error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// POST /api/v1/admin/diet-plans/:plan_id/send
// Sends the (optionally edited) plan to the user via their selected delivery method.
// If the PDF is missing it will be generated on the fly before sending.
// Marks plan status as 'sent' after successful delivery.
export const sendDietPlanToUser = async (req: Request, res: Response) => {
  try {
    const planId = Number(req.params.plan_id);
    if (isNaN(planId)) return errorResponse(res, 400, 'Invalid plan_id');

    const plan = await findDietPlanById(planId);
    if (!plan) return errorResponse(res, 404, 'Diet plan not found');

    if (plan.dietitian_id !== null) {
      return errorResponse(res, 403, 'This plan belongs to the dietitian appointment flow');
    }

    if (plan.status === 'generating') {
      return errorResponse(res, 400, 'Plan is still being generated. Please wait until it is ready.');
    }
    if (plan.status === 'failed') {
      return errorResponse(res, 400, 'Plan generation failed. Cannot send a failed plan.');
    }
    if (plan.status !== 'completed' && plan.status !== 'sent') {
      return errorResponse(res, 400, `Plan cannot be sent in status "${plan.status}"`);
    }

    const form = await findDietFormById(plan.form_id);
    if (!form) return errorResponse(res, 404, 'Associated diet form not found');

    const deliveryMethods = (form.delivery_method as string[] | null) ?? [];
    if (deliveryMethods.length === 0) {
      return errorResponse(res, 400, 'No delivery method selected by the user');
    }

    const { sentEmail, sentWhatsApp } = await deliverDietPlanToUser(planId);

    if (!sentEmail && !sentWhatsApp) {
      return errorResponse(res, 400, 'Delivery failed — no email/WhatsApp was sent. Check that the user has a valid email/phone and that the PDF exists.');
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
    console.error('Admin send diet plan error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// POST /api/v1/admin/diet-plans/:plan_id/retry
// Re-triggers AI generation for a failed plan. Kicks off in the background and returns immediately.
// Only works when status = 'failed'. The plan record is reused (not duplicated).
export const retryDietPlanGeneration = async (req: Request, res: Response) => {
  try {
    const planId = Number(req.params.plan_id);
    if (isNaN(planId)) return errorResponse(res, 400, 'Invalid plan_id');

    const plan = await findDietPlanById(planId);
    if (!plan) return errorResponse(res, 404, 'Diet plan not found');

    if (plan.dietitian_id !== null) {
      return errorResponse(res, 403, 'This plan belongs to the dietitian appointment flow');
    }
    if (plan.status !== 'failed') {
      return errorResponse(res, 400, `Plan cannot be retried in status "${plan.status}". Only failed plans can be retried.`);
    }

    // Determine weeks: 3-month subscriptions generate 4 weeks per run
    const payment = await findPaidPaymentByDietFormId(plan.form_id);
    const weeksOverride = payment?.plan === '3_months' ? 4 : undefined;

    void generateAndDeliverDietPlan(plan.form_id, plan.user_id, weeksOverride, null, null, planId).catch((err) => {
      console.error(`[retry] Diet plan generation failed for plan ${planId}:`, err);
    });

    return successResponse(res, 202, 'Diet plan generation started. Check back shortly — it will appear as completed when ready.', {
      plan_id: planId,
      form_id: plan.form_id,
    });
  } catch (err) {
    console.error('Admin retry diet plan error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};
