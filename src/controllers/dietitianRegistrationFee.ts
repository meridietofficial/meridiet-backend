import crypto from 'crypto';
import type { Request, Response } from 'express';
import { razorpay } from '../config/razorpay';
import { env } from '../config/env';
import { findDietitianByUserId, activateDietitianSubscription } from '../models/Dietitian';
import { findUserById } from '../models/User';
import {
  createPostTrialRegistrationOrder,
  findByOrderId,
  markRegistrationPaid,
  markRegistrationFailed,
  findPaidRegistrationByDietitianId,
} from '../models/DietitianRegistrationPayment';
import { getDietitianRegistrationFee } from '../models/Setting';
import { adminCreditPlanCredits } from '../models/DietitianWallet';
import { successResponse, errorResponse } from '../utils/response';

// POST /api/v1/dietitian/registration-fee/create-order
// Called after trial expires — creates a Razorpay order for the one-time registration fee
export const createRegistrationFeeOrder = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.sub);

    const dietitian = await findDietitianByUserId(userId);
    if (!dietitian) return errorResponse(res, 404, 'Dietitian profile not found');

    if (dietitian.subscription_status === 'active') {
      return errorResponse(res, 400, 'Registration fee already paid');
    }

    if (dietitian.subscription_status === 'pending_approval') {
      return errorResponse(res, 400, 'Your profile is still under review. You cannot pay yet.');
    }

    // Check if already paid (idempotency guard)
    const alreadyPaid = await findPaidRegistrationByDietitianId(dietitian.id);
    if (alreadyPaid) return errorResponse(res, 400, 'Registration fee already paid');

    const user = await findUserById(userId);
    if (!user) return errorResponse(res, 404, 'User not found');

    const fee = await getDietitianRegistrationFee();

    const order = await razorpay.orders.create({
      amount:   fee * 100, // paise
      currency: 'INR',
      receipt:  `dreg_${dietitian.id}_${Date.now()}`,
    });

    await createPostTrialRegistrationOrder(dietitian.id, user.email ?? '', fee, order.id);

    return successResponse(res, 201, 'Order created', {
      order_id: order.id,
      amount:   fee,
      currency: 'INR',
      key_id:   env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error('Registration fee create-order error:', err);
    return errorResponse(res, 500, 'Failed to create payment order');
  }
};

// POST /api/v1/dietitian/registration-fee/verify-payment
export const verifyRegistrationFeePayment = async (req: Request, res: Response) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body as {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return errorResponse(res, 400, 'razorpay_order_id, razorpay_payment_id and razorpay_signature are required');
  }

  const expectedSignature = crypto
    .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (expectedSignature !== razorpay_signature) {
    await markRegistrationFailed(razorpay_order_id).catch(() => null);
    return errorResponse(res, 400, 'Payment verification failed: invalid signature');
  }

  try {
    const record = await findByOrderId(razorpay_order_id);
    if (!record) return errorResponse(res, 404, 'Order not found');
    if (record.status === 'paid') return errorResponse(res, 409, 'Payment already verified');

    await markRegistrationPaid(record.id, razorpay_payment_id, razorpay_signature);
    await activateDietitianSubscription(record.dietitian_id!);

    // 500 AI diet plan credits on registration fee payment
    void adminCreditPlanCredits(
      record.dietitian_id!,
      500,
      0,
      '500 AI diet plan credits — registration fee payment bonus',
    ).catch((err) => console.error('Registration fee plan credit failed:', err));

    return successResponse(res, 200, 'Payment verified. Full access activated.', {
      dietitian_id:        record.dietitian_id,
      subscription_status: 'active',
    });
  } catch (err) {
    console.error('Registration fee verify-payment error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// POST /api/v1/dietitian/registration-fee/failed
export const markRegistrationFeePaymentFailed = async (req: Request, res: Response) => {
  try {
    const { razorpay_order_id } = req.body as { razorpay_order_id?: string };
    if (!razorpay_order_id) return errorResponse(res, 400, 'razorpay_order_id is required');
    await markRegistrationFailed(razorpay_order_id);
    return successResponse(res, 200, 'Marked as failed');
  } catch (err) {
    console.error('Registration fee mark-failed error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};
