import type { Request, Response } from 'express';
import { findDietFormById, createDietForm } from '../models/DietForm';
import { findDietPlanByFormId } from '../models/DietPlan';
import { successResponse, errorResponse } from '../utils/response';
import { generateAndDeliverDietPlan } from '../services/dietPlanDelivery';
import { buildCoverPageHtml } from '../services/dietPlanHtml';
import { findActiveSubscriptionByUserId, incrementMonthsGenerated } from '../models/Payment';
import { debitWallet, creditWallet } from '../models/Wallet';
import { getSetting } from '../models/Setting';

// POST /api/v1/diet-plan/generate
// Body: { form_id: number }
// Triggers generation in background; poll GET /:form_id for status + result.
export const generateDietPlan = async (req: Request, res: Response) => {
  try {
    const { form_id } = req.body as { form_id?: number };
    if (!form_id) return errorResponse(res, 400, 'form_id is required');

    const form = await findDietFormById(Number(form_id));
    if (!form) return errorResponse(res, 404, 'Diet form not found');

    const existing = await findDietPlanByFormId(Number(form_id));
    if (existing && existing.status === 'completed') {
      return errorResponse(res, 409, 'A diet plan has already been generated for this form. Use GET /api/v1/diet-plan/:form_id to retrieve it.');
    }
    if (existing && existing.status === 'generating') {
      return successResponse(res, 202, 'Diet plan generation is already in progress. Poll GET /api/v1/diet-plan/:form_id for status.');
    }

    const userId = req.user?.sub ? Number(req.user.sub) : form.user_id;

    void generateAndDeliverDietPlan(Number(form_id), userId).catch((err) => {
      console.error('[generateDietPlan] delivery error:', err);
    });

    return successResponse(res, 202, 'Diet plan generation started. You will receive an email when it is ready. Poll GET /api/v1/diet-plan/:form_id for status.');
  } catch (err) {
    console.error('Generate diet plan error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/diet-plan/:form_id/preview-html
// Returns raw HTML — open directly in a browser to preview page 1.
export const previewDietPlanHtml = async (req: Request, res: Response) => {
  try {
    const form_id = Number(req.params.form_id);
    if (isNaN(form_id)) return errorResponse(res, 400, 'Invalid form_id');

    const plan = await findDietPlanByFormId(form_id);
    if (!plan) return errorResponse(res, 404, 'No diet plan found for this form');
    if (plan.status !== 'completed' && plan.status !== 'sent') {
      return errorResponse(res, 400, `Plan is not ready yet (status: ${plan.status})`);
    }

    const html = buildCoverPageHtml(plan);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (err) {
    console.error('Preview diet plan error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/diet-plan/:form_id
export const getDietPlan = async (req: Request, res: Response) => {
  try {
    const form_id = Number(req.params.form_id);
    if (isNaN(form_id)) return errorResponse(res, 400, 'Invalid form_id');

    const plan = await findDietPlanByFormId(form_id);
    if (!plan) return errorResponse(res, 404, 'No diet plan found for this form');

    return successResponse(res, 200, 'Diet plan fetched successfully', {
      plan_id:        plan.id,
      form_id:        plan.form_id,
      status:         plan.status,
      pdf_url:        plan.pdf_url ?? null,
      client_profile: plan.client_profile,
      vitals: {
        bmi:          plan.bmi,
        bmi_category: plan.bmi_category,
        bmr:          plan.bmr,
        tdee:         plan.tdee,
      },
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
    });
  } catch (err) {
    console.error('Get diet plan error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/diet-plan/subscription-status
// Returns the user's 3-month subscription state (months used, remaining, per-month cost)
export const getSubscriptionStatus = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.sub);
    const subscription = await findActiveSubscriptionByUserId(userId);

    if (!subscription) {
      return successResponse(res, 200, 'No active subscription', { has_subscription: false });
    }

    return successResponse(res, 200, 'Subscription status', {
      has_subscription:  true,
      payment_id:        subscription.id,
      plan:              '3_months',
      months_total:      subscription.months_total,
      months_generated:  subscription.months_generated,
      months_remaining:  subscription.months_total - subscription.months_generated,
      per_month_amount:  subscription.per_month_amount,
    });
  } catch (err) {
    console.error('Get subscription status error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// POST /api/v1/diet-plan/redeem-month
// Body: full diet form fields (fresh data for the new month)
// Debits per_month_amount from wallet and generates a 1-month (4-week) plan.
export const redeemNextMonth = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.sub);

    const subscription = await findActiveSubscriptionByUserId(userId);
    if (!subscription) {
      return errorResponse(res, 400, 'No active 3-month subscription found or all months already redeemed');
    }

    const monthNumber = subscription.months_generated + 1;

    // Debit wallet — throws if balance is insufficient
    try {
      await debitWallet({
        user_id:      userId,
        source:       'purchase',
        amount:       subscription.per_month_amount,
        description:  `Month ${monthNumber} of 3 — 3-Month Diet Plan`,
        reference_id: String(subscription.id),
      });
    } catch (walletErr: unknown) {
      const msg = walletErr instanceof Error ? walletErr.message : '';
      if (msg === 'Insufficient wallet balance') {
        return errorResponse(res, 400, `Insufficient wallet balance. Required: ₹${subscription.per_month_amount}`);
      }
      throw walletErr;
    }

    // Increment months_generated immediately so duplicate calls are blocked
    await incrementMonthsGenerated(subscription.id);

    // Cashback on the redeemed month (same % as regular plans)
    try {
      const [enabledRaw, percentRaw] = await Promise.all([
        getSetting('wallet_cashback_enabled'),
        getSetting('wallet_cashback_percent'),
      ]);
      if (enabledRaw === '1') {
        const cashbackPercent = Math.max(0, Number(percentRaw ?? 0));
        if (cashbackPercent > 0) {
          const cashbackAmount = parseFloat(((subscription.per_month_amount * cashbackPercent) / 100).toFixed(2));
          await creditWallet({
            user_id:      userId,
            source:       'reward',
            amount:       cashbackAmount,
            description:  `${cashbackPercent}% cashback from Diet Chart Generation`,
            reference_id: String(subscription.id),
          });
        }
      }
    } catch (cbErr) {
      console.error('[redeemNextMonth] Cashback error:', cbErr);
    }

    // Create a fresh diet form with the submitted data
    const form = await createDietForm({ user_id: userId, ...req.body });
    if (!form) {
      return errorResponse(res, 500, 'Failed to create diet form');
    }

    // Generate 1-month (4-week) plan in background
    void generateAndDeliverDietPlan(form.id, userId, 4).catch((err) => {
      console.error('[redeemNextMonth] pipeline error:', err);
    });

    return successResponse(res, 202, `Month ${monthNumber} redeemed. Your diet plan will be ready shortly and sent to your email.`, {
      form,
      months_used:      monthNumber,
      months_remaining: subscription.months_total - monthNumber,
    });
  } catch (err) {
    console.error('Redeem next month error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};
