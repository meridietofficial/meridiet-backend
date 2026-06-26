import type { Request, Response } from 'express';
import {
  createCoupon,
  findCouponById,
  listCoupons,
  updateCoupon,
  deactivateCoupon,
  getCouponUsages,
  type CreateCouponData,
  type UpdateCouponData,
} from '../models/Coupon';
import { successResponse, errorResponse } from '../utils/response';

const VALID_PLANS = ['1_week', '1_month', '3_months'];
const CODE_REGEX = /^[A-Z0-9_-]{3,50}$/;

// ── Helpers ────────────────────────────────────────────────────────────────────

function validateCouponBody(body: Record<string, unknown>, isCreate: boolean): string | null {
  const {
    code, type, discount_type, discount_value,
    max_discount_amount, min_order_amount,
    applicable_on, applicable_plans,
    max_uses, max_uses_per_user,
    valid_from, valid_until,
    influencer_name,
  } = body;

  if (isCreate) {
    if (!code)           return 'code is required';
    if (!type)           return 'type is required';
    if (!discount_type)  return 'discount_type is required';
    if (discount_value === undefined || discount_value === null) return 'discount_value is required';
    if (!applicable_on)  return 'applicable_on is required';
  }

  if (code !== undefined) {
    if (typeof code !== 'string' || !CODE_REGEX.test((code as string).toUpperCase())) {
      return 'code must be 3–50 characters, alphanumeric with underscores/hyphens only';
    }
  }

  if (type !== undefined && !['discount', 'promotional'].includes(type as string)) {
    return 'type must be "discount" or "promotional"';
  }

  if (discount_type !== undefined && !['percentage', 'flat'].includes(discount_type as string)) {
    return 'discount_type must be "percentage" or "flat"';
  }

  if (discount_value !== undefined) {
    const val = Number(discount_value);
    if (isNaN(val) || val <= 0) return 'discount_value must be a positive number';
    if (discount_type === 'percentage' && val > 100) return 'discount_value cannot exceed 100 for percentage type';
  }

  if (max_discount_amount !== undefined && max_discount_amount !== null) {
    if (Number(max_discount_amount) <= 0) return 'max_discount_amount must be a positive number';
  }

  if (min_order_amount !== undefined && min_order_amount !== null) {
    if (Number(min_order_amount) <= 0) return 'min_order_amount must be a positive number';
  }

  if (applicable_on !== undefined && !['diet_plan', 'appointment', 'both'].includes(applicable_on as string)) {
    return 'applicable_on must be "diet_plan", "appointment", or "both"';
  }

  if (applicable_plans !== undefined && applicable_plans !== null) {
    const plans = (applicable_plans as string).split(',').map((p) => p.trim());
    const invalid = plans.filter((p) => !VALID_PLANS.includes(p));
    if (invalid.length > 0) return `Invalid plan(s): ${invalid.join(', ')}. Valid: ${VALID_PLANS.join(', ')}`;
  }

  if (max_uses !== undefined && max_uses !== null) {
    if (!Number.isInteger(Number(max_uses)) || Number(max_uses) <= 0) return 'max_uses must be a positive integer';
  }

  if (max_uses_per_user !== undefined) {
    if (!Number.isInteger(Number(max_uses_per_user)) || Number(max_uses_per_user) <= 0) return 'max_uses_per_user must be a positive integer';
  }

  if (valid_from !== undefined && valid_from !== null) {
    if (isNaN(Date.parse(valid_from as string))) return 'valid_from must be a valid date';
  }

  if (valid_until !== undefined && valid_until !== null) {
    if (isNaN(Date.parse(valid_until as string))) return 'valid_until must be a valid date';
    if (valid_from && !isNaN(Date.parse(valid_from as string))) {
      if (new Date(valid_until as string) <= new Date(valid_from as string)) {
        return 'valid_until must be after valid_from';
      }
    }
  }

  if (type === 'promotional' && isCreate && !influencer_name) {
    return 'influencer_name is required for promotional coupons';
  }


  return null;
}

// ── Admin: POST /api/v1/admin/coupons ─────────────────────────────────────────
export const adminCreateCoupon = async (req: Request, res: Response) => {
  try {
    const error = validateCouponBody(req.body as Record<string, unknown>, true);
    if (error) return errorResponse(res, 400, error);

    const {
      code, type, discount_type, discount_value,
      max_discount_amount, min_order_amount,
      applicable_on, applicable_plans,
      max_uses, max_uses_per_user,
      valid_from, valid_until,
      is_active,
      influencer_name, influencer_phone, campaign_name,
      description,
    } = req.body as Record<string, unknown>;

    const data: CreateCouponData = {
      code:                code as string,
      type:                type as 'discount' | 'promotional',
      discount_type:       discount_type as 'percentage' | 'flat',
      discount_value:      Number(discount_value),
      max_discount_amount: max_discount_amount != null ? Number(max_discount_amount) : null,
      min_order_amount:    min_order_amount != null ? Number(min_order_amount) : null,
      applicable_on:       (applicable_on as 'diet_plan' | 'appointment' | 'both') ?? 'both',
      applicable_plans:    applicable_plans != null ? (applicable_plans as string) : null,
      max_uses:            max_uses != null ? Number(max_uses) : null,
      max_uses_per_user:   max_uses_per_user != null ? Number(max_uses_per_user) : 1,
      valid_from:          valid_from != null ? new Date(valid_from as string) : null,
      valid_until:         valid_until != null ? new Date(valid_until as string) : null,
      is_active:           is_active !== undefined ? Boolean(is_active) : true,
      influencer_name:     influencer_name != null ? (influencer_name as string) : null,
      influencer_phone:    influencer_phone != null ? (influencer_phone as string) : null,
      campaign_name:       campaign_name != null ? (campaign_name as string) : null,
      description:         description != null ? (description as string) : null,
    };

    const coupon = await createCoupon(data);
    return successResponse(res, 201, 'Coupon created successfully', coupon);
  } catch (err) {
    console.error('Create coupon error:', err);
    return errorResponse(res, 500, 'Failed to create coupon');
  }
};

