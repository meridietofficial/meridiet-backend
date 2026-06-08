import Razorpay from 'razorpay';
import { env } from './env';

export const razorpay = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID,
  key_secret: env.RAZORPAY_KEY_SECRET,
});

// Amount in INR; Razorpay requires paise — multiply by 100 before creating orders
export const PLANS: Record<string, { label: string; amountInr: number; currency: string }> = {
  '1_week':   { label: env.PLAN_1_WEEK_LABEL,   amountInr: env.PLAN_1_WEEK_AMOUNT,   currency: 'INR' },
  '1_month':  { label: env.PLAN_1_MONTH_LABEL,  amountInr: env.PLAN_1_MONTH_AMOUNT,  currency: 'INR' },
  '3_months': { label: env.PLAN_3_MONTHS_LABEL, amountInr: env.PLAN_3_MONTHS_AMOUNT, currency: 'INR' },
};
