import { Router } from 'express';
import crypto from 'crypto';
import type { Request, Response } from 'express';
import { agoraWebhook } from '../controllers/appointment';
import { updateWithdrawalFromWebhook } from '../models/DietitianWithdrawal';
import type { WithdrawalStatus } from '../models/DietitianWithdrawal';
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
