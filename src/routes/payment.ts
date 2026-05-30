import { Router } from 'express';
import { createOrder, verifyPaymentAndSubmitForm, markFailed } from '../controllers/payment';
import { optionalAuth } from '../middlewares/optionalAuth';

export const paymentRouter = Router();

// POST /api/v1/payment/create-order — create Razorpay order before showing checkout
paymentRouter.post('/create-order', optionalAuth, createOrder);

// POST /api/v1/payment/verify — verify payment + submit diet form atomically
paymentRouter.post('/verify', optionalAuth, verifyPaymentAndSubmitForm);

// POST /api/v1/payment/failed — called by frontend when user closes/cancels checkout
paymentRouter.post('/failed', optionalAuth, markFailed);
