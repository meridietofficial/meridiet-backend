import type { Request, Response } from 'express';
import {
  findDietPlanById,
  findDietPlanWithFormById,
  findAllDietPlansForAdmin,
  findAllManualDietPlansForAdmin,
  findManualDietPlanDetailForAdmin,
  updateAdminDietPlanContent,
  markDietPlanSent,
  findDietPlanByFormId,
} from '../models/DietPlan';
import { findDietFormById, type DietForm } from '../models/DietForm';
import { findPaidPaymentByDietFormId } from '../models/Payment';
import { findUserById } from '../models/User';
import { query } from '../config/database';
import { deliverDietPlanToUser, generateAndDeliverDietPlan } from '../services/dietPlanDelivery';
import { successResponse, errorResponse } from '../utils/response';
import { toIST, istToUTC } from '../utils/date';

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

    const plansIST = plans.map((p) => ({
      ...p,
      created_at: toIST(p.created_at),
      updated_at: toIST(p.updated_at),
      sent_at:    toIST(p.sent_at),
    }));

    return successResponse(res, 200, 'Diet plans fetched', {
      plans: plansIST,
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

    const planIST = {
      ...plan,
      created_at: toIST(plan.created_at),
      updated_at: toIST(plan.updated_at),
      sent_at:    toIST(plan.sent_at),
    };

    return successResponse(res, 200, 'Diet plan fetched', { plan: planIST, delivery_info: deliveryInfo });
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
      sent_at:       toIST(new Date()),
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

// GET /api/v1/admin/diet-plans/manual
// Lists all white-label (manual) diet plans created by any dietitian across the platform.
// Query: ?status=draft|generating|completed|failed|sent  &page=1  &limit=20  &search=patient_or_dietitian
export const listManualDietPlansForAdmin = async (req: Request, res: Response) => {
  try {
    const page   = Math.max(1, Number(req.query.page)  || 1);
    const limit  = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;

    const VALID_STATUSES = ['draft', 'generating', 'completed', 'failed', 'sent'];
    if (status && !VALID_STATUSES.includes(status)) {
      return errorResponse(res, 400, `status must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    const { plans, total } = await findAllManualDietPlansForAdmin(status, page, limit, search);

    const plansIST = plans.map((p) => ({
      ...p,
      created_at: toIST(p.created_at),
      updated_at: toIST(p.updated_at),
      sent_at:    toIST(p.sent_at),
    }));

    return successResponse(res, 200, 'Manual diet plans fetched', {
      plans: plansIST,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Admin list manual diet plans error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/admin/diet-plans/manual/:plan_id
// Returns the full white-label plan: complete patient form data + generated diet chart content + dietitian info.
export const getManualDietPlanForAdmin = async (req: Request, res: Response) => {
  try {
    const planId = Number(req.params.plan_id);
    if (isNaN(planId)) return errorResponse(res, 400, 'Invalid plan_id');

    const plan = await findManualDietPlanDetailForAdmin(planId);
    if (!plan) return errorResponse(res, 404, 'Manual diet plan not found');

    const planIST = {
      ...plan,
      created_at: toIST(plan.created_at),
      updated_at: toIST(plan.updated_at),
      sent_at:    toIST(plan.sent_at),
    };

    return successResponse(res, 200, 'Manual diet plan fetched', { plan: planIST });
  } catch (err) {
    console.error('Admin get manual diet plan error:', err);
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

// ── Legacy form-centric diet routes (moved from admin.ts) ─────────────────────

const FORM_JSON_FIELDS = ['goals', 'cuisine_preference', 'food_allergies', 'medical_conditions', 'delivery_method'];

const parseFormJsonFields = (row: Record<string, unknown>) => {
  for (const field of FORM_JSON_FIELDS) {
    if (typeof row[field] === 'string') {
      try { row[field] = JSON.parse(row[field] as string); } catch { /* leave as-is */ }
    }
  }
};

// GET /api/v1/admin/diet-form-requests
// Lists unpaid diet form submissions (no paid payment on record).
// Query: ?page &limit &search &status=pending|generating|completed|failed &planType=1|2|3 &startDate &endDate &sortBy &sortOrder
export const getDietFormRequests = async (req: Request, res: Response) => {
  try {
    const page      = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit     = Math.min(10000, Math.max(1, parseInt(req.query.limit as string) || 10));
    const search    = (req.query.search as string | undefined)?.trim();
    const status    = req.query.status   as string | undefined;
    const planType  = req.query.planType as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate   = req.query.endDate   as string | undefined;
    const offset    = (page - 1) * limit;

    const VALID_SORT: Record<string, string> = { created_at: 'df.created_at', full_name: 'df.full_name' };
    const sortField = VALID_SORT[req.query.sortBy as string ?? ''] ?? 'df.created_at';
    const sortOrder = (req.query.sortOrder as string | undefined)?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const validStatuses  = ['pending', 'generating', 'completed', 'failed'];
    const validPlanTypes = ['1', '2', '3'];

    const params: unknown[] = [];
    const conditions: string[] = ['1=1'];

    if (search) {
      conditions.push('(df.full_name LIKE ? OR df.email LIKE ? OR df.whatsapp LIKE ? OR df.city LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }

    if (status && validStatuses.includes(status)) {
      if (status === 'pending') {
        conditions.push('dp.id IS NULL');
      } else {
        conditions.push('dp.status = ?');
        params.push(status);
      }
    }

    if (planType && validPlanTypes.includes(planType)) {
      conditions.push('df.plan_type = ?');
      params.push(parseInt(planType));
    }

    if (startDate) { conditions.push('df.created_at >= ?'); params.push(istToUTC(startDate, false)); }
    if (endDate)   { conditions.push('df.created_at <= ?'); params.push(istToUTC(endDate, true)); }

    const baseWhere = `WHERE ${conditions.join(' AND ')}`;

    const [rows, countRows] = await Promise.all([
      query<DietForm & { plan_id: number | null; status: string }>(
        `SELECT
           df.*,
           dp.id AS plan_id,
           COALESCE(dp.status, 'pending') AS status
         FROM diet_forms df
         LEFT JOIN diet_plans dp ON dp.id = (
           SELECT id FROM diet_plans WHERE form_id = df.id ORDER BY created_at DESC LIMIT 1
         )
         LEFT JOIN payments p ON p.diet_form_id = df.id AND p.status = 'paid'
         ${baseWhere} AND p.id IS NULL
         ORDER BY ${sortField} ${sortOrder}
         LIMIT ${limit} OFFSET ${offset}`,
        params,
      ),
      query<{ total: number }>(
        `SELECT COUNT(*) AS total
         FROM diet_forms df
         LEFT JOIN diet_plans dp ON dp.id = (
           SELECT id FROM diet_plans WHERE form_id = df.id ORDER BY created_at DESC LIMIT 1
         )
         LEFT JOIN payments p ON p.diet_form_id = df.id AND p.status = 'paid'
         ${baseWhere} AND p.id IS NULL`,
        params,
      ),
    ]);

    const data = rows.map((row) => {
      const r = row as unknown as Record<string, unknown>;
      parseFormJsonFields(r);
      r.created_at = toIST(row.created_at);
      r.updated_at = toIST(row.updated_at);
      return row;
    });

    return successResponse(res, 200, 'Diet form requests fetched successfully', data, {
      page, limit, total: countRows[0]?.total ?? 0, totalPages: Math.ceil((countRows[0]?.total ?? 0) / limit),
    });
  } catch (err) {
    console.error('Get diet chart requests error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/admin/paid-diet-charts
// Lists diet form submissions that have a paid payment, with their plan status.
// Query: ?page &limit &search &planType=1|2|3 &planStatus &from &to &sortBy &sortOrder
export const getPaidDietCharts = async (req: Request, res: Response) => {
  try {
    const page       = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit      = Math.min(10000, Math.max(1, parseInt(req.query.limit as string) || 10));
    const search     = (req.query.search as string | undefined)?.trim();
    const planType   = req.query.planType   as string | undefined;
    const planStatus = req.query.planStatus as string | undefined;
    const from       = req.query.from       as string | undefined;
    const to         = req.query.to         as string | undefined;
    const offset     = (page - 1) * limit;

    // Sort by payment date by default so listing order matches the revenue graph
    const VALID_SORT: Record<string, string> = { created_at: 'p.created_at', full_name: 'df.full_name' };
    const sortField = VALID_SORT[req.query.sortBy as string ?? ''] ?? 'p.created_at';
    const sortOrder = (req.query.sortOrder as string | undefined)?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const validPlanTypes    = ['1', '2', '3'];
    const validPlanStatuses = ['generating', 'completed', 'failed', 'sent'];

    const params: unknown[] = [];
    const conditions: string[] = ['1=1'];

    if (search) {
      conditions.push('(df.full_name LIKE ? OR df.email LIKE ? OR df.whatsapp LIKE ? OR df.city LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }

    if (planType && validPlanTypes.includes(planType)) {
      conditions.push('df.plan_type = ?');
      params.push(parseInt(planType));
    }

    if (planStatus && validPlanStatuses.includes(planStatus)) {
      conditions.push('dp.status = ?');
      params.push(planStatus);
    }

    // Filter by payment date (p.created_at) so this listing is consistent with
    // the revenue dashboard which also counts by payment date, not form creation date.
    if (from) { conditions.push('p.created_at >= ?'); params.push(istToUTC(from, false)); }
    if (to)   { conditions.push('p.created_at <= ?'); params.push(istToUTC(to, true)); }

    const baseWhere = `WHERE ${conditions.join(' AND ')}`;

    const [rows, countRows] = await Promise.all([
      query<DietForm & { plan_id: number | null; plan_status: string | null; pdf_url: string | null; sent_at: Date | null; payment_amount: number; paid_at: Date | null }>(
        `SELECT
           df.*,
           dp.id      AS plan_id,
           dp.status  AS plan_status,
           dp.pdf_url AS pdf_url,
           dp.sent_at AS sent_at,
           COALESCE(p.final_amount, p.amount) AS payment_amount,
           p.created_at AS paid_at
         FROM diet_forms df
         INNER JOIN payments p ON p.diet_form_id = df.id AND p.status = 'paid'
         LEFT JOIN diet_plans dp ON dp.id = (
           SELECT id FROM diet_plans WHERE form_id = df.id ORDER BY created_at DESC LIMIT 1
         )
         ${baseWhere}
         ORDER BY ${sortField} ${sortOrder}
         LIMIT ${limit} OFFSET ${offset}`,
        params,
      ),
      query<{ total: number }>(
        `SELECT COUNT(*) AS total
         FROM diet_forms df
         INNER JOIN payments p ON p.diet_form_id = df.id AND p.status = 'paid'
         LEFT JOIN diet_plans dp ON dp.id = (
           SELECT id FROM diet_plans WHERE form_id = df.id ORDER BY created_at DESC LIMIT 1
         )
         ${baseWhere}`,
        params,
      ),
    ]);

    const data = rows.map((row) => {
      const r = row as unknown as Record<string, unknown>;
      parseFormJsonFields(r);
      r.form_created_at = toIST(row.created_at);           // when the form was filled
      r.created_at      = toIST(row.paid_at as Date | null); // payment date — matches revenue
      r.updated_at      = toIST(row.updated_at);
      r.sent_at         = toIST(row.sent_at as Date | null);
      r.paid_at         = toIST(row.paid_at as Date | null);
      return row;
    });

    return successResponse(res, 200, 'Paid diet charts fetched successfully', data, {
      page, limit, total: countRows[0]?.total ?? 0, totalPages: Math.ceil((countRows[0]?.total ?? 0) / limit),
    });
  } catch (err) {
    console.error('Get paid diet charts error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/admin/diet-form-requests/:form_id/details
// Full form data + linked user + generated diet plan for a specific form.
export const getDietChartDetails = async (req: Request, res: Response) => {
  try {
    const form_id = parseInt(req.params.form_id);
    if (isNaN(form_id)) return errorResponse(res, 400, 'Invalid form_id');

    const form = await findDietFormById(form_id);
    if (!form) return errorResponse(res, 404, 'Diet form not found');

    let user = null;
    if (form.user_id) {
      const u = await findUserById(form.user_id);
      if (u) {
        const { password: _, is_delete: __, ...safeUser } = u as unknown as Record<string, unknown>;
        user = safeUser;
      }
    }

    const plan = await findDietPlanByFormId(form_id);

    return successResponse(res, 200, 'Diet chart details fetched successfully', {
      form: {
        id:            form.id,
        user_id:       form.user_id,
        plan_type:     form.plan_type,
        full_name:     form.full_name,
        age:           form.age,
        gender:        form.gender,
        dob:           form.dob,
        height:        form.height,
        height_unit:   form.height_unit,
        weight:        form.weight,
        weight_unit:   form.weight_unit,
        goals:         form.goals,
        activity_level:     form.activity_level,
        work_type:          form.work_type,
        workout_type:       form.workout_type,
        diet_type:          form.diet_type,
        cuisine_preference: form.cuisine_preference,
        food_allergies:     form.food_allergies,
        foods_dislike:      form.foods_dislike,
        favorite_foods:     form.favorite_foods,
        medical_conditions: form.medical_conditions,
        other_condition:    form.other_condition,
        on_medication:      form.on_medication,
        medications:        form.medications,
        digestive_health:   form.digestive_health,
        smoke_alcohol:      form.smoke_alcohol,
        health_notes:       form.health_notes,
        contact_name:    form.contact_name,
        whatsapp:        form.whatsapp,
        email:           form.email,
        delivery_method: form.delivery_method,
        city:            form.city,
        state:           form.state,
        state_code:      form.state_code,
        final_notes:     form.final_notes,
        created_at: toIST(form.created_at),
        updated_at: toIST(form.updated_at),
      },
      user,
      diet_plan: plan ? {
        plan_id:          plan.id,
        status:           plan.status,
        bmi:              plan.bmi,
        bmi_category:     plan.bmi_category,
        bmr:              plan.bmr,
        tdee:             plan.tdee,
        client_profile:   plan.client_profile,
        summary: {
          client_name:      plan.client_name,
          calorie_range:    plan.calorie_range,
          protein_target_g: plan.protein_target_g,
          carbs_target_g:   plan.carbs_target_g,
          fat_target_g:     plan.fat_target_g,
          primary_goal:     plan.primary_goal,
          plan_duration:    plan.plan_duration,
          diet_type:        plan.diet_type,
        },
        hydration_guide:  plan.hydration_guide,
        weeks:            plan.weeks,
        general_tips:     plan.general_tips,
        featured_recipes: plan.featured_recipes,
        created_at: toIST(plan.created_at),
      } : null,
    });
  } catch (err) {
    console.error('Get diet chart details error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/admin/diet-form-requests/:form_id/preview
// Preview the AI-generated diet plan content for a given form.
export const previewDietPlan = async (req: Request, res: Response) => {
  try {
    const form_id = parseInt(req.params.form_id);
    if (isNaN(form_id)) return errorResponse(res, 400, 'Invalid form_id');

    const form = await findDietFormById(form_id);
    if (!form) return errorResponse(res, 404, 'Diet form not found');

    const plan = await findDietPlanByFormId(form_id);
    if (!plan) {
      return errorResponse(res, 404, 'Diet chart has not been generated for this request yet');
    }

    if (plan.status === 'generating') {
      return successResponse(res, 202, 'Diet chart is still being generated', {
        plan_id: plan.id,
        status:  plan.status,
      });
    }

    if (plan.status === 'failed') {
      return errorResponse(res, 409, 'Diet chart generation failed for this request');
    }

    return successResponse(res, 200, 'Diet plan generated successfully', {
      plan_id:          plan.id,
      form_id:          plan.form_id,
      client_profile:   plan.client_profile,
      summary: {
        client_name:      plan.client_name,
        calorie_range:    plan.calorie_range,
        protein_target_g: plan.protein_target_g,
        carbs_target_g:   plan.carbs_target_g,
        fat_target_g:     plan.fat_target_g,
        primary_goal:     plan.primary_goal,
        plan_duration:    plan.plan_duration,
        diet_type:        plan.diet_type,
      },
      weeks:            plan.weeks,
      hydration_guide:  plan.hydration_guide,
      general_tips:     plan.general_tips,
      featured_recipes: plan.featured_recipes,
      created_at:       toIST(plan.created_at),
    });
  } catch (err) {
    console.error('Preview diet plan error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};
