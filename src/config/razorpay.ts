import Razorpay from 'razorpay';
import { env } from './env';

export const razorpay = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID,
  key_secret: env.RAZORPAY_KEY_SECRET,
});

// Amount in INR; Razorpay requires paise — multiply by 100 before creating orders
export const PLANS: Record<string, { label: string; amountInr: number; currency: string }> = {
  '1_week':   { label: '1 Week',   amountInr: 199,  currency: 'INR' },
  '1_month':  { label: '1 Month',  amountInr: 499,  currency: 'INR' },
  '3_months': { label: '3 Months', amountInr: 999,  currency: 'INR' },
};
