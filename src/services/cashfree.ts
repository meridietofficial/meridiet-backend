import crypto from 'crypto';
import axios, { AxiosError } from 'axios';
import { env } from '../config/env';

// Cashfree Payouts API v2
// Base URL:  https://api.cashfree.com/payout
// Auth:      x-client-id + x-client-secret on every request (no Bearer token)
// Flow:      register beneficiary once → reuse by beneficiary_id on every transfer

const BASE_URL    = 'https://api.cashfree.com/payout';
const API_VERSION = '2024-01-01';

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type':    'application/json',
    'x-api-version':   API_VERSION,
    'x-client-id':     env.CASHFREE_CLIENT_ID.trim(),
    'x-client-secret': env.CASHFREE_CLIENT_SECRET.trim(),
  };
  if (env.CASHFREE_PUBLIC_KEY?.trim()) {
    const ts   = Math.floor(Date.now() / 1000);
    h['x-cf-signature'] = crypto.publicEncrypt(
      { key: env.CASHFREE_PUBLIC_KEY.trim(), padding: crypto.constants.RSA_PKCS1_PADDING },
      Buffer.from(`${env.CASHFREE_CLIENT_ID.trim()}.${ts}`),
    ).toString('base64');
  }
  return h;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CashfreeTransfer {
  transferId:  string;   // our WD{id} reference
  referenceId: string;   // Cashfree's cf_transfer_id
  utr?:        string;
}

// ── Beneficiary ───────────────────────────────────────────────────────────────

export async function beneficiaryExists(beneId: string): Promise<boolean> {
  try {
    const { data } = await axios.get(`${BASE_URL}/beneficiary`, {
      params:  { beneficiary_id: beneId },
      headers: headers(),
      timeout: 10_000,
    });
    return !!data.beneficiary_id;
  } catch {
    return false;
  }
}

export async function addBeneficiary(params: {
  beneId:       string;
  name:         string;
  email:        string;
  phone:        string;
  vpa?:         string;
  bankAccount?: string;
  ifsc?:        string;
}): Promise<void> {
  const instrument: Record<string, string> = {};
  if (params.vpa) {
    instrument.vpa = params.vpa;
  } else {
    instrument.bank_account_number = params.bankAccount!;
    instrument.bank_ifsc           = params.ifsc!;
  }

  const { data } = await axios.post(
    `${BASE_URL}/beneficiary`,
    {
      beneficiary_id:                 params.beneId,
      beneficiary_name:               params.name,
      beneficiary_instrument_details: instrument,
      beneficiary_contact_details: {
        beneficiary_email: params.email,
        beneficiary_phone: params.phone,
      },
    },
    { headers: headers(), timeout: 10_000 },
  );

  if (!data.beneficiary_id) {
    throw new Error(`Cashfree addBeneficiary failed: ${data.message ?? 'unknown error'}`);
  }
}

// ── Transfer ──────────────────────────────────────────────────────────────────
// Beneficiary must be pre-registered. Only pass beneficiary_id in the transfer.

export async function requestTransfer(params: {
  transferId: string;
  amount:     number;
  mode:       'upi' | 'imps' | 'neft' | 'rtgs';
  remarks:    string;
  beneId:     string;
}): Promise<CashfreeTransfer> {
  const { data } = await axios.post(
    `${BASE_URL}/transfers`,
    {
      transfer_id:      params.transferId,
      transfer_amount:  params.amount,
      transfer_mode:    params.mode,
      transfer_remarks: params.remarks,
      beneficiary_details: { beneficiary_id: params.beneId },
    },
    { headers: headers(), timeout: 15_000 },
  );

  if (!data.transfer_id && !['RECEIVED', 'PENDING', 'SUCCESS'].includes(data.status)) {
    throw new Error(data.message ?? data.type ?? 'Transfer request failed');
  }

  return {
    transferId:  data.transfer_id    ?? params.transferId,
    referenceId: data.cf_transfer_id ?? '',
    utr:         data.utr            ?? undefined,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function isCashfreeConfigured(): boolean {
  return Boolean(env.CASHFREE_CLIENT_ID?.trim() && env.CASHFREE_CLIENT_SECRET?.trim());
}

export function extractCashfreeError(err: unknown): string {
  if (err instanceof AxiosError) {
    return err.response?.data?.message ?? err.response?.data?.type ?? err.message;
  }
  if (err instanceof Error) return err.message;
  return 'Unknown error';
}
