import { Router } from 'express';
import crypto from 'crypto';
import type { Request, Response } from 'express';
import { agoraWebhook } from '../controllers/appointment';
import { updateWithdrawalFromWebhook } from '../models/DietitianWithdrawal';
import { env } from '../config/env';
import type { WithdrawalStatus } from '../models/DietitianWithdrawal';

export const webhookRouter = Router();

// POST /webhooks/agora — Agora Message Notification Service (no auth)
webhookRouter.post('/agora', agoraWebhook);

// POST /webhooks/razorpayx — Razorpay X payout status updates
webhookRouter.post('/razorpayx', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    const secret    = env.RAZORPAY_X_WEBHOOK_SECRET;

    if (secret) {
      const rawBody: Buffer | undefined = (req as unknown as Record<string, unknown>).rawBody as Buffer | undefined;
      const bodyStr = rawBody ? rawBody.toString('utf8') : JSON.stringify(req.body);
      const expected = crypto
        .createHmac('sha256', secret)
        .update(bodyStr)
        .digest('hex');

      if (signature !== expected) {
        return res.status(400).json({ message: 'Invalid signature' });
      }
    }

    const event   = req.body?.event as string;
    const payout  = req.body?.payload?.payout?.entity;

    if (!payout?.id) return res.json({ status: 'ignored' });

    const STATUS_MAP: Record<string, WithdrawalStatus> = {
      'payout.queued':     'pending',
      'payout.pending':    'pending',
      'payout.initiated':  'processing',
      'payout.processing': 'processing',
      'payout.processed':  'processed',
      'payout.updated':    'processed',
      'payout.failed':     'failed',
      'payout.reversed':   'reversed',
      'payout.rejected':   'cancelled',
      'payout.cancelled':  'cancelled',
    };

    const status = STATUS_MAP[event];
    if (!status) return res.json({ status: 'ignored' });

    const failureReason = payout.status_details?.description ?? payout.error_description ?? undefined;

    await updateWithdrawalFromWebhook(payout.id, status, {
      utr:            payout.utr ?? undefined,
      failure_reason: failureReason,
    });

    console.log(`Razorpay X webhook: ${event} → payout ${payout.id} → ${status}`);
    return res.json({ status: 'ok' });
  } catch (err) {
    console.error('razorpayx webhook error:', err);
    return res.status(500).json({ message: 'Webhook processing failed' });
  }
});
