import type { Request, Response } from 'express';
import { query } from '../config/database';
import { getSetting } from '../models/Setting';
import { adminCreditEarningsWallet, adminCreditPlanCredits } from '../models/DietitianWallet';
import { successResponse, errorResponse } from '../utils/response';

type EarningMode = 'diet_plans' | 'appointments' | 'registrations' | 'courses';

const VALID_MODES: EarningMode[] = ['diet_plans', 'appointments', 'registrations', 'courses'];

async function fetchCommissionPct(): Promise<number> {
  const raw = await getSetting('platform_commission_pct');
  const pct = raw !== null ? Number(raw) : 20;
  return isNaN(pct) ? 20 : pct;
}

// ── Diet Plan Payments ────────────────────────────────────────────────────────

async function getDietPlanEarnings(search: string | undefined, status: string, page: number, limit: number) {
  const offset = (page - 1) * limit;

  const statusCond =
    status === 'paid'   ? `AND p.status = 'paid'` :
    status === 'pending' ? `AND p.status = 'pending'` :
    status === 'failed'  ? `AND p.status = 'failed'` : '';

  const searchCond = search
    ? `AND (u.full_name LIKE ? OR u.email LIKE ? OR p.razorpay_order_id LIKE ? OR p.razorpay_payment_id LIKE ?)`
    : '';
  const searchParams = search ? [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`] : [];

  const baseWhere = `WHERE 1=1 ${statusCond} ${searchCond}`;

  const [rows, countRows, summaryRows] = await Promise.all([
    query<{
      id: number;
      user_name: string;
      user_email: string;
      user_avatar: string | null;
      plan: string;
      amount: number;
      final_amount: number | null;
      discount_applied: number | null;
      months_total: number;
      per_month_amount: number;
      currency: string;
      status: string;
      razorpay_order_id: string;
      razorpay_payment_id: string | null;
      created_at: string;
    }>(
      `SELECT p.id, COALESCE(u.full_name, 'Guest') AS user_name, COALESCE(u.email, '') AS user_email,
              u.avatar_url AS user_avatar,
              p.plan, p.amount, p.final_amount, p.discount_applied,
              p.months_total, p.per_month_amount, p.currency, p.status,
              p.razorpay_order_id, p.razorpay_payment_id,
              DATE_FORMAT(p.created_at, '%Y-%m-%d %H:%i:%s') AS created_at
       FROM payments p
       LEFT JOIN users u ON u.id = p.user_id AND u.is_delete = 0
       ${baseWhere}
       ORDER BY p.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      searchParams,
    ),
    query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM payments p LEFT JOIN users u ON u.id = p.user_id AND u.is_delete = 0 ${baseWhere}`,
      searchParams,
    ),
    query<{ total_revenue: number; paid_count: number; pending_count: number; failed_count: number }>(
      `SELECT
         COALESCE(SUM(CASE WHEN p.status = 'paid' THEN COALESCE(p.final_amount, p.amount) ELSE 0 END), 0) AS total_revenue,
         SUM(p.status = 'paid')    AS paid_count,
         SUM(p.status = 'pending') AS pending_count,
         SUM(p.status = 'failed')  AS failed_count
       FROM payments p
       LEFT JOIN users u ON u.id = p.user_id AND u.is_delete = 0
       ${baseWhere}`,
      searchParams,
    ),
  ]);

  const s = summaryRows[0];
  return {
    summary: {
      total_revenue: Number(s?.total_revenue ?? 0),
      paid_count:    Number(s?.paid_count    ?? 0),
      pending_count: Number(s?.pending_count ?? 0),
      failed_count:  Number(s?.failed_count  ?? 0),
    },
    transactions: rows,
    total: Number(countRows[0]?.total ?? 0),
    page,
    limit,
  };
}

// ── Appointment Earnings ──────────────────────────────────────────────────────

async function getAppointmentEarnings(search: string | undefined, status: string, page: number, limit: number) {
  const offset    = (page - 1) * limit;
  const commPct   = await fetchCommissionPct();

  const statusCond =
    status === 'paid'      ? `AND a.payment_status = 'paid'` :
    status === 'pending'   ? `AND a.payment_status = 'unpaid'` :
    status === 'refunded'  ? `AND a.payment_status = 'refunded'` : '';

  const searchCond = search
    ? `AND (COALESCE(u.full_name, a.name) LIKE ? OR u.email LIKE ? OR d.full_name LIKE ?)`
    : '';
  const searchParams = search ? [`%${search}%`, `%${search}%`, `%${search}%`] : [];

  const baseWhere = `WHERE a.payment_status != 'unpaid' OR a.status IN ('confirmed','completed') ${statusCond} ${searchCond}`;

  const [rows, countRows, summaryRows] = await Promise.all([
    query<{
      id: number;
      client_name: string;
      client_email: string;
      client_avatar: string | null;
      dietitian_name: string;
      appointment_date: string;
      fee: number;
      final_amount: number | null;
      currency: string;
      status: string;
      payment_status: string;
      payment_id: string | null;
      created_at: string;
    }>(
      `SELECT a.id,
              COALESCE(u.full_name, a.name) AS client_name,
              COALESCE(u.email, '')          AS client_email,
              u.avatar_url                   AS client_avatar,
              d.full_name                    AS dietitian_name,
              DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointment_date,
              a.fee, a.final_amount, a.currency,
              a.status, a.payment_status, a.payment_id,
              DATE_FORMAT(a.created_at, '%Y-%m-%d %H:%i:%s') AS created_at
       FROM appointments a
       LEFT JOIN users u      ON u.id = a.user_id AND u.is_delete = 0
       LEFT JOIN dietitians d ON d.id = a.dietitian_id
       ${baseWhere}
       ORDER BY a.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      searchParams,
    ),
    query<{ total: number }>(
      `SELECT COUNT(*) AS total
       FROM appointments a
       LEFT JOIN users u      ON u.id = a.user_id AND u.is_delete = 0
       LEFT JOIN dietitians d ON d.id = a.dietitian_id
       ${baseWhere}`,
      searchParams,
    ),
    query<{ gross: number; paid_count: number; pending_count: number; refunded_count: number }>(
      `SELECT
         COALESCE(SUM(CASE WHEN a.payment_status = 'paid' THEN COALESCE(a.final_amount, a.fee) ELSE 0 END), 0) AS gross,
         SUM(a.payment_status = 'paid')     AS paid_count,
         SUM(a.payment_status = 'unpaid')   AS pending_count,
         SUM(a.payment_status = 'refunded') AS refunded_count
       FROM appointments a
       LEFT JOIN users u      ON u.id = a.user_id AND u.is_delete = 0
       LEFT JOIN dietitians d ON d.id = a.dietitian_id
       ${baseWhere}`,
      searchParams,
    ),
  ]);

  const s         = summaryRows[0];
  const gross     = Number(s?.gross ?? 0);
  const commission = Math.round(gross * (commPct / 100));

  const transactions = rows.map((r) => {
    const fee        = Number(r.final_amount ?? r.fee);
    const comm       = Math.round(fee * (commPct / 100));
    return {
      ...r,
      fee:                    Number(r.fee),
      final_amount:           r.final_amount !== null ? Number(r.final_amount) : null,
      platform_commission:    comm,
      platform_commission_pct: commPct,
      dietitian_earnings:     fee - comm,
    };
  });

  return {
    summary: {
      platform_commission_pct: commPct,
      total_gross_revenue:     gross,
      platform_commission:     commission,
      dietitian_payouts:       gross - commission,
      paid_count:              Number(s?.paid_count     ?? 0),
      pending_count:           Number(s?.pending_count  ?? 0),
      refunded_count:          Number(s?.refunded_count ?? 0),
    },
    transactions,
    total: Number(countRows[0]?.total ?? 0),
    page,
    limit,
  };
}

