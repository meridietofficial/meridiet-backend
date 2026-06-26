import { query, execute } from '../config/database';

export interface Coupon {
  id: number;
  code: string;
  type: 'discount' | 'promotional';
  discount_type: 'percentage' | 'flat';
  discount_value: number;
  max_discount_amount: number | null;
  min_order_amount: number | null;
  applicable_on: 'diet_plan' | 'appointment' | 'both';
  applicable_plans: string | null;
  max_uses: number | null;
  max_uses_per_user: number;
  valid_from: Date | null;
  valid_until: Date | null;
  is_active: boolean;
  influencer_name: string | null;
  influencer_phone: string | null;
  campaign_name: string | null;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CouponUsage {
  id: number;
  coupon_id: number;
  user_id: number | null;
  applicable_type: 'diet_plan' | 'appointment';
  payment_id: number | null;
  appointment_id: number | null;
  original_amount: number;
  discount_applied: number;
  final_amount: number;
  used_at: Date;
}

export interface CouponWithStats extends Coupon {
  total_uses: number;
  is_expired: boolean;
}

export type CreateCouponData = Omit<Coupon, 'id' | 'created_at' | 'updated_at'>;
export type UpdateCouponData = Partial<Omit<Coupon, 'id' | 'created_at' | 'updated_at'>>;

export const createCoupon = async (data: CreateCouponData): Promise<Coupon> => {
  const result = await execute(
    `INSERT INTO coupons
       (code, type, discount_type, discount_value, max_discount_amount, min_order_amount,
        applicable_on, applicable_plans, max_uses, max_uses_per_user,
        valid_from, valid_until, is_active,
        influencer_name, influencer_phone, campaign_name, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.code.toUpperCase(),
      data.type,
      data.discount_type,
      data.discount_value,
      data.max_discount_amount ?? null,
      data.min_order_amount ?? null,
      data.applicable_on,
      data.applicable_plans ?? null,
      data.max_uses ?? null,
      data.max_uses_per_user ?? 1,
      data.valid_from ?? null,
      data.valid_until ?? null,
      data.is_active ? 1 : 0,
      data.influencer_name ?? null,
      data.influencer_phone ?? null,
      data.campaign_name ?? null,
      data.description ?? null,
    ],
  );
  return findCouponById(result.insertId) as Promise<Coupon>;
};

export const findCouponById = async (id: number): Promise<Coupon | null> => {
  const rows = await query<Coupon>('SELECT * FROM coupons WHERE id = ? LIMIT 1', [id]);
  return rows[0] ?? null;
};

export const findCouponByCode = async (code: string): Promise<Coupon | null> => {
  const rows = await query<Coupon>(
    `SELECT * FROM coupons WHERE code = ? AND is_active = 1
       AND (valid_from IS NULL OR valid_from <= NOW())
       AND (valid_until IS NULL OR valid_until >= NOW())
     ORDER BY id DESC LIMIT 1`,
    [code.toUpperCase()],
  );
  return rows[0] ?? null;
};

export const listCoupons = async (page: number, limit: number, type?: string): Promise<{ coupons: CouponWithStats[]; total: number }> => {
  const offset = (page - 1) * limit;
  const joinTypeFilter  = type ? 'AND c.type = ?' : '';
  const plainTypeFilter = type ? 'AND type = ?' : '';
  const params: string[] = type ? [type] : [];

  const rows = await query<CouponWithStats>(
    `SELECT sub.*,
       CASE
         WHEN sub.is_active = 0 THEN 1
         WHEN sub.valid_until IS NOT NULL AND sub.valid_until < NOW() THEN 1
         WHEN sub.max_uses IS NOT NULL AND sub.total_uses >= sub.max_uses THEN 1
         ELSE 0
       END AS is_expired
     FROM (
       SELECT c.*, COUNT(cu.id) AS total_uses
       FROM coupons c
       LEFT JOIN coupon_usages cu ON cu.coupon_id = c.id
       WHERE 1=1 ${joinTypeFilter}
       GROUP BY c.id
       ORDER BY c.created_at DESC
       LIMIT ${limit} OFFSET ${offset}
     ) AS sub`,
    params.length > 0 ? params : undefined,
  );

  const countRows = await query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM coupons WHERE 1=1 ${plainTypeFilter}`,
    params.length > 0 ? params : undefined,
  );

  return { coupons: rows, total: countRows[0]?.total ?? 0 };
};

export const updateCoupon = async (id: number, data: UpdateCouponData): Promise<Coupon | null> => {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.code !== undefined)               { fields.push('code = ?');                values.push(data.code.toUpperCase()); }
  if (data.type !== undefined)               { fields.push('type = ?');                values.push(data.type); }
  if (data.discount_type !== undefined)      { fields.push('discount_type = ?');       values.push(data.discount_type); }
  if (data.discount_value !== undefined)     { fields.push('discount_value = ?');      values.push(data.discount_value); }
  if (data.max_discount_amount !== undefined){ fields.push('max_discount_amount = ?'); values.push(data.max_discount_amount); }
  if (data.min_order_amount !== undefined)   { fields.push('min_order_amount = ?');    values.push(data.min_order_amount); }
  if (data.applicable_on !== undefined)      { fields.push('applicable_on = ?');       values.push(data.applicable_on); }
  if (data.applicable_plans !== undefined)   { fields.push('applicable_plans = ?');    values.push(data.applicable_plans); }
  if (data.max_uses !== undefined)           { fields.push('max_uses = ?');            values.push(data.max_uses); }
  if (data.max_uses_per_user !== undefined)  { fields.push('max_uses_per_user = ?');   values.push(data.max_uses_per_user); }
  if (data.valid_from !== undefined)         { fields.push('valid_from = ?');          values.push(data.valid_from); }
  if (data.valid_until !== undefined)        { fields.push('valid_until = ?');         values.push(data.valid_until); }
  if (data.is_active !== undefined)          { fields.push('is_active = ?');           values.push(data.is_active ? 1 : 0); }
  if (data.influencer_name !== undefined)    { fields.push('influencer_name = ?');     values.push(data.influencer_name); }
  if (data.influencer_phone !== undefined)   { fields.push('influencer_phone = ?');    values.push(data.influencer_phone); }
  if (data.campaign_name !== undefined)      { fields.push('campaign_name = ?');       values.push(data.campaign_name); }
  if (data.description !== undefined)        { fields.push('description = ?');         values.push(data.description); }

