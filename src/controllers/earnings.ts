import type { Request, Response } from 'express';
import { findDietitianByUserId } from '../models/Dietitian';
import {
  getEarningsSummary,
  getMonthlyRevenue,
  getEarningsByPlan,
  getPayoutInfo,
  getEarningsTransactions,
  getWalletOverview,
  EarningsPeriod,
  TransactionStatus,
} from '../models/Earnings';
import { getDietitianWalletTransactions } from '../models/DietitianWallet';
import { successResponse, errorResponse } from '../utils/response';

const VALID_PERIODS: EarningsPeriod[] = ['week', 'month', 'quarter', 'year'];
const VALID_TX_STATUSES: TransactionStatus[] = ['all', 'paid', 'pending', 'refunded'];

async function resolveDietitianId(req: Request, res: Response): Promise<number | null> {
  const userId = Number(req.user?.sub);
  const dietitian = await findDietitianByUserId(userId);
  if (!dietitian) {
    errorResponse(res, 404, 'Dietitian profile not found');
    return null;
  }
  return dietitian.id;
}

// GET /api/v1/dietitian/earnings/summary?period=week|month|quarter|year
export const getEarningsSummaryHandler = async (req: Request, res: Response) => {
  try {
    const periodParam = String(req.query.period ?? 'month');
    const period: EarningsPeriod = VALID_PERIODS.includes(periodParam as EarningsPeriod)
      ? (periodParam as EarningsPeriod)
      : 'month';

    const dietitianId = await resolveDietitianId(req, res);
    if (!dietitianId) return;

    const summary = await getEarningsSummary(dietitianId, period);
    return successResponse(res, 200, 'Earnings summary fetched', summary);
  } catch (err) {
    console.error('getEarningsSummary error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/dietitian/earnings/monthly-revenue?months=6
export const getMonthlyRevenueHandler = async (req: Request, res: Response) => {
  try {
    const months = Math.min(Math.max(Number(req.query.months) || 6, 1), 24);

    const dietitianId = await resolveDietitianId(req, res);
    if (!dietitianId) return;

    const data = await getMonthlyRevenue(dietitianId, months);
    return successResponse(res, 200, 'Monthly revenue fetched', data);
  } catch (err) {
    console.error('getMonthlyRevenue error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/dietitian/earnings/by-plan
export const getEarningsByPlanHandler = async (req: Request, res: Response) => {
  try {
    const dietitianId = await resolveDietitianId(req, res);
    if (!dietitianId) return;

    const data = await getEarningsByPlan(dietitianId);
    return successResponse(res, 200, 'Earnings by plan fetched', data);
  } catch (err) {
    console.error('getEarningsByPlan error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/dietitian/earnings/payout
export const getPayoutInfoHandler = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.sub);
    const dietitian = await findDietitianByUserId(userId);
    if (!dietitian) return errorResponse(res, 404, 'Dietitian profile not found');

    // payout_upi may not exist on older records — safe access
    const payoutUpi = (dietitian as unknown as Record<string, unknown>).payout_upi as string | null ?? null;

    const payout = await getPayoutInfo(dietitian.id, payoutUpi);
    return successResponse(res, 200, 'Payout info fetched', payout);
  } catch (err) {
    console.error('getPayoutInfo error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/dietitian/earnings/wallet
export const getWalletOverviewHandler = async (req: Request, res: Response) => {
  try {
    const dietitianId = await resolveDietitianId(req, res);
    if (!dietitianId) return;

    const overview = await getWalletOverview(dietitianId);
    return successResponse(res, 200, 'Wallet overview fetched', overview);
  } catch (err) {
    console.error('getWalletOverview error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/dietitian/earnings/wallet-transactions?page=1&limit=10
export const getWalletTransactionsHandler = async (req: Request, res: Response) => {
  try {
    const page  = Math.max(Number(req.query.page)  || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 10, 50);

    const dietitianId = await resolveDietitianId(req, res);
    if (!dietitianId) return;

    const result = await getDietitianWalletTransactions(dietitianId, page, limit);

    return successResponse(res, 200, 'Wallet transactions fetched', result, {
      page,
      limit,
      total: result.total,
      totalPages: Math.ceil(result.total / limit),
    });
  } catch (err) {
    console.error('getWalletTransactions error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/dietitian/earnings/transactions?status=all|paid|pending|refunded&search=&page=1&limit=10
export const getEarningsTransactionsHandler = async (req: Request, res: Response) => {
  try {
    const statusParam = String(req.query.status ?? 'all');
    const status: TransactionStatus = VALID_TX_STATUSES.includes(statusParam as TransactionStatus)
      ? (statusParam as TransactionStatus)
      : 'all';
    const search = req.query.search ? String(req.query.search).trim() : undefined;
    const page   = Math.max(Number(req.query.page)  || 1, 1);
    const limit  = Math.min(Number(req.query.limit) || 10, 50);

    const dietitianId = await resolveDietitianId(req, res);
    if (!dietitianId) return;

    const result = await getEarningsTransactions(dietitianId, status, search || undefined, page, limit);

    return successResponse(res, 200, 'Transactions fetched', result, {
      page,
      limit,
      total: result.total,
      totalPages: Math.ceil(result.total / limit),
    });
  } catch (err) {
    console.error('getEarningsTransactions error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};
