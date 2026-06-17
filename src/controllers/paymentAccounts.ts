import type { Request, Response } from 'express';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ifsc = require('ifsc') as { validate: (code: string) => boolean };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const banknames: Record<string, string> = require('ifsc/src/banknames.json');

import { findDietitianByUserId } from '../models/Dietitian';
import {
  getAccountsByDietitianId,
  addUpiAccount,
  addBankAccount,
  setPrimaryAccount,
  deleteAccount,
} from '../models/DietitianPaymentAccount';
import { successResponse, errorResponse } from '../utils/response';

async function resolveDietitianId(req: Request, res: Response): Promise<number | null> {
  const userId = Number(req.user?.sub);
  const dietitian = await findDietitianByUserId(userId);
  if (!dietitian) {
    errorResponse(res, 404, 'Dietitian profile not found');
    return null;
  }
  return dietitian.id;
}

// GET /api/v1/dietitian/accounts
export const listAccountsHandler = async (req: Request, res: Response) => {
  try {
    const dietitianId = await resolveDietitianId(req, res);
    if (!dietitianId) return;

    const accounts = await getAccountsByDietitianId(dietitianId);
    return successResponse(res, 200, 'Payment accounts fetched', { accounts });
  } catch (err) {
    console.error('listAccounts error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// POST /api/v1/dietitian/accounts
// Body (UPI):  { type: 'upi',  upi_id, set_primary? }
// Body (Bank): { type: 'bank', account_holder, account_number, ifsc_code, bank_name, set_primary? }
export const addAccountHandler = async (req: Request, res: Response) => {
  try {
    const dietitianId = await resolveDietitianId(req, res);
    if (!dietitianId) return;

    const { type, set_primary } = req.body as { type?: string; set_primary?: boolean };

    if (!type || !['upi', 'bank'].includes(type)) {
      return errorResponse(res, 400, 'type must be "upi" or "bank"');
    }

    // ── UPI ────────────────────────────────────────────────────────────────────
    if (type === 'upi') {
      const { upi_id } = req.body as { upi_id?: string };
      if (!upi_id || !upi_id.trim()) return errorResponse(res, 400, 'upi_id is required');

      const vpa = upi_id.trim().toLowerCase();

      // Format: localpart@handle
      // localpart: letters, digits, dots, hyphens, underscores (min 3 chars)
      // handle:    letters and digits only (min 2 chars)
      if (!/^[\w.\-]{3,}@[a-z0-9]{2,}$/.test(vpa)) {
        return errorResponse(
          res,
          400,
          'Invalid UPI ID format. Expected format: yourname@bankhandle (e.g. manish@okhdfc)',
        );
      }

      const account = await addUpiAccount({
        dietitian_id: dietitianId,
        upi_id: vpa,
        set_primary: Boolean(set_primary),
      });

      return successResponse(res, 201, 'UPI account added', {
        ...account,
        // UPI IDs cannot be verified in real-time without Razorpay X.
        // Frontend should show this note so the dietitian double-checks.
        upi_verified: false,
        upi_verified_note: 'Please ensure this UPI ID is correct. We cannot verify it in real-time.',
      });
    }

    // ── Bank account ───────────────────────────────────────────────────────────
    const { account_holder, account_number, ifsc_code, bank_name } = req.body as {
      account_holder?: string;
      account_number?: string;
      ifsc_code?: string;
      bank_name?: string;
    };

    if (!account_holder?.trim()) return errorResponse(res, 400, 'account_holder is required');
    if (!account_number?.trim()) return errorResponse(res, 400, 'account_number is required');
    if (!ifsc_code?.trim())      return errorResponse(res, 400, 'ifsc_code is required');
    if (!bank_name?.trim())      return errorResponse(res, 400, 'bank_name is required');

    const normalizedIfsc = ifsc_code.trim().toUpperCase();

    // Step 1 — IFSC format check (4 letters + 0 + 6 alphanumeric)
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(normalizedIfsc)) {
      return errorResponse(res, 400, 'Invalid IFSC code format (e.g. HDFC0001234)');
    }

    // Step 2 — IFSC existence check against offline database (160,000+ real codes)
    if (!ifsc.validate(normalizedIfsc)) {
      return errorResponse(
        res,
        400,
        `IFSC code ${normalizedIfsc} does not exist. Please check and re-enter.`,
      );
    }

    // Step 3 — Resolve the real bank name from the IFSC prefix
    const ifscPrefix = normalizedIfsc.slice(0, 4);
    const verifiedBankName = banknames[ifscPrefix] ?? bank_name.trim();

    // Step 4 — Basic account number sanity check (9–18 digits, no letters)
    const accNo = account_number.trim().replace(/\s/g, '');
    if (!/^\d{9,18}$/.test(accNo)) {
      return errorResponse(
        res,
        400,
        'Account number must be 9–18 digits with no spaces or letters',
      );
    }

    const account = await addBankAccount({
      dietitian_id:   dietitianId,
      account_holder: account_holder.trim(),
      account_number: accNo,
      ifsc_code:      normalizedIfsc,
      bank_name:      verifiedBankName,
      set_primary:    Boolean(set_primary),
    });

    return successResponse(res, 201, 'Bank account added', {
      ...account,
      // Confirmed the IFSC exists in the RBI database.
      // Full penny-drop verification will happen at payout time via Razorpay X.
      ifsc_verified: true,
      verified_bank_name: verifiedBankName,
    });
  } catch (err) {
    console.error('addAccount error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// PATCH /api/v1/dietitian/accounts/:id/set-primary
export const setPrimaryAccountHandler = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid account ID');

    const dietitianId = await resolveDietitianId(req, res);
    if (!dietitianId) return;

    const account = await setPrimaryAccount(id, dietitianId);
    if (!account) return errorResponse(res, 404, 'Account not found');

    return successResponse(res, 200, 'Primary account updated', account);
  } catch (err) {
    console.error('setPrimaryAccount error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// DELETE /api/v1/dietitian/accounts/:id
export const deleteAccountHandler = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid account ID');

    const dietitianId = await resolveDietitianId(req, res);
    if (!dietitianId) return;

    const result = await deleteAccount(id, dietitianId);

    if (!result.deleted) {
      if (result.reason === 'not_found') {
        return errorResponse(res, 404, 'Account not found');
      }
      if (result.reason === 'primary_account') {
        return errorResponse(
          res,
          400,
          'Cannot delete the primary account. Set another account as primary first.',
        );
      }
    }

    return successResponse(res, 200, 'Account removed');
  } catch (err) {
    console.error('deleteAccount error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};
