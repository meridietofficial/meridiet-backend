import type { Request, Response } from 'express';
import { findDietitianByUserId } from '../models/Dietitian';
import { getPrimaryAccount } from '../models/DietitianPaymentAccount';
import {
  createWithdrawal,
  markWithdrawalProcessing,
  failWithdrawal,
  getWithdrawalsByDietitian,
  syncProcessingWithdrawals,
} from '../models/DietitianWithdrawal';
import {
  isCashfreeConfigured,
  beneficiaryExists,
  addBeneficiary,
  requestTransfer,
  extractCashfreeError,
} from '../services/cashfree';
import { decrypt } from '../utils/encrypt';
import { successResponse, errorResponse } from '../utils/response';
import { query } from '../config/database';

async function resolveDietitian(req: Request, res: Response) {
  const userId = Number(req.user?.sub);
  const dietitian = await findDietitianByUserId(userId);
  if (!dietitian) { errorResponse(res, 404, 'Dietitian profile not found'); return null; }
  return dietitian;
}

// POST /api/v1/dietitian/withdraw
// Body: { amount: number, account_id?: number }
export const requestWithdrawalHandler = async (req: Request, res: Response) => {
  try {
    if (!isCashfreeConfigured()) {
      return errorResponse(res, 503, 'Payout service is not configured. Please contact support.');
    }

    const dietitian = await resolveDietitian(req, res);
    if (!dietitian) return;

    const { amount, account_id } = req.body as { amount?: number; account_id?: number };

    if (!amount || isNaN(Number(amount))) {
      return errorResponse(res, 400, 'amount is required');
    }
    const amountNum = Number(Number(amount).toFixed(2));
    if (amountNum < 500) {
      return errorResponse(res, 400, 'Minimum withdrawal amount is ₹500');
    }
    if (amountNum > Number(dietitian.earnings_balance)) {
      return errorResponse(res, 400, `Insufficient balance. Available: ₹${dietitian.earnings_balance}`);
    }

    // ── Resolve payment account ──────────────────────────────────────────────
    let account;
    if (account_id) {
      const rows = await query<typeof account>(
        `SELECT * FROM dietitian_payment_accounts WHERE id = ? AND dietitian_id = ? LIMIT 1`,
        [account_id, dietitian.id],
      );
      account = rows[0];
      if (!account) return errorResponse(res, 404, 'Payment account not found');
    } else {
      account = await getPrimaryAccount(dietitian.id);
      if (!account) {
        return errorResponse(res, 400, 'No payment account linked. Please add a bank account or UPI ID first.');
      }
    }

    // ── Resolve user info for beneficiary details ────────────────────────────
    const userRows = await query<{ full_name: string; email: string; phone_number: string | null; phone_code: string | null }>(
      'SELECT full_name, email, phone_number, phone_code FROM users WHERE id = ? LIMIT 1',
      [dietitian.user_id],
    );
    const user = userRows[0];
    const phone = user?.phone_number
      ? `${user.phone_code ?? ''}${user.phone_number}`.replace(/\D/g, '').slice(-10)
      : undefined;

    // ── Validate account details BEFORE deducting balance ────────────────────
    const isUpi = account.type === 'upi';
    const mode  = isUpi ? 'upi' : 'imps';

    let bankAccount: string | undefined;
    if (!isUpi && account.account_number) {
      bankAccount = decrypt(account.account_number as unknown as string);
    }
    if (!isUpi && (!bankAccount || !account.ifsc_code || !account.account_holder)) {
      return errorResponse(res, 400, 'Bank account details incomplete');
    }
    if (isUpi && !account.upi_id) {
      return errorResponse(res, 400, 'UPI ID missing on this account');
    }

    // ── Ensure beneficiary is registered on Cashfree BEFORE deducting balance ─
    const beneId = `D${dietitian.id}A${account.id}`;
    try {
      if (!(await beneficiaryExists(beneId))) {
        await addBeneficiary({
          beneId,
          name:        isUpi ? (user?.full_name ?? `Dietitian ${dietitian.id}`) : account.account_holder!,
          email:       user?.email ?? '',
          phone:       phone ?? '',
          vpa:         isUpi ? account.upi_id! : undefined,
          bankAccount: !isUpi ? bankAccount : undefined,
          ifsc:        !isUpi ? account.ifsc_code! : undefined,
        });
      }
    } catch (beneErr: unknown) {
      const reason = extractCashfreeError(beneErr);
      console.error(`Beneficiary setup failed for ${beneId}:`, reason);
      return errorResponse(res, 502, `Payout setup failed: ${reason}`);
    }

    // ── Deduct balance + create withdrawal record (only if all checks passed) ─
    const withdrawal = await createWithdrawal({
      dietitian_id: dietitian.id,
      account_id:   account.id,
      amount:       amountNum,
    });

    // ── Submit transfer to Cashfree ──────────────────────────────────────────
    try {
      const transfer = await requestTransfer({
        transferId: `WD${withdrawal.id}`,
        amount:     amountNum,
        mode,
        remarks:    'MeriDiet earnings payout',
        beneId,
      });

      await markWithdrawalProcessing(withdrawal.id, transfer.referenceId || transfer.transferId);

      return successResponse(res, 200, 'Withdrawal initiated successfully', {
        withdrawal_id:        withdrawal.id,
        amount:               amountNum,
        status:               'processing',
        cashfree_transfer_id: transfer.referenceId,
        mode,
        account_type:         account.type,
      });
    } catch (transferErr: unknown) {
      const reason = extractCashfreeError(transferErr);
      await failWithdrawal(withdrawal.id, dietitian.id, amountNum, reason);
      console.error(`CRITICAL: Cashfree transfer failed for withdrawal ${withdrawal.id}:`, transferErr);
      return errorResponse(res, 502, `Payout failed: ${reason}`);
    }
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'INSUFFICIENT_BALANCE') return errorResponse(res, 400, 'Insufficient balance');
      if (err.message === 'DIETITIAN_NOT_FOUND')  return errorResponse(res, 404, 'Dietitian not found');
    }
    console.error('requestWithdrawal error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/dietitian/withdrawals/sync
// Checks all processing withdrawals against Cashfree and updates their status in real time.
export const syncWithdrawalsHandler = async (req: Request, res: Response) => {
  try {
    const dietitian = await resolveDietitian(req, res);
    if (!dietitian) return;

    const result = await syncProcessingWithdrawals(dietitian.id);
    return successResponse(res, 200, 'Withdrawals synced', result);
  } catch (err) {
    console.error('syncWithdrawals error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/dietitian/withdrawals?page=1&limit=10
export const listWithdrawalsHandler = async (req: Request, res: Response) => {
  try {
    const dietitian = await resolveDietitian(req, res);
    if (!dietitian) return;

    const page  = Math.max(1, Number(req.query.page)  || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));

    const { withdrawals, total } = await getWithdrawalsByDietitian(dietitian.id, page, limit);

    return successResponse(res, 200, 'Withdrawals fetched', {
      withdrawals,
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('listWithdrawals error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};
