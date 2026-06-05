import { Router } from 'express';
import { register, login, googleLogin, sendPhoneOtp, verifyPhoneOtp, resendPhoneOtp, forgotPassword, resetPassword } from '../controllers/auth';

export const authRouter = Router();

// POST /api/v1/auth/register
authRouter.post('/register', register);

// POST /api/v1/auth/login
authRouter.post('/login', login);

// POST /api/v1/auth/google
authRouter.post('/google', googleLogin);

// POST /api/v1/auth/send-otp
authRouter.post('/send-otp', sendPhoneOtp);

// POST /api/v1/auth/verify-otp
authRouter.post('/verify-otp', verifyPhoneOtp);

// POST /api/v1/auth/resend-otp
authRouter.post('/resend-otp', resendPhoneOtp);

// POST /api/v1/auth/forgot-password
authRouter.post('/forgot-password', forgotPassword);

// POST /api/v1/auth/reset-password
authRouter.post('/reset-password', resetPassword);
