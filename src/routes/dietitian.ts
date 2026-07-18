import { Router } from 'express';
import { getDietitianProfile, getDietitianById, updateDietitianProfile, changeDietitianPassword, updateOnlineStatus, deleteMyAccount } from '../controllers/dietitian';
import { sendRegistrationOtp, verifyRegistrationOtp, createRegistrationOrder, verifyRegistrationPayment, markRegistrationPaymentFailed } from '../controllers/dietitianRegistration';
import {
  saveDraft,
  saveManualDraft,
  updateDraft,
  generateFromDraft,
  editGeneratedPlan,
  sendDietitianPlan,
  archivePlan,
  listDietitianPlans,
  listManualDietitianPlans,
  getDietitianPlan,
} from '../controllers/dietitianDietPlan';
import {
  getEarningsSummaryHandler,
  getMonthlyRevenueHandler,
  getEarningsByPlanHandler,
  getPayoutInfoHandler,
  getEarningsTransactionsHandler,
  getWalletTransactionsHandler,
  getWalletOverviewHandler,
} from '../controllers/earnings';
import {
  listAccountsHandler,
  addAccountHandler,
  setPrimaryAccountHandler,
  deleteAccountHandler,
} from '../controllers/paymentAccounts';
import {
  requestWithdrawalHandler,
  listWithdrawalsHandler,
} from '../controllers/withdrawal';
import { authenticate, authorize } from '../middlewares/authenticate';

export const dietitianRouter = Router();

// Registration with payment — ₹2499 one-time fee
dietitianRouter.post('/register/send-otp',        sendRegistrationOtp);
dietitianRouter.post('/register/verify-otp',      verifyRegistrationOtp);
dietitianRouter.post('/register/create-order',    createRegistrationOrder);
dietitianRouter.post('/register/verify-payment',  verifyRegistrationPayment);
dietitianRouter.post('/register/failed',          markRegistrationPaymentFailed);

// GET  /api/v1/dietitian/profile  — logged-in dietitian's own profile
dietitianRouter.get('/profile', authenticate, authorize('dietitian'), getDietitianProfile);

// PUT  /api/v1/dietitian/profile  — update logged-in dietitian's profile
dietitianRouter.put('/profile', authenticate, authorize('dietitian'), updateDietitianProfile);

// PUT  /api/v1/dietitian/change-password
dietitianRouter.put('/change-password', authenticate, authorize('dietitian'), changeDietitianPassword);

// PATCH /api/v1/dietitian/online-status
dietitianRouter.patch('/online-status', authenticate, authorize('dietitian'), updateOnlineStatus);

// DELETE /api/v1/dietitian/account
dietitianRouter.delete('/account', authenticate, authorize('dietitian'), deleteMyAccount);

// ── Diet Form Management (dietitian only) ─────────────────────────────────────

// POST /api/v1/dietitian/diet-plans/manual   — create manual plan for any client (no appointment)
dietitianRouter.post('/diet-plans/manual', authenticate, authorize('dietitian'), saveManualDraft);

// GET  /api/v1/dietitian/diet-plans/manual   — list all manual diet plans
dietitianRouter.get('/diet-plans/manual', authenticate, authorize('dietitian'), listManualDietitianPlans);

// POST /api/v1/dietitian/diet-forms          — fill form & save as draft (appointment-linked)
dietitianRouter.post('/diet-forms', authenticate, authorize('dietitian'), saveDraft);

// GET  /api/v1/dietitian/diet-forms          — list all diet forms (filter by status)
dietitianRouter.get('/diet-forms', authenticate, authorize('dietitian'), listDietitianPlans);

// GET  /api/v1/dietitian/diet-forms/:id      — get single diet form + plan data
dietitianRouter.get('/diet-forms/:id', authenticate, authorize('dietitian'), getDietitianPlan);

// PUT  /api/v1/dietitian/diet-forms/:id      — update draft form fields
dietitianRouter.put('/diet-forms/:id', authenticate, authorize('dietitian'), updateDraft);

// POST /api/v1/dietitian/diet-forms/:id/generate — trigger AI generation on a draft
dietitianRouter.post('/diet-forms/:id/generate', authenticate, authorize('dietitian'), generateFromDraft);

// PUT  /api/v1/dietitian/diet-forms/:id/content  — edit AI-generated content before sending
dietitianRouter.put('/diet-forms/:id/content', authenticate, authorize('dietitian'), editGeneratedPlan);

// POST /api/v1/dietitian/diet-forms/:id/send     — send completed plan to patient
dietitianRouter.post('/diet-forms/:id/send', authenticate, authorize('dietitian'), sendDietitianPlan);

// PUT  /api/v1/dietitian/diet-forms/:id/archive  — archive
dietitianRouter.put('/diet-forms/:id/archive', authenticate, authorize('dietitian'), archivePlan);

// ── Earnings (dietitian only) ──────────────────────────────────────────────────

// GET /api/v1/dietitian/earnings/wallet
dietitianRouter.get('/earnings/wallet', authenticate, authorize('dietitian'), getWalletOverviewHandler);

// GET /api/v1/dietitian/earnings/summary?period=week|month|quarter|year
dietitianRouter.get('/earnings/summary', authenticate, authorize('dietitian'), getEarningsSummaryHandler);

// GET /api/v1/dietitian/earnings/monthly-revenue?months=6
dietitianRouter.get('/earnings/monthly-revenue', authenticate, authorize('dietitian'), getMonthlyRevenueHandler);

// GET /api/v1/dietitian/earnings/by-plan
dietitianRouter.get('/earnings/by-plan', authenticate, authorize('dietitian'), getEarningsByPlanHandler);

// GET /api/v1/dietitian/earnings/payout
dietitianRouter.get('/earnings/payout', authenticate, authorize('dietitian'), getPayoutInfoHandler);

// GET /api/v1/dietitian/earnings/wallet-transactions?page=1&limit=10
dietitianRouter.get('/earnings/wallet-transactions', authenticate, authorize('dietitian'), getWalletTransactionsHandler);

// GET /api/v1/dietitian/earnings/transactions?status=all|paid|pending|refunded&search=&page=1&limit=10
dietitianRouter.get('/earnings/transactions', authenticate, authorize('dietitian'), getEarningsTransactionsHandler);

// ── Payment Accounts (dietitian only) ─────────────────────────────────────────

// GET    /api/v1/dietitian/accounts
dietitianRouter.get('/accounts', authenticate, authorize('dietitian'), listAccountsHandler);

// POST   /api/v1/dietitian/accounts
dietitianRouter.post('/accounts', authenticate, authorize('dietitian'), addAccountHandler);

// PATCH  /api/v1/dietitian/accounts/:id/set-primary
dietitianRouter.patch('/accounts/:id/set-primary', authenticate, authorize('dietitian'), setPrimaryAccountHandler);

// DELETE /api/v1/dietitian/accounts/:id
dietitianRouter.delete('/accounts/:id', authenticate, authorize('dietitian'), deleteAccountHandler);

// ── Withdrawals (dietitian only) ──────────────────────────────────────────────

// POST /api/v1/dietitian/withdraw
dietitianRouter.post('/withdraw', authenticate, authorize('dietitian'), requestWithdrawalHandler);

// GET  /api/v1/dietitian/withdrawals?page=1&limit=10
dietitianRouter.get('/withdrawals', authenticate, authorize('dietitian'), listWithdrawalsHandler);

// GET /api/v1/dietitian/:id  — any dietitian by ID (authenticated users)
dietitianRouter.get('/:id', authenticate, getDietitianById);
