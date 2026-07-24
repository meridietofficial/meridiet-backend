import type { Request, Response } from 'express';
import crypto from 'crypto';
import { env } from '../config/env';
import { successResponse } from '../utils/response';

const mask = (key: string, show = 4): string => {
  if (key.length <= show * 2) return '*'.repeat(key.length);
  return `${key.slice(0, show)}${'*'.repeat(key.length - show * 2)}${key.slice(-show)}`;
};

// POST /api/v1/aws-keys
// Body (optional): { secret: string }
// — No secret / wrong secret → masked keys
// — Correct secret → real keys
export const awsKeys = (req: Request, res: Response) => {
  const { secret } = req.body as { secret?: string };

  const clientBuf = Buffer.from(secret ?? '');
  const expectedBuf = Buffer.from(env.AWS_REVEAL_SECRET ?? '');

  const isAuthorized =
    secret &&
    clientBuf.length === expectedBuf.length &&
    crypto.timingSafeEqual(clientBuf, expectedBuf);

  if (isAuthorized) {
    return successResponse(res, 200, 'AWS keys revealed', {
      access_key_id: env.AWS_ACCESS_KEY_ID,
      secret_access_key: env.AWS_SECRET_ACCESS_KEY,
      region: env.AWS_REGION,
      bucket: env.AWS_S3_BUCKET,
      base_url: env.AWS_S3_BASE_URL,
    });
  }

  return successResponse(res, 200, 'AWS keys (masked)', {
    access_key_id: mask(env.AWS_ACCESS_KEY_ID),
    secret_access_key: mask(env.AWS_SECRET_ACCESS_KEY),
    region: env.AWS_REGION,
    bucket: env.AWS_S3_BUCKET,
    base_url: env.AWS_S3_BASE_URL,
  });
};
