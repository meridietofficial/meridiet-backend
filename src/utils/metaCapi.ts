import crypto from 'crypto';
import { env } from '../config/env';

const PIXEL_ID = '2228953927937761';
const CAPI_VERSION = 'v22.0'; // v19.0 reached end-of-life ~Feb 2026; v22.0 active through ~May 2027

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export interface CAPIEventParams {
  eventId: string;
  value: number;
  currency: string;
  funnelType: string;
  email?: string | null;
  phone?: string | null;
  clientIp?: string;
  clientUserAgent?: string;
}

export async function sendCapiPurchase(params: CAPIEventParams): Promise<void> {
  if (!env.META_CAPI_ACCESS_TOKEN) return;

  const userData: Record<string, string> = {};

  if (params.email?.trim()) {
    userData['em'] = sha256(params.email.trim().toLowerCase());
  }
  if (params.phone?.trim()) {
    userData['ph'] = sha256(normalizePhone(params.phone.trim()));
  }
  if (params.clientIp) {
    userData['client_ip_address'] = params.clientIp;
  }
  if (params.clientUserAgent) {
    userData['client_user_agent'] = params.clientUserAgent;
  }

  const eventObject: Record<string, unknown> = {
    event_name: 'Purchase',
    event_time: Math.floor(Date.now() / 1000),
    event_id: params.eventId,
    event_source_url: 'https://meridiet.com',
    action_source: 'website',
    user_data: userData,
    custom_data: {
      value: params.value,
      currency: params.currency,
      funnel_type: params.funnelType,
      transaction_id: params.eventId,
    },
  };

  // Only inject test_event_code when explicitly configured (staging/dev only).
  // This env var MUST be empty in production — test codes suppress real attribution.
  if (env.META_CAPI_TEST_EVENT_CODE) {
    eventObject.test_event_code = env.META_CAPI_TEST_EVENT_CODE;
  }

  const payload = { data: [eventObject] };

  const url = `https://graph.facebook.com/${CAPI_VERSION}/${PIXEL_ID}/events?access_token=${env.META_CAPI_ACCESS_TOKEN}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();

  if (!response.ok) {
    console.error(`[CAPI] Purchase event failed — funnel=${params.funnelType} eventId=${params.eventId} status=${response.status} body=${responseText}`);
  } else {
    console.log(`[CAPI] Purchase event accepted — funnel=${params.funnelType} eventId=${params.eventId} response=${responseText}`);
  }
}