// ── Dietitian Registration Fees ───────────────────────────────────────────────

async function getRegistrationEarnings(search: string | undefined, status: string, page: number, limit: number) {
  const offset = (page - 1) * limit;

  const statusCond =
    status === 'paid'    ? `AND status = 'paid'` :
    status === 'pending' ? `AND status = 'pending'` :
    status === 'failed'  ? `AND status = 'failed'` : '';

  const searchCond = search ? `AND (email LIKE ? OR razorpay_order_id LIKE ? OR razorpay_payment_id LIKE ? OR JSON_UNQUOTE(JSON_EXTRACT(registration_data, '$.fullName')) LIKE ? OR JSON_UNQUOTE(JSON_EXTRACT(registration_data, '$.phone')) LIKE ?)` : '';
  const searchParams = search ? [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`] : [];

  const baseWhere = `WHERE 1=1 ${statusCond} ${searchCond}`;

  const [rows, countRows, summaryRows] = await Promise.all([
    query<{
      id: number;
      name: string | null;
      phone: string | null;
      email: string;
      amount: number;
      status: string;
      razorpay_order_id: string | null;
      razorpay_payment_id: string | null;
      payment_verified_at: string | null;
      created_at: string;
    }>(
      `SELECT id,
              JSON_UNQUOTE(JSON_EXTRACT(registration_data, '$.fullName')) AS name,
              JSON_UNQUOTE(JSON_EXTRACT(registration_data, '$.phone'))    AS phone,
              email, amount, status,
              razorpay_order_id, razorpay_payment_id,
              DATE_FORMAT(payment_verified_at, '%Y-%m-%d %H:%i:%s') AS payment_verified_at,
              DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
       FROM dietitian_registration_payments
       ${baseWhere}
       ORDER BY created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      searchParams,
    ),
    query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM dietitian_registration_payments ${baseWhere}`,
      searchParams,
    ),
    query<{ total_revenue: number; paid_count: number; pending_count: number; failed_count: number }>(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS total_revenue,
         SUM(status = 'paid')    AS paid_count,
         SUM(status = 'pending') AS pending_count,
         SUM(status = 'failed')  AS failed_count
       FROM dietitian_registration_payments
       ${baseWhere}`,
      searchParams,
    ),
  ]);

  const s = summaryRows[0];
  return {
    summary: {
      total_revenue: Number(s?.total_revenue ?? 0),
      paid_count:    Number(s?.paid_count    ?? 0),
      pending_count: Number(s?.pending_count ?? 0),
      failed_count:  Number(s?.failed_count  ?? 0),
    },
    transactions: rows,
    total: Number(countRows[0]?.total ?? 0),
    page,
    limit,
  };
}

