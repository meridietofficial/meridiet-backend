import { Router } from 'express';
import { getWalletBalance, getWalletTransactionHistory } from '../controllers/wallet';
import { authenticate } from '../middlewares/authenticate';

export const walletRouter = Router();

// GET /api/v1/wallet/balance
walletRouter.get('/balance', authenticate, getWalletBalance);

// GET /api/v1/wallet/transactions?page=1&limit=10
walletRouter.get('/transactions', authenticate, getWalletTransactionHistory);
