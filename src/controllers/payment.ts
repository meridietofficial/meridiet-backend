import crypto from 'crypto';
import type { Request, Response } from 'express';
import { razorpay, PLANS } from '../config/razorpay';
import { env } from '../config/env';
import { createPayment, findPaymentByOrderId, markPaymentPaid, markPaymentFailed } from '../models/Payment';
import { createDietForm } from '../models/DietForm';
import { successResponse, errorResponse } from '../utils/response';
import { generateAndDeliverDietPlan } from '../services/dietPlanDelivery';

// POST /api/v1/payment/create-order
// Body: { plan: '1_week' | '1_month' | '3_months' }
export const createOrder = async (req: Request, res: Response) => {
  try {
    const { plan } = req.body as { plan: string };

    const selectedPlan = PLANS[plan];
    if (!selectedPlan) {
      return errorResponse(res, 400, `Invalid plan. Valid options: ${Object.keys(PLANS).join(', ')}`);
    }

    const userId = req.user?.sub ? Number(req.user.sub) : null;

    const order = await razorpay.orders.create({
      amount: selectedPlan.amountInr * 100, // Razorpay requires paise
      currency: selectedPlan.currency,
      receipt: `receipt_${Date.now()}`,
    });

    const monthsTotal = plan === '3_months' ? 3 : 1;
    const perMonthAmount = parseFloat((selectedPlan.amountInr / monthsTotal).toFixed(2));

    await createPayment({
      razorpay_order_id: order.id,
      plan,
      amount: selectedPlan.amountInr,
      months_total: monthsTotal,
      per_month_amount: perMonthAmount,
      currency: selectedPlan.currency,
      user_id: userId,
    });

    return successResponse(res, 201, 'Order created', {
      order_id: order.id,
      amount: selectedPlan.amountInr,
      currency: selectedPlan.currency,
      key_id: env.RAZORPAY_KEY_ID,
      plan: selectedPlan.label,
    });
  } catch (err) {
    console.error('Create order error:', err);
    return errorResponse(res, 500, 'Failed to create payment order');
  }
};

// POST /api/v1/payment/verify
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, ...dietFormData }
export const verifyPaymentAndSubmitForm = async (req: Request, res: Response) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, ...dietFormData } = req.body as {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    [key: string]: unknown;
  };

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return errorResponse(res, 400, 'razorpay_order_id, razorpay_payment_id and razorpay_signature are required');
  }

  // Verify HMAC signature
  const expectedSignature = crypto
    .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (expectedSignature !== razorpay_signature) {
    // Mark payment as failed so it's tracked
    await markPaymentFailed(razorpay_order_id).catch(() => null);
    return errorResponse(res, 400, 'Payment verification failed: invalid signature');
  }

  try {
    const payment = await findPaymentByOrderId(razorpay_order_id);
    if (!payment) {
      return errorResponse(res, 404, 'Order not found');
    }
    if (payment.status === 'paid') {
      return errorResponse(res, 409, 'Payment already verified');
    }

    const userId = req.user?.sub ? Number(req.user.sub) : null;

    const form = await createDietForm({
      user_id: userId,
      ...dietFormData,
    });

    await markPaymentPaid(razorpay_order_id, razorpay_payment_id, razorpay_signature, form!.id);

    // Background: generate plan → PDF → S3 → cashback/subscription credit → email
    // For 3-month plans, only generate month 1 (4 weeks); remaining credit goes to wallet.
    if (form) {
      const weeksOverride = payment.plan === '3_months' ? 4 : undefined;
      void generateAndDeliverDietPlan(form.id, userId, weeksOverride).catch((err) => {
        console.error('[payment] delivery pipeline error:', err);
      });
    }

    return successResponse(res, 201, 'Payment verified and diet form submitted successfully', {
      diet_form: form,
      payment: {
        order_id: razorpay_order_id,
        payment_id: razorpay_payment_id,
        plan: payment.plan,
        amount: payment.amount,
      },
    });
  } catch (err) {
    console.error('Verify payment error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// POST /api/v1/payment/failed
// Body: { razorpay_order_id }
export const markFailed = async (req: Request, res: Response) => {
  try {
    const { razorpay_order_id } = req.body as { razorpay_order_id: string };
    if (!razorpay_order_id) return errorResponse(res, 400, 'razorpay_order_id is required');

    await markPaymentFailed(razorpay_order_id);
    return successResponse(res, 200, 'Payment marked as failed');
  } catch (err) {
    console.error('Mark failed error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};
