import type { Request, Response } from 'express';
import { findUserById } from '../models/User';
import { getWalletTransactions } from '../models/Wallet';
import { successResponse, errorResponse } from '../utils/response';

// GET /api/v1/wallet/balance
export const getWalletBalance = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.sub);
    const user = await findUserById(userId);
    if (!user) return errorResponse(res, 404, 'User not found');

    return successResponse(res, 200, 'Wallet balance fetched', {
      wallet_balance: user.wallet_balance,
    });
  } catch (err) {
    console.error('Get wallet balance error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/wallet/transactions?page=1&limit=10
export const getWalletTransactionHistory = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.sub);
    const page  = Math.max(1, Number(req.query.page)  || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));

    const { rows, total } = await getWalletTransactions(userId, page, limit);

    return successResponse(res, 200, 'Wallet transactions fetched', {
      total,
      page,
      limit,
      transactions: rows,
    });
  } catch (err) {
    console.error('Get wallet transactions error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};
