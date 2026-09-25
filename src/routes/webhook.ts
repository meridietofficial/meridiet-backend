import { Router } from 'express';
import crypto from 'crypto';
import type { Request, Response } from 'express';
import { agoraWebhook } from '../controllers/appointment';
import { updateWithdrawalFromWebhook } from '../models/DietitianWithdrawal';
import type { WithdrawalStatus } from '../models/DietitianWithdrawal';
import { findByOrderId, markRegistrationPaid } from '../models/DietitianRegistrationPayment';
import { activateDietitianSubscription } from '../models/Dietitian';
import { creditRegistrationBonus } from '../models/DietitianWallet';
import { env } from '../config/env';

export const webhookRouter = Router();

// POST /webhooks/agora — Agora Message Notification Service (no auth)
webhookRouter.post('/agora', agoraWebhook);

// POST /webhooks/cashfree — Cashfree Payouts transfer status updates
webhookRouter.post('/cashfree', async (req: Request, res: Response) => {
  try {
    // Signature verification (optional but recommended)
    const secret = env.CASHFREE_WEBHOOK_SECRET;
    if (secret) {
      const rawBody: Buffer | undefined = (req as unknown as Record<string, unknown>).rawBody as Buffer | undefined;
      const bodyStr = rawBody ? rawBody.toString('utf8') : JSON.stringify(req.body);
      const signature = req.headers['x-webhook-signature'] as string;
      const expected  = crypto.createHmac('sha256', secret).update(bodyStr).digest('base64');
      if (signature && signature !== expected) {
        return res.status(400).json({ message: 'Invalid signature' });
      }
    }

    const type     = req.body?.type as string;
    const transfer = req.body?.data?.transfer ?? req.body?.transfer;

    // v2 uses snake_case (transfer_id), v1.2 used camelCase (transferId)
    const transferId = transfer?.transfer_id ?? transfer?.transferId;
    if (!transferId) return res.json({ status: 'ignored' });

    const STATUS_MAP: Record<string, WithdrawalStatus> = {
      'TRANSFER_SUCCESS':  'processed',
      'TRANSFER_FAILED':   'failed',
      'TRANSFER_REVERSED': 'reversed',
      'TRANSFER_REJECTED': 'cancelled',
    };

    const status = STATUS_MAP[type];
    if (!status) return res.json({ status: 'ignored' });

    await updateWithdrawalFromWebhook(transferId, status, {
      utr:            transfer.utr                                        ?? undefined,
      failure_reason: transfer.status_description ?? transfer.statusDescription ?? transfer.reason ?? undefined,
    });

    console.log(`Cashfree webhook: ${type} → transfer ${transferId} → ${status}`);
    return res.json({ status: 'ok' });
  } catch (err) {
    console.error('cashfree webhook error:', err);
    return res.status(500).json({ message: 'Webhook processing failed' });
  }
});

// POST /webhooks/razorpay — Razorpay payment events (payment.captured)
// Handles the case where the frontend drops off after payment but before
// calling /verify-payment — ensures dietitian is always activated.
webhookRouter.post('/razorpay', async (req: Request, res: Response) => {
  try {
    // Signature verification
    const secret = env.RAZORPAY_WEBHOOK_SECRET;
    if (secret) {
      const rawBody = (req as unknown as Record<string, unknown>).rawBody as Buffer | undefined;
      const bodyStr = rawBody ? rawBody.toString('utf8') : JSON.stringify(req.body);
      const signature = req.headers['x-razorpay-signature'] as string;
      const expected  = crypto.createHmac('sha256', secret).update(bodyStr).digest('hex');
      if (!signature || signature !== expected) {
        console.warn('Razorpay webhook: invalid signature');
        return res.status(400).json({ message: 'Invalid signature' });
      }
    }

    const event     = req.body?.event as string;
    const payment   = req.body?.payload?.payment?.entity;

    // Only handle captured payments
    if (event !== 'payment.captured' || !payment) {
      return res.json({ status: 'ignored' });
    }

    const orderId   = payment.order_id as string;
    const paymentId = payment.id as string;

    if (!orderId || !paymentId) return res.json({ status: 'ignored' });

    // Find the registration payment record
    const record = await findByOrderId(orderId);
    if (!record) {
      console.log(`Razorpay webhook: no registration record for order ${orderId} — ignoring`);
      return res.json({ status: 'ignored' });
    }

    // Already paid — idempotent
    if (record.status === 'paid') {
      console.log(`Razorpay webhook: order ${orderId} already paid — skipping`);
      return res.json({ status: 'already_paid' });
    }

    // Mark payment as paid (use empty string for signature — webhook has no frontend sig)
    await markRegistrationPaid(record.id, paymentId, '');

    // Activate subscription (safe even if already active)
    if (record.dietitian_id) {
      await activateDietitianSubscription(record.dietitian_id);

      // Credit 500 AI plan credits — idempotent via fixed reference_id
      void creditRegistrationBonus(record.dietitian_id)
        .catch((err) => console.error('Razorpay webhook: plan credit failed:', err));
    }

    console.log(`Razorpay webhook: payment.captured → order ${orderId} → dietitian ${record.dietitian_id} activated`);
    return res.json({ status: 'ok' });
  } catch (err) {
    console.error('Razorpay webhook error:', err);
    return res.status(500).json({ message: 'Webhook processing failed' });
  }
});
