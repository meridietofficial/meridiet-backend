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

export interface CouponUsageDetail extends CouponUsage {
  user_name:         string | null;
  user_email:        string | null;
  user_phone:        string | null;
  // diet plan context (when applicable_type = 'diet_plan')
  payment_plan:      string | null;
  payment_order_id:  string | null;
  // appointment context (when applicable_type = 'appointment')
  appointment_date:  string | null;
  appointment_slot:  string | null;
  dietitian_name:    string | null;
}

export const getCouponUsages = async (
  couponId: number,
  page: number,
  limit: number,
): Promise<{ usages: CouponUsageDetail[]; total: number }> => {
  const offset = (page - 1) * limit;

  const usages = await query<CouponUsageDetail>(
    `SELECT
       cu.id, cu.coupon_id, cu.user_id, cu.applicable_type,
       cu.payment_id, cu.appointment_id,
       cu.original_amount, cu.discount_applied, cu.final_amount,
       cu.used_at,
       u.full_name                                           AS user_name,
       u.email                                               AS user_email,
       u.phone_number                                        AS user_phone,
       p.plan                                                AS payment_plan,
       p.razorpay_order_id                                   AS payment_order_id,
       DATE_FORMAT(a.appointment_date, '%Y-%m-%d')           AS appointment_date,
       TIME_FORMAT(a.slot, '%H:%i')                          AS appointment_slot,
       du.full_name                                          AS dietitian_name
     FROM coupon_usages cu
     LEFT JOIN users u         ON u.id  = cu.user_id
     LEFT JOIN payments p      ON p.id  = cu.payment_id
     LEFT JOIN appointments a  ON a.id  = cu.appointment_id
     LEFT JOIN dietitians d    ON d.id  = a.dietitian_id
     LEFT JOIN users du        ON du.id = d.user_id
     WHERE cu.coupon_id = ?
     ORDER BY cu.used_at DESC
     LIMIT ${limit} OFFSET ${offset}`,
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

export const getAllCouponUsages = async (
  page: number,
  limit: number,
  couponId?: number,
  applicableType?: string,
): Promise<{ usages: CouponUsageDetail[]; total: number }> => {
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: unknown[] = [];
  if (couponId)       { conditions.push('cu.coupon_id = ?');       params.push(couponId); }
  if (applicableType) { conditions.push('cu.applicable_type = ?'); params.push(applicableType); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const usages = await query<CouponUsageDetail>(
    `SELECT
       cu.id, cu.coupon_id, cu.user_id, cu.applicable_type,
       cu.payment_id, cu.appointment_id,
       cu.original_amount, cu.discount_applied, cu.final_amount,
       cu.used_at,
       c.code                                                AS coupon_code,
       u.full_name                                           AS user_name,
       u.email                                               AS user_email,
       u.phone_number                                        AS user_phone,
       p.plan                                                AS payment_plan,
       p.razorpay_order_id                                   AS payment_order_id,
       DATE_FORMAT(a.appointment_date, '%Y-%m-%d')           AS appointment_date,
       TIME_FORMAT(a.slot, '%H:%i')                          AS appointment_slot,
       du.full_name                                          AS dietitian_name
     FROM coupon_usages cu
     JOIN coupons c            ON c.id  = cu.coupon_id
     LEFT JOIN users u         ON u.id  = cu.user_id
     LEFT JOIN payments p      ON p.id  = cu.payment_id
     LEFT JOIN appointments a  ON a.id  = cu.appointment_id
     LEFT JOIN dietitians d    ON d.id  = a.dietitian_id
     LEFT JOIN users du        ON du.id = d.user_id
     ${where}
     ORDER BY cu.used_at DESC
     LIMIT ${limit} OFFSET ${offset}`,
    params,
  );

  const countRows = await query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM coupon_usages cu ${where}`,
    params,
  );

  return { usages, total: countRows[0]?.total ?? 0 };
};

export interface CouponResolution {
  coupon: Coupon;
  discountApplied: number;
  finalAmount: number;
}

// Validates a coupon code against all business rules and calculates the discount.
// Returns the resolved amounts or an error string — callers decide the HTTP status.
export const resolveCoupon = async (
  code: string,
  applicableType: 'diet_plan' | 'appointment',
  amount: number,
  plan: string | null,
  userId: number | null,
): Promise<CouponResolution | { error: string }> => {
  const coupon = await findCouponByCode(code);
  if (!coupon) return { error: 'Invalid or expired coupon code' };

  if (coupon.applicable_on !== 'both' && coupon.applicable_on !== applicableType) {
    return { error: `This coupon is not applicable on ${applicableType}` };
  }

  if (applicableType === 'diet_plan' && coupon.applicable_plans) {
    if (!plan) return { error: 'plan is required for this coupon' };
    const allowed = coupon.applicable_plans.split(',').map((p) => p.trim());
    if (!allowed.includes(plan)) {
      return { error: `This coupon is not valid for the "${plan}" plan` };
    }
  }

  if (coupon.min_order_amount !== null && amount < coupon.min_order_amount) {
    return { error: `Minimum order amount is ₹${coupon.min_order_amount}` };
  }

  if (coupon.max_uses !== null) {
    const totalUsed = await countTotalCouponUsage(coupon.id);
    if (totalUsed >= coupon.max_uses) return { error: 'This coupon has reached its usage limit' };
  }

  if (userId) {
    const userUsed = await countCouponUsageByUser(coupon.id, userId);
    if (userUsed >= coupon.max_uses_per_user) {
      return { error: 'You have already used this coupon the maximum number of times' };
    }
  }

  let discountApplied: number;
  if (coupon.discount_type === 'percentage') {
    discountApplied = (amount * coupon.discount_value) / 100;
    if (coupon.max_discount_amount !== null) {
      discountApplied = Math.min(discountApplied, coupon.max_discount_amount);
    }
  } else {
    discountApplied = Math.min(coupon.discount_value, amount);
  }
  discountApplied = Math.round(discountApplied * 100) / 100;

  return { coupon, discountApplied, finalAmount: Math.max(amount - discountApplied, 0) };
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