  if (fields.length === 0) return findCouponById(id);

  values.push(id);
  await execute(`UPDATE coupons SET ${fields.join(', ')} WHERE id = ?`, values);
  return findCouponById(id);
};

export const deactivateCoupon = async (id: number): Promise<void> => {
  await execute('UPDATE coupons SET is_active = 0 WHERE id = ?', [id]);
};

export const getCouponUsages = async (
  couponId: number,
  page: number,
  limit: number,
): Promise<{ usages: CouponUsage[]; total: number }> => {
  const offset = (page - 1) * limit;

  const usages = await query<CouponUsage>(
    `SELECT * FROM coupon_usages WHERE coupon_id = ? ORDER BY used_at DESC LIMIT ${limit} OFFSET ${offset}`,
    [couponId],
  );

  const countRows = await query<{ total: number }>(
    'SELECT COUNT(*) AS total FROM coupon_usages WHERE coupon_id = ?',
    [couponId],
  );

  return { usages, total: countRows[0]?.total ?? 0 };
};

export const countCouponUsageByUser = async (couponId: number, userId: number): Promise<number> => {
  const rows = await query<{ cnt: number }>(
    'SELECT COUNT(*) AS cnt FROM coupon_usages WHERE coupon_id = ? AND user_id = ?',
    [couponId, userId],
  );
  return rows[0]?.cnt ?? 0;
};

export const countTotalCouponUsage = async (couponId: number): Promise<number> => {
  const rows = await query<{ cnt: number }>(
    'SELECT COUNT(*) AS cnt FROM coupon_usages WHERE coupon_id = ?',
    [couponId],
  );
  return rows[0]?.cnt ?? 0;
};

export const createCouponUsage = async (
  data: Omit<CouponUsage, 'id' | 'used_at'>,
): Promise<CouponUsage> => {
  const result = await execute(
    `INSERT INTO coupon_usages
       (coupon_id, user_id, applicable_type, payment_id, appointment_id,
        original_amount, discount_applied, final_amount)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.coupon_id,
      data.user_id ?? null,
      data.applicable_type,
      data.payment_id ?? null,
      data.appointment_id ?? null,
      data.original_amount,
      data.discount_applied,
      data.final_amount,
    ],
  );
  const rows = await query<CouponUsage>('SELECT * FROM coupon_usages WHERE id = ? LIMIT 1', [result.insertId]);
  return rows[0];
};
