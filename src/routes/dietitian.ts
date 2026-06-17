import { Router } from 'express';
import { registerDietitian, getDietitianProfile, getDietitianById, updateDietitianProfile, changeDietitianPassword, updateOnlineStatus } from '../controllers/dietitian';
import {
  saveDraft,
  updateDraft,
  generateFromDraft,
  archivePlan,
  listDietitianPlans,
  getDietitianPlan,
} from '../controllers/dietitianDietPlan';
import {
  getEarningsSummaryHandler,
  getMonthlyRevenueHandler,
  getEarningsByPlanHandler,
  getPayoutInfoHandler,
  getEarningsTransactionsHandler,
} from '../controllers/earnings';
import { authenticate, authorize } from '../middlewares/authenticate';

export const dietitianRouter = Router();

dietitianRouter.post('/register', registerDietitian);

// GET  /api/v1/dietitian/profile  — logged-in dietitian's own profile
dietitianRouter.get('/profile', authenticate, authorize('dietitian'), getDietitianProfile);

// PUT  /api/v1/dietitian/profile  — update logged-in dietitian's profile
dietitianRouter.put('/profile', authenticate, authorize('dietitian'), updateDietitianProfile);

// PUT  /api/v1/dietitian/change-password
dietitianRouter.put('/change-password', authenticate, authorize('dietitian'), changeDietitianPassword);

// PATCH /api/v1/dietitian/online-status
dietitianRouter.patch('/online-status', authenticate, authorize('dietitian'), updateOnlineStatus);

// ── Diet Plan Management (dietitian only) ─────────────────────────────────────

// POST /api/v1/dietitian/diet-plans          — fill form & save as draft
dietitianRouter.post('/diet-plans', authenticate, authorize('dietitian'), saveDraft);

// GET  /api/v1/dietitian/diet-plans          — list all plans (filter by status)
dietitianRouter.get('/diet-plans', authenticate, authorize('dietitian'), listDietitianPlans);

// GET  /api/v1/dietitian/diet-plans/:id      — get single plan
dietitianRouter.get('/diet-plans/:id', authenticate, authorize('dietitian'), getDietitianPlan);

// PUT  /api/v1/dietitian/diet-plans/:id      — update draft form fields
dietitianRouter.put('/diet-plans/:id', authenticate, authorize('dietitian'), updateDraft);

// POST /api/v1/dietitian/diet-plans/:id/generate — trigger AI generation on a draft
dietitianRouter.post('/diet-plans/:id/generate', authenticate, authorize('dietitian'), generateFromDraft);

// PUT  /api/v1/dietitian/diet-plans/:id/archive  — archive a plan
dietitianRouter.put('/diet-plans/:id/archive', authenticate, authorize('dietitian'), archivePlan);

// ── Earnings (dietitian only) ──────────────────────────────────────────────────

// GET /api/v1/dietitian/earnings/summary?period=week|month|quarter|year
dietitianRouter.get('/earnings/summary', authenticate, authorize('dietitian'), getEarningsSummaryHandler);

// GET /api/v1/dietitian/earnings/monthly-revenue?months=6
dietitianRouter.get('/earnings/monthly-revenue', authenticate, authorize('dietitian'), getMonthlyRevenueHandler);

// GET /api/v1/dietitian/earnings/by-plan
dietitianRouter.get('/earnings/by-plan', authenticate, authorize('dietitian'), getEarningsByPlanHandler);

// GET /api/v1/dietitian/earnings/payout
dietitianRouter.get('/earnings/payout', authenticate, authorize('dietitian'), getPayoutInfoHandler);

// GET /api/v1/dietitian/earnings/transactions?status=all|paid|pending|refunded&search=&page=1&limit=10
dietitianRouter.get('/earnings/transactions', authenticate, authorize('dietitian'), getEarningsTransactionsHandler);

// GET /api/v1/dietitian/:id  — any dietitian by ID (authenticated users)
dietitianRouter.get('/:id', authenticate, getDietitianById);