// ── Course Enrollments ────────────────────────────────────────────────────────

async function getCourseEarnings(search: string | undefined, status: string, page: number, limit: number) {
  const offset = (page - 1) * limit;

  const statusCond =
    status === 'paid'    ? `AND payment_status = 'paid'` :
    status === 'pending' ? `AND payment_status = 'pending'` :
    status === 'failed'  ? `AND payment_status = 'failed'` : '';

  const searchCond = search
    ? `AND (name LIKE ? OR email LIKE ? OR phone LIKE ? OR razorpay_order_id LIKE ?)`
    : '';
  const searchParams = search ? [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`] : [];

  const baseWhere = `WHERE 1=1 ${statusCond} ${searchCond}`;

  const [rows, countRows, summaryRows] = await Promise.all([
    query<{
      id: number;
      name: string;
      email: string;
      phone: string;
      course_fee: number;
      payment_status: string;
      razorpay_order_id: string | null;
      razorpay_payment_id: string | null;
      payment_verified_at: string | null;
      created_at: string;
    }>(
      `SELECT id, name, email, phone, course_fee, payment_status,
              razorpay_order_id, razorpay_payment_id,
              DATE_FORMAT(payment_verified_at, '%Y-%m-%d %H:%i:%s') AS payment_verified_at,
              DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
       FROM course_enrollments
       ${baseWhere}
       ORDER BY created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      searchParams,
    ),
    query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM course_enrollments ${baseWhere}`,
      searchParams,
    ),
    query<{ total_revenue: number; paid_count: number; pending_count: number; failed_count: number }>(
      `SELECT
         COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN course_fee ELSE 0 END), 0) AS total_revenue,
         SUM(payment_status = 'paid')    AS paid_count,
         SUM(payment_status = 'pending') AS pending_count,
         SUM(payment_status = 'failed')  AS failed_count
       FROM course_enrollments
       ${baseWhere}`,
      searchParams,
    ),
  ]);

  const s = summaryRows[0];
  return {
    summary: {
      total_revenue: Number(s?.total_revenue ?? 0),
      paid_count:    Number(s?.paid_count    ?? 0),
      pending_count: Number(s?.pending_count ?? 0),
      failed_count:  Number(s?.failed_count  ?? 0),
    },
    transactions: rows,
    total: Number(countRows[0]?.total ?? 0),
    page,
    limit,
  };
}

// ── Controller ────────────────────────────────────────────────────────────────

// GET /api/v1/admin/earnings?mode=diet_plans|appointments|registrations|courses
//   &status=all|paid|pending|failed|refunded
//   &search=...
//   &page=1&limit=10
export const getAdminEarnings = async (req: Request, res: Response) => {
  try {
    const mode   = (req.query.mode   as string) ?? 'diet_plans';
    const status = (req.query.status as string) ?? 'all';
    const search = (req.query.search as string) || undefined;
    const page   = Math.max(1, parseInt(req.query.page   as string) || 1);
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));

    if (!VALID_MODES.includes(mode as EarningMode)) {
      return errorResponse(res, 400, `Invalid mode. Must be one of: ${VALID_MODES.join(', ')}`);
    }

    let data;
    if (mode === 'diet_plans') {
      data = await getDietPlanEarnings(search, status, page, limit);
    } else if (mode === 'appointments') {
      data = await getAppointmentEarnings(search, status, page, limit);
    } else if (mode === 'registrations') {
      data = await getRegistrationEarnings(search, status, page, limit);
    } else {
      data = await getCourseEarnings(search, status, page, limit);
    }

    return successResponse(res, 200, 'Earnings fetched successfully', { mode, ...data });
  } catch (err) {
    console.error('Admin earnings error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// POST /api/v1/admin/dietitians/:id/plan-credits
// Body: { amount: number, description?: string }
export const adminCreditPlanCreditsHandler = async (req: Request, res: Response) => {
  try {
    const dietitianId = Number(req.params.id);
    if (isNaN(dietitianId)) return errorResponse(res, 400, 'Invalid dietitian id');

    const { amount, description } = req.body as { amount?: number; description?: string };

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return errorResponse(res, 400, 'amount is required and must be a positive number');
    }
    if (!Number.isInteger(Number(amount))) {
      return errorResponse(res, 400, 'amount must be a whole number');
    }

    const adminUserId = Number(req.user?.sub);

    // Verify dietitian exists
    const rows = await query<{ id: number; full_name: string }>(
      'SELECT id, full_name FROM dietitians WHERE id = ? LIMIT 1',
      [dietitianId],
    );
    if (!rows[0]) return errorResponse(res, 404, 'Dietitian not found');

    const result = await adminCreditPlanCredits(
      dietitianId,
      Number(amount),
      adminUserId,
      description,
    );

    if (!result.credited) {
      return errorResponse(res, 404, 'Dietitian not found');
    }

    return successResponse(res, 200, 'Plan credits added successfully', {
      dietitian_id:  dietitianId,
      amount_added:  Number(amount),
      plan_credits:  result.new_balance,
    });
  } catch (err) {
    console.error('adminCreditPlanCredits error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// POST /api/v1/admin/dietitians/:id/earnings-credit
// Body: { amount: number, description?: string }
export const adminCreditEarningsHandler = async (req: Request, res: Response) => {
  try {
    const dietitianId = Number(req.params.id);
    if (isNaN(dietitianId)) return errorResponse(res, 400, 'Invalid dietitian id');

    const { amount, description } = req.body as { amount?: number; description?: string };

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return errorResponse(res, 400, 'amount is required and must be a positive number');
    }
    if (!Number.isInteger(Number(amount))) {
      return errorResponse(res, 400, 'amount must be a whole number');
    }

    const adminUserId = Number(req.user?.sub);

    const rows = await query<{ id: number }>(
      'SELECT id FROM dietitians WHERE id = ? LIMIT 1',
      [dietitianId],
    );
    if (!rows[0]) return errorResponse(res, 404, 'Dietitian not found');

    const result = await adminCreditEarningsWallet(
      dietitianId,
      Number(amount),
      adminUserId,
      description,
    );

    if (!result.credited) {
      return errorResponse(res, 404, 'Dietitian not found');
    }

    return successResponse(res, 200, 'Earnings wallet credited successfully', {
      dietitian_id:      dietitianId,
      amount_added:      Number(amount),
      earnings_balance:  result.new_balance,
    });
  } catch (err) {
    console.error('adminCreditEarnings error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};