// ── Admin: GET /api/v1/admin/coupons ──────────────────────────────────────────
export const adminListCoupons = async (req: Request, res: Response) => {
  try {
    const page  = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const type  = req.query.type as string | undefined;

    if (type && !['discount', 'promotional'].includes(type)) {
      return errorResponse(res, 400, 'type filter must be "discount" or "promotional"');
    }

    const { coupons, total } = await listCoupons(page, limit, type);

    return successResponse(res, 200, 'Coupons fetched', coupons, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('List coupons error:', err);
    return errorResponse(res, 500, 'Failed to fetch coupons');
  }
};

// ── Admin: GET /api/v1/admin/coupons/:id ──────────────────────────────────────
export const adminGetCoupon = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid coupon ID');

    const coupon = await findCouponById(id);
    if (!coupon) return errorResponse(res, 404, 'Coupon not found');

    return successResponse(res, 200, 'Coupon fetched', coupon);
  } catch (err) {
    console.error('Get coupon error:', err);
    return errorResponse(res, 500, 'Failed to fetch coupon');
  }
};

// ── Admin: PATCH /api/v1/admin/coupons/:id ────────────────────────────────────
export const adminUpdateCoupon = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid coupon ID');

    const existing = await findCouponById(id);
    if (!existing) return errorResponse(res, 404, 'Coupon not found');

    // For update, resolve the effective discount_type (existing or incoming) for % validation
    const body = req.body as Record<string, unknown>;
    const effectiveDiscountType = (body.discount_type ?? existing.discount_type) as string;
    const error = validateCouponBody({ ...body, discount_type: effectiveDiscountType }, false);
    if (error) return errorResponse(res, 400, error);

    const {
      code, type, discount_type, discount_value,
      max_discount_amount, min_order_amount,
      applicable_on, applicable_plans,
      max_uses, max_uses_per_user,
      valid_from, valid_until,
      is_active,
      influencer_name, influencer_phone, campaign_name,
      description,
    } = body;

    const data: UpdateCouponData = {};

    if (code !== undefined)                data.code                = code as string;
    if (type !== undefined)                data.type                = type as 'discount' | 'promotional';
    if (discount_type !== undefined)       data.discount_type       = discount_type as 'percentage' | 'flat';
    if (discount_value !== undefined)      data.discount_value      = Number(discount_value);
    if ('max_discount_amount' in body)     data.max_discount_amount = max_discount_amount != null ? Number(max_discount_amount) : null;
    if ('min_order_amount' in body)        data.min_order_amount    = min_order_amount != null ? Number(min_order_amount) : null;
    if (applicable_on !== undefined)       data.applicable_on       = applicable_on as 'diet_plan' | 'appointment' | 'both';
    if ('applicable_plans' in body)        data.applicable_plans    = applicable_plans != null ? (applicable_plans as string) : null;
    if ('max_uses' in body)                data.max_uses            = max_uses != null ? Number(max_uses) : null;
    if (max_uses_per_user !== undefined)   data.max_uses_per_user   = Number(max_uses_per_user);
    if ('valid_from' in body)              data.valid_from          = valid_from != null ? new Date(valid_from as string) : null;
    if ('valid_until' in body)             data.valid_until         = valid_until != null ? new Date(valid_until as string) : null;
    if (is_active !== undefined)           data.is_active           = Boolean(is_active);
    if ('influencer_name' in body)         data.influencer_name     = influencer_name != null ? (influencer_name as string) : null;
    if ('influencer_phone' in body)        data.influencer_phone    = influencer_phone != null ? (influencer_phone as string) : null;
    if ('campaign_name' in body)           data.campaign_name       = campaign_name != null ? (campaign_name as string) : null;
    if ('description' in body)             data.description         = description != null ? (description as string) : null;

    const updated = await updateCoupon(id, data);
    return successResponse(res, 200, 'Coupon updated successfully', updated);
  } catch (err) {
    console.error('Update coupon error:', err);
    return errorResponse(res, 500, 'Failed to update coupon');
  }
};

// ── Admin: DELETE /api/v1/admin/coupons/:id ───────────────────────────────────
export const adminDeactivateCoupon = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid coupon ID');

    const existing = await findCouponById(id);
    if (!existing) return errorResponse(res, 404, 'Coupon not found');

    await deactivateCoupon(id);
    return successResponse(res, 200, 'Coupon deactivated successfully');
  } catch (err) {
    console.error('Deactivate coupon error:', err);
    return errorResponse(res, 500, 'Failed to deactivate coupon');
  }
};

// ── Admin: GET /api/v1/admin/coupons/:id/usages ───────────────────────────────
export const adminGetCouponUsages = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid coupon ID');

    const existing = await findCouponById(id);
    if (!existing) return errorResponse(res, 404, 'Coupon not found');

    const page  = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 20, 100);

    const { usages, total } = await getCouponUsages(id, page, limit);

    return successResponse(res, 200, 'Coupon usages fetched', usages, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('Get coupon usages error:', err);
    return errorResponse(res, 500, 'Failed to fetch coupon usages');
  }
};
