import crypto from 'crypto';
import type { Request, Response } from 'express';
import { razorpay, PLANS } from '../config/razorpay';
import { env } from '../config/env';
import { createPayment, findPaymentByOrderId, markPaymentPaid, markPaymentFailed } from '../models/Payment';
import { findDietFormById, updateDietForm } from '../models/DietForm';
import { successResponse, errorResponse } from '../utils/response';
import { generateAndDeliverDietPlan } from '../services/dietPlanDelivery';

// POST /api/v1/payment/create-order
// Body: { plan: '1_week' | '1_month' | '3_months', diet_form_id: number }
export const createOrder = async (req: Request, res: Response) => {
  try {
    const { plan, diet_form_id } = req.body as { plan: string; diet_form_id?: number };

    const selectedPlan = PLANS[plan];
    if (!selectedPlan) {
      return errorResponse(res, 400, `Invalid plan. Valid options: ${Object.keys(PLANS).join(', ')}`);
    }

    if (!diet_form_id) {
      return errorResponse(res, 400, 'diet_form_id is required');
    }

    const form = await findDietFormById(diet_form_id);
    if (!form) {
      return errorResponse(res, 404, 'Diet form not found');
    }

    const userId = req.user?.sub ? Number(req.user.sub) : null;

    const order = await razorpay.orders.create({
      amount: selectedPlan.amountInr * 100,
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
      diet_form_id,
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
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
// diet_form_id is already stored in the payment record from create-order
export const verifyPaymentAndSubmitForm = async (req: Request, res: Response) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body as {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
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
    await markPaymentFailed(razorpay_order_id).catch(() => null);
    return errorResponse(res, 400, 'Payment verification failed: invalid signature');
  }

  try {
    const payment = await findPaymentByOrderId(razorpay_order_id);
    if (!payment) return errorResponse(res, 404, 'Order not found');
    if (payment.status === 'paid') return errorResponse(res, 409, 'Payment already verified');

    if (!payment.diet_form_id) {
      return errorResponse(res, 400, 'No diet form linked to this order');
    }

    const form = await findDietFormById(payment.diet_form_id);
    if (!form) return errorResponse(res, 404, 'Diet form not found');

    await markPaymentPaid(razorpay_order_id, razorpay_payment_id, razorpay_signature, payment.diet_form_id);

    // If the form was submitted as a guest (user_id null), back-fill it now using the payment's user_id
    const userId = form.user_id ?? payment.user_id;
    if (!form.user_id && userId) {
      await updateDietForm(form.id, { user_id: userId }).catch((err) => {
        console.error('[payment] failed to back-fill form user_id:', err);
      });
    }

    // Background: generate plan → PDF → S3 → cashback/subscription credit → email
    if (userId) {
      const weeksOverride = payment.plan === '3_months' ? 4 : undefined;
      void generateAndDeliverDietPlan(form.id, userId, weeksOverride).catch((err) => {
        console.error('[payment] delivery pipeline error:', err);
      });
    }

    return successResponse(res, 201, 'Payment verified successfully', {
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
