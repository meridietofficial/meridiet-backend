import axios, { AxiosInstance } from 'axios';
import { env } from '../config/env';

// Razorpay X (Payouts) uses a separate key pair from the payment gateway.
// Docs: https://razorpay.com/docs/x/payouts/

function createClient(): AxiosInstance {
  return axios.create({
    baseURL: 'https://api.razorpay.com/v1',
    auth: {
      username: env.RAZORPAY_X_KEY_ID,
      password: env.RAZORPAY_X_KEY_SECRET,
    },
    headers: { 'Content-Type': 'application/json' },
    timeout: 15_000,
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RazorpayContact {
  id: string;           // cont_XXXXXXXX
  name: string;
  email: string | null;
  contact: string | null;
  type: string;
}

export interface RazorpayFundAccount {
  id: string;           // fa_XXXXXXXX
  contact_id: string;
  account_type: 'bank_account' | 'vpa';
}

export interface RazorpayPayout {
  id: string;           // pout_XXXXXXXX
  fund_account_id: string;
  amount: number;       // paise
  currency: string;
  status: string;
  utr: string | null;
}

// ── Contacts ──────────────────────────────────────────────────────────────────

export async function createContact(params: {
  name: string;
  email?: string;
  contact?: string;
  reference_id: string;   // our dietitian ID — idempotency key
}): Promise<RazorpayContact> {
  const client = createClient();
  const { data } = await client.post<RazorpayContact>('/contacts', {
    name: params.name,
    email: params.email ?? undefined,
    contact: params.contact ?? undefined,
    type: 'vendor',
    reference_id: params.reference_id,
  });
  return data;
}

// ── Fund Accounts ─────────────────────────────────────────────────────────────

export async function createBankFundAccount(params: {
  contact_id: string;
  account_holder: string;
  account_number: string;   // plain (decrypted)
  ifsc: string;
}): Promise<RazorpayFundAccount> {
  const client = createClient();
  const { data } = await client.post<RazorpayFundAccount>('/fund_accounts', {
    contact_id: params.contact_id,
    account_type: 'bank_account',
    bank_account: {
      name:           params.account_holder,
      account_number: params.account_number,
      ifsc:           params.ifsc,
    },
  });
  return data;
}

export async function createUpiFundAccount(params: {
  contact_id: string;
  vpa: string;
}): Promise<RazorpayFundAccount> {
  const client = createClient();
  const { data } = await client.post<RazorpayFundAccount>('/fund_accounts', {
    contact_id:   params.contact_id,
    account_type: 'vpa',
    vpa: { address: params.vpa },
  });
  return data;
}

// ── Payouts ───────────────────────────────────────────────────────────────────

export async function createPayout(params: {
  fund_account_id: string;
  amount_inr: number;       // INR — we convert to paise internally
  mode: 'UPI' | 'NEFT' | 'IMPS' | 'RTGS';
  narration: string;        // shows up in bank statement
  reference_id: string;     // our withdrawal ID — idempotency key
}): Promise<RazorpayPayout> {
  const client = createClient();
  const { data } = await client.post<RazorpayPayout>('/payouts', {
    account_number:  env.RAZORPAY_X_ACCOUNT_NUMBER,
    fund_account_id: params.fund_account_id,
    amount:          Math.round(params.amount_inr * 100),  // paise
    currency:        'INR',
    mode:            params.mode,
    purpose:         'payout',
    narration:       params.narration,
    reference_id:    params.reference_id,
    queue_if_low_balance: true,
  });
  return data;
}

export function isRazorpayXConfigured(): boolean {
  return Boolean(
    env.RAZORPAY_X_KEY_ID &&
    env.RAZORPAY_X_KEY_SECRET &&
    env.RAZORPAY_X_ACCOUNT_NUMBER,
  );
}
