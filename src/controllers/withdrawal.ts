import type { Request, Response } from 'express';
import { findDietitianByUserId } from '../models/Dietitian';
import { getPrimaryAccount } from '../models/DietitianPaymentAccount';
import {
  createWithdrawal,
  markWithdrawalProcessing,
  failWithdrawal,
  getWithdrawalsByDietitian,
  cacheRazorpayIds,
} from '../models/DietitianWithdrawal';
import {
  createContact,
  createBankFundAccount,
  createUpiFundAccount,
  createPayout,
  isRazorpayXConfigured,
} from '../services/razorpayX';
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
// If account_id omitted, uses the primary account.
export const requestWithdrawalHandler = async (req: Request, res: Response) => {
  try {
    if (!isRazorpayXConfigured()) {
      return errorResponse(res, 503, 'Payout service is not configured. Please contact support.');
    }

    const dietitian = await resolveDietitian(req, res);
    if (!dietitian) return;

    const { amount, account_id } = req.body as { amount?: number; account_id?: number };

    // ── Validate amount ──────────────────────────────────────────────────────
    if (!amount || isNaN(Number(amount))) {
      return errorResponse(res, 400, 'amount is required');
    }
    const amountNum = Number(Number(amount).toFixed(2));
    if (amountNum < 1) {
      return errorResponse(res, 400, 'Minimum withdrawal amount is ₹1');
    }
    if (amountNum > Number(dietitian.earnings_balance)) {
      return errorResponse(
        res,
        400,
        `Insufficient balance. Available: ₹${dietitian.earnings_balance}`,
      );
    }

    // ── Resolve payment account ──────────────────────────────────────────────
    let account;
    if (account_id) {
      const rows = await query<typeof account>(
        `SELECT * FROM dietitian_payment_accounts
         WHERE id = ? AND dietitian_id = ? LIMIT 1`,
        [account_id, dietitian.id],
      );
      account = rows[0];
      if (!account) return errorResponse(res, 404, 'Payment account not found');
    } else {
      account = await getPrimaryAccount(dietitian.id);
      if (!account) {
        return errorResponse(
          res,
          400,
          'No payment account linked. Please add a bank account or UPI ID first.',
        );
      }
    }

    // ── Get or create Razorpay contact ───────────────────────────────────────
    let contactId: string = account.razorpay_contact_id ?? '';
    let fundAccountId: string = account.razorpay_fund_account_id ?? '';

    if (!contactId) {
      // Fetch dietitian's user details for name/email/phone
      const userRows = await query<{ full_name: string; email: string; phone_number: string | null; phone_code: string | null }>(
        'SELECT full_name, email, phone_number, phone_code FROM users WHERE id = ? LIMIT 1',
        [dietitian.user_id],
      );
      const user = userRows[0];
      const phone = user?.phone_number
        ? `${user.phone_code ?? ''}${user.phone_number}`.trim()
        : undefined;

      const contact = await createContact({
        name:         user?.full_name ?? `Dietitian ${dietitian.id}`,
        email:        user?.email,
        contact:      phone,
        reference_id: `dietitian_${dietitian.id}`,
      });
      contactId = contact.id;
    }

    // ── Get or create Razorpay fund account ──────────────────────────────────
    if (!fundAccountId) {
      if (account.type === 'bank') {
        if (!account.account_number || !account.ifsc_code || !account.account_holder) {
          return errorResponse(res, 400, 'Bank account details incomplete');
        }
        const plainAccNo = decrypt(account.account_number as unknown as string);
        const fa = await createBankFundAccount({
          contact_id:     contactId,
          account_holder: account.account_holder,
          account_number: plainAccNo,
          ifsc:           account.ifsc_code,
        });
        fundAccountId = fa.id;
      } else {
        if (!account.upi_id) {
          return errorResponse(res, 400, 'UPI ID missing on this account');
        }
        const fa = await createUpiFundAccount({
          contact_id: contactId,
          vpa:        account.upi_id,
        });
        fundAccountId = fa.id;
      }

      // Cache for next time so we don't re-create
      await cacheRazorpayIds(account.id, contactId, fundAccountId);
    }

    // ── Deduct balance + create withdrawal record (atomic) ───────────────────
    const withdrawal = await createWithdrawal({
      dietitian_id:             dietitian.id,
      account_id:               account.id,
      amount:                   amountNum,
      razorpay_contact_id:      contactId,
      razorpay_fund_account_id: fundAccountId,
    });

    // ── Submit payout to Razorpay X ──────────────────────────────────────────
    const mode = account.type === 'upi' ? 'UPI' : 'IMPS';

    try {
      const payout = await createPayout({
        fund_account_id: fundAccountId,
        amount_inr:      amountNum,
        mode,
        narration:       'MeriDiet earnings payout',
        reference_id:    `withdrawal_${withdrawal.id}`,
      });

      await markWithdrawalProcessing(withdrawal.id, payout.id);

      return successResponse(res, 200, 'Withdrawal initiated successfully', {
        withdrawal_id:     withdrawal.id,
        amount:            amountNum,
        status:            'processing',
        razorpay_payout_id: payout.id,
        mode,
        account_type:      account.type,
      });
    } catch (payoutErr: unknown) {
      // Payout submission failed — refund the deducted balance
      const reason =
        (payoutErr as { response?: { data?: { error?: { description?: string } } } })
          ?.response?.data?.error?.description ?? 'Payout creation failed';

      await failWithdrawal(withdrawal.id, dietitian.id, amountNum, reason);

      console.error(`CRITICAL: Payout failed for withdrawal ${withdrawal.id}:`, payoutErr);
      return errorResponse(res, 502, `Payout failed: ${reason}`);
    }
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === 'INSUFFICIENT_BALANCE') {
        return errorResponse(res, 400, 'Insufficient balance');
      }
      if (err.message === 'DIETITIAN_NOT_FOUND') {
        return errorResponse(res, 404, 'Dietitian not found');
      }
    }
    console.error('requestWithdrawal error:', err);
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
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('listWithdrawals error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};
