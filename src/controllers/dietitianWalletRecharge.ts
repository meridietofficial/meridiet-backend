import crypto from 'crypto';
import type { Request, Response } from 'express';
import { razorpay } from '../config/razorpay';
import { env } from '../config/env';
import { findDietitianByUserId } from '../models/Dietitian';
import {
  createRechargeOrder,
  findRechargeByOrderId,
  markRechargePaid,
  markRechargeFailed,
} from '../models/DietitianWalletRecharge';
import { creditDietitianWalletRecharge } from '../models/DietitianWallet';
import { successResponse, errorResponse } from '../utils/response';

const MIN_RECHARGE = 100;
const MAX_RECHARGE = 50000;

// POST /api/v1/dietitian/wallet/recharge/create-order
// Body: { amount }  (in ₹, integer)
export const createWalletRechargeOrder = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.sub);
    const { amount } = req.body as { amount?: number };

    if (!amount || !Number.isInteger(Number(amount))) {
      return errorResponse(res, 400, 'amount is required and must be a whole number');
    }

    const amt = Number(amount);
    if (amt < MIN_RECHARGE) return errorResponse(res, 400, `Minimum recharge amount is ₹${MIN_RECHARGE}`);
    if (amt > MAX_RECHARGE) return errorResponse(res, 400, `Maximum recharge amount is ₹${MAX_RECHARGE}`);

    const dietitian = await findDietitianByUserId(userId);
    if (!dietitian) return errorResponse(res, 404, 'Dietitian profile not found');

    const order = await razorpay.orders.create({
      amount: amt * 100, // paise
      currency: 'INR',
      receipt: `dw_recharge_${dietitian.id}_${Date.now()}`,
    });

    await createRechargeOrder(dietitian.id, amt, order.id);

    return successResponse(res, 201, 'Recharge order created', {
      order_id: order.id,
      amount:   amt,
      currency: 'INR',
      key_id:   env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error('Wallet recharge create-order error:', err);
    return errorResponse(res, 500, 'Failed to create recharge order');
  }
};

// POST /api/v1/dietitian/wallet/recharge/verify-payment
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
export const verifyWalletRechargePayment = async (req: Request, res: Response) => {
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
    await markRechargeFailed(razorpay_order_id).catch(() => null);
    return errorResponse(res, 400, 'Payment verification failed: invalid signature');
  }

  try {
    const recharge = await findRechargeByOrderId(razorpay_order_id);
    if (!recharge) return errorResponse(res, 404, 'Recharge order not found');
    if (recharge.status === 'paid') return errorResponse(res, 409, 'Payment already verified');
    if (recharge.status === 'failed') return errorResponse(res, 409, 'This order was marked as failed');

    await markRechargePaid(razorpay_order_id, razorpay_payment_id, razorpay_signature);

    const result = await creditDietitianWalletRecharge(recharge.dietitian_id, recharge.amount, recharge.id);

    if (!result.credited) {
      return errorResponse(res, 409, 'Wallet already credited for this payment');
    }

    return successResponse(res, 200, 'Wallet recharged successfully', {
      amount_added:  recharge.amount,
      new_balance:   result.new_balance,
      transaction_id: result.transaction.id,
    });
  } catch (err) {
    console.error('Wallet recharge verify-payment error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// POST /api/v1/dietitian/wallet/recharge/failed
// Body: { razorpay_order_id }
export const markWalletRechargeFailed = async (req: Request, res: Response) => {
  try {
    const { razorpay_order_id } = req.body as { razorpay_order_id?: string };
    if (!razorpay_order_id) return errorResponse(res, 400, 'razorpay_order_id is required');

    await markRechargeFailed(razorpay_order_id);
    return successResponse(res, 200, 'Recharge marked as failed');
  } catch (err) {
    console.error('Wallet recharge mark-failed error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};
