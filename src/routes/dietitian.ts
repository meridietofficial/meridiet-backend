import { Router } from 'express';
import { getDietitianProfile, getDietitianById, updateDietitianProfile, changeDietitianPassword, updateOnlineStatus, updateSyncOfflineSlots, deleteMyAccount } from '../controllers/dietitian';
import { sendRegistrationOtp, verifyRegistrationOtp, registerDietitian } from '../controllers/dietitianRegistration';
import {
  createRegistrationFeeOrder,
  verifyRegistrationFeePayment,
  markRegistrationFeePaymentFailed,
} from '../controllers/dietitianRegistrationFee';
import {
  saveDraft,
  saveManualDraft,
  updateDraft,
  generateFromDraft,
  editGeneratedPlan,
  sendDietitianPlan,
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
import {
  createWalletRechargeOrder,
  verifyWalletRechargePayment,
  markWalletRechargeFailed,
} from '../controllers/dietitianWalletRecharge';
import { authenticate, authorize } from '../middlewares/authenticate';
import { requireActiveAccess } from '../middlewares/requireActiveAccess';

export const dietitianRouter = Router();

// ── Registration (public, no payment) ─────────────────────────────────────────
dietitianRouter.post('/register/send-otp',  sendRegistrationOtp);
dietitianRouter.post('/register/verify-otp', verifyRegistrationOtp);
dietitianRouter.post('/register',            registerDietitian);

// ── Registration fee payment (after trial expires) ────────────────────────────
// No requireActiveAccess here — expired dietitians must be able to pay
dietitianRouter.post('/registration-fee/create-order',   authenticate, authorize('dietitian'), createRegistrationFeeOrder);
dietitianRouter.post('/registration-fee/verify-payment', authenticate, authorize('dietitian'), verifyRegistrationFeePayment);
dietitianRouter.post('/registration-fee/failed',         authenticate, authorize('dietitian'), markRegistrationFeePaymentFailed);

// ── Profile (accessible regardless of trial/access status) ────────────────────
dietitianRouter.get('/profile',         authenticate, authorize('dietitian'), getDietitianProfile);
dietitianRouter.put('/profile',         authenticate, authorize('dietitian'), updateDietitianProfile);
dietitianRouter.put('/change-password', authenticate, authorize('dietitian'), changeDietitianPassword);
dietitianRouter.delete('/account',      authenticate, authorize('dietitian'), deleteMyAccount);

// ── Online status & slots (requires active access) ────────────────────────────
dietitianRouter.patch('/online-status',     authenticate, authorize('dietitian'), requireActiveAccess, updateOnlineStatus);
dietitianRouter.patch('/sync-offline-slots', authenticate, authorize('dietitian'), requireActiveAccess, updateSyncOfflineSlots);

// ── Diet Form Management (requires active access) ─────────────────────────────
dietitianRouter.post('/diet-plans/manual', authenticate, authorize('dietitian'), requireActiveAccess, saveManualDraft);
dietitianRouter.get('/diet-plans/manual',  authenticate, authorize('dietitian'), requireActiveAccess, listManualDietitianPlans);

dietitianRouter.post('/diet-forms',               authenticate, authorize('dietitian'), requireActiveAccess, saveDraft);
dietitianRouter.get('/diet-forms',                authenticate, authorize('dietitian'), requireActiveAccess, listDietitianPlans);
dietitianRouter.get('/diet-forms/:id',            authenticate, authorize('dietitian'), requireActiveAccess, getDietitianPlan);
dietitianRouter.put('/diet-forms/:id',            authenticate, authorize('dietitian'), requireActiveAccess, updateDraft);
dietitianRouter.post('/diet-forms/:id/generate',  authenticate, authorize('dietitian'), requireActiveAccess, generateFromDraft);
dietitianRouter.put('/diet-forms/:id/content',    authenticate, authorize('dietitian'), requireActiveAccess, editGeneratedPlan);
dietitianRouter.post('/diet-forms/:id/send',      authenticate, authorize('dietitian'), requireActiveAccess, sendDietitianPlan);

// ── Earnings (accessible regardless — dietitian can still withdraw earned money) ──
dietitianRouter.get('/earnings/wallet',              authenticate, authorize('dietitian'), getWalletOverviewHandler);
dietitianRouter.get('/earnings/summary',             authenticate, authorize('dietitian'), getEarningsSummaryHandler);
dietitianRouter.get('/earnings/monthly-revenue',     authenticate, authorize('dietitian'), getMonthlyRevenueHandler);
dietitianRouter.get('/earnings/by-plan',             authenticate, authorize('dietitian'), getEarningsByPlanHandler);
dietitianRouter.get('/earnings/payout',              authenticate, authorize('dietitian'), getPayoutInfoHandler);
dietitianRouter.get('/earnings/wallet-transactions', authenticate, authorize('dietitian'), getWalletTransactionsHandler);
dietitianRouter.get('/earnings/transactions',        authenticate, authorize('dietitian'), getEarningsTransactionsHandler);

// ── Payment Accounts (accessible regardless) ──────────────────────────────────
dietitianRouter.get('/accounts',                    authenticate, authorize('dietitian'), listAccountsHandler);
dietitianRouter.post('/accounts',                   authenticate, authorize('dietitian'), addAccountHandler);
dietitianRouter.patch('/accounts/:id/set-primary',  authenticate, authorize('dietitian'), setPrimaryAccountHandler);
dietitianRouter.delete('/accounts/:id',             authenticate, authorize('dietitian'), deleteAccountHandler);

// ── Wallet Recharge (requires active access) ───────────────────────────────────
dietitianRouter.post('/wallet/recharge/create-order',   authenticate, authorize('dietitian'), requireActiveAccess, createWalletRechargeOrder);
dietitianRouter.post('/wallet/recharge/verify-payment', authenticate, authorize('dietitian'), requireActiveAccess, verifyWalletRechargePayment);
dietitianRouter.post('/wallet/recharge/failed',         authenticate, authorize('dietitian'), requireActiveAccess, markWalletRechargeFailed);

// ── Withdrawals (accessible regardless) ───────────────────────────────────────
dietitianRouter.post('/withdraw',   authenticate, authorize('dietitian'), requestWithdrawalHandler);
dietitianRouter.get('/withdrawals', authenticate, authorize('dietitian'), listWithdrawalsHandler);

// GET /api/v1/dietitian/:id — public dietitian profile (authenticated users)
dietitianRouter.get('/:id', authenticate, getDietitianById);
