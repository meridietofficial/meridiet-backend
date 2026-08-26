import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { findUserByEmail, findUserByPhoneNumber, findUserById, checkPassword, updateUser, softDeleteUser, updateUserPassword, getUsersPaginated, createUser } from '../models/User';
import { getDietitiansPaginated, findDietitianById, verifyDietitian, formatDietitianRow, findDietitianByRegistrationNumber, createDietitian } from '../models/Dietitian';
import { query } from '../config/database';
import { env } from '../config/env';
import { successResponse, errorResponse } from '../utils/response';
import { istToUTC } from '../utils/date';

const pad2 = (n: number) => String(n).padStart(2, '0');
import { sendEmail } from '../services/email';
import { dietitianApprovedEmail } from '../services/emails/dietitianApproved';
import { dietitianWelcomeEmail } from '../services/emails/dietitianWelcome';
import { adminCreditPlanCredits } from '../models/DietitianWallet';

const generateAccessToken = (userId: number, email: string | null, role: string, tokenVersion: number) => {
  return jwt.sign(
    { sub: userId, email, role, tokenVersion },
    env.JWT_SECRET,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN } as any,
  );
};

const generateRefreshToken = (userId: number, email: string | null, role: string, tokenVersion: number) => {
  return jwt.sign(
    { sub: userId, email, role, tokenVersion },
    env.JWT_REFRESH_SECRET,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN } as any,
  );
};

// POST /api/v1/admin/login
// Body: { email, password, user_type }
export const adminLogin = async (req: Request, res: Response) => {
  try {
    const { email, password, user_type } = req.body;

    if (!email || !password || !user_type) {
      return errorResponse(res, 400, 'email, password, and user_type are required');
    }

    if (user_type !== 'admin') {
      return errorResponse(res, 400, 'user_type must be: admin');
    }

    const user = await findUserByEmail(email);

    if (!user || user.role !== 'admin') {
      return errorResponse(res, 401, 'Invalid email or password');
    }

    if (!user.is_active) {
      return errorResponse(res, 403, 'Account is deactivated. Please contact support.');
    }

    const isValid = await checkPassword(password, user.password);
    if (!isValid) {
      return errorResponse(res, 401, 'Invalid email or password');
    }

    const accessToken = generateAccessToken(user.id, user.email, user.role, user.token_version);
    const refreshToken = generateRefreshToken(user.id, user.email, user.role, user.token_version);

    return successResponse(res, 200, 'Login successful', {
      tokens: { accessToken, refreshToken },
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone_code: user.phone_code,
        phone_number: user.phone_number,
        role: user.role,
        avatar_url: user.avatar_url,
      },
    });
  } catch (err) {
    console.error('Admin login error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// POST /api/v1/admin/refresh-token
// Body: { refreshToken }  (also accepts refresh_token)
// Exchanges a valid refresh token for a fresh access + refresh token pair so the
// admin session stays alive without re-logging in.
export const refreshAdminToken = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.body?.refreshToken ?? req.body?.refresh_token;
    if (!refreshToken) return errorResponse(res, 400, 'refreshToken is required');

    let payload: { sub: string; email: string | null; role: string; tokenVersion?: number };
    try {
      payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as typeof payload;
    } catch {
      return errorResponse(res, 401, 'Invalid or expired refresh token');
    }

    const user = await findUserById(Number(payload.sub));
    if (!user || user.role !== 'admin') return errorResponse(res, 401, 'Invalid refresh token');
    if (!user.is_active) return errorResponse(res, 403, 'Account is deactivated. Please contact support.');

    if ((payload.tokenVersion ?? 0) !== user.token_version) {
      return errorResponse(res, 401, 'Session expired. Please log in again.');
    }

    const accessToken = generateAccessToken(user.id, user.email, user.role, user.token_version);
    const newRefreshToken = generateRefreshToken(user.id, user.email, user.role, user.token_version);

    return successResponse(res, 200, 'Token refreshed', {
      tokens: { accessToken, refreshToken: newRefreshToken },
    });
  } catch (err) {
    console.error('Refresh admin token error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/admin/dietitians?page=1&limit=10&search=&status=active|blocked&startDate=&endDate=&sortBy=full_name|created_at&sortOrder=asc|desc
export const getDietitianList = async (req: Request, res: Response) => {
  try {
    const page      = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit     = Math.min(10000, Math.max(1, parseInt(req.query.limit as string) || 10));
    const search    = (req.query.search    as string | undefined)?.trim() || undefined;
    const status    = req.query.status    as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate   = req.query.endDate   as string | undefined;
    const sortBy    = req.query.sortBy    as string | undefined;
    const sortOrder = req.query.sortOrder as string | undefined;

    const { rows, total } = await getDietitiansPaginated({ page, limit, is_verified: 1, search, status, startDate, endDate, sortBy, sortOrder });
    const totalPages = Math.ceil(total / limit);

    return successResponse(
      res,
      200,
      'Dietitians fetched successfully',
      rows.map(formatDietitianRow),
      { page, limit, total, totalPages },
    );
  } catch (err) {
    console.error('Get dietitian list error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/admin/dietitian-requests?page=1&limit=10&search=&status=active|blocked&startDate=&endDate=&sortBy=full_name|created_at&sortOrder=asc|desc
export const getDietitianRequests = async (req: Request, res: Response) => {
  try {
    const page      = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit     = Math.min(10000, Math.max(1, parseInt(req.query.limit as string) || 10));
    const search    = (req.query.search    as string | undefined)?.trim() || undefined;
    const status    = req.query.status    as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate   = req.query.endDate   as string | undefined;
    const sortBy    = req.query.sortBy    as string | undefined;
    const sortOrder = req.query.sortOrder as string | undefined;

    const { rows, total } = await getDietitiansPaginated({ page, limit, is_verified: 0, search, status, startDate, endDate, sortBy, sortOrder });
    const totalPages = Math.ceil(total / limit);

    return successResponse(
      res,
      200,
      'Dietitian requests fetched successfully',
      rows.map(formatDietitianRow),
      { page, limit, total, totalPages },
    );
  } catch (err) {
    console.error('Get dietitian requests error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/admin/dietitian/:id
export const getDietitianDetails = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (!id || isNaN(id)) return errorResponse(res, 400, 'Invalid dietitian id');

    const dietitian = await findDietitianById(id);
    if (!dietitian) return errorResponse(res, 404, 'Dietitian not found');

    return successResponse(res, 200, 'Dietitian details fetched successfully', formatDietitianRow(dietitian));
  } catch (err) {
    console.error('Get dietitian details error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// PATCH /api/v1/admin/toggle-block-dietitian
// Body: { dietitian_id }
export const toggleBlockDietitian = async (req: Request, res: Response) => {
  try {
    const { dietitian_id } = req.body;
    if (!dietitian_id) return errorResponse(res, 400, 'dietitian_id is required');

    const dietitian = await findDietitianById(dietitian_id);
    if (!dietitian) return errorResponse(res, 404, 'Dietitian not found');

    const user = await findUserById(dietitian.user_id);
    if (!user) return errorResponse(res, 404, 'Associated user not found');

    const updated = await updateUser(user.id, { is_active: !user.is_active });

    return successResponse(res, 200, `Dietitian ${updated?.is_active ? 'unblocked' : 'blocked'} successfully`, {
      dietitian_id,
      user_id: user.id,
      is_active: updated?.is_active,
    });
  } catch (err) {
    console.error('Toggle block dietitian error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// DELETE /api/v1/admin/delete-dietitian
// Body: { dietitian_id }
export const deleteDietitian = async (req: Request, res: Response) => {
  try {
    const { dietitian_id } = req.body;
    if (!dietitian_id) return errorResponse(res, 400, 'dietitian_id is required');

    const dietitian = await findDietitianById(dietitian_id);
    if (!dietitian) return errorResponse(res, 404, 'Dietitian not found');

    await softDeleteUser(dietitian.user_id);

    return successResponse(res, 200, 'Dietitian deleted successfully');
  } catch (err) {
    console.error('Delete dietitian error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/admin/existing-users?page=1&limit=10&search=&status=active|blocked&startDate=&endDate=&sortBy=&sortOrder=
export const getUserList = async (req: Request, res: Response) => {
  try {
    const page      = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit     = Math.min(10000, Math.max(1, parseInt(req.query.limit as string) || 10));
    const search    = (req.query.search    as string | undefined)?.trim() || undefined;
    const status    = req.query.status    as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate   = req.query.endDate   as string | undefined;
    const sortBy    = req.query.sortBy    as string | undefined;
    const sortOrder = req.query.sortOrder as string | undefined;

    const { rows, total } = await getUsersPaginated({ page, limit, search, status, startDate, endDate, sortBy, sortOrder });
    const totalPages = Math.ceil(total / limit);

    return successResponse(res, 200, 'Users fetched successfully', rows, { page, limit, total, totalPages });
  } catch (err) {
    console.error('Get user list error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/admin/user/:id
export const getUserDetails = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (!id || isNaN(id)) return errorResponse(res, 400, 'Invalid user id');

    const user = await findUserById(id);
    if (!user) return errorResponse(res, 404, 'User not found');
    if (user.role !== 'user') return errorResponse(res, 400, 'This endpoint is for regular users only');

    const { password: _, is_delete: __, ...safeUser } = user as any;

    return successResponse(res, 200, 'User details fetched successfully', safeUser);
  } catch (err) {
    console.error('Get user details error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// PATCH /api/v1/admin/toggle-block-user
// Body: { user_id }
export const toggleBlockUser = async (req: Request, res: Response) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return errorResponse(res, 400, 'user_id is required');

    const user = await findUserById(user_id);
    if (!user) return errorResponse(res, 404, 'User not found');
    if (user.role !== 'user') return errorResponse(res, 400, 'User is not a regular user');

    const updated = await updateUser(user_id, { is_active: !user.is_active });

    return successResponse(res, 200, `User ${updated?.is_active ? 'unblocked' : 'blocked'} successfully`, {
      user_id,
      is_active: updated?.is_active,
    });
  } catch (err) {
    console.error('Toggle block user error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// DELETE /api/v1/admin/delete-user
// Body: { user_id }
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return errorResponse(res, 400, 'user_id is required');

    const user = await findUserById(user_id);
    if (!user) return errorResponse(res, 404, 'User not found');
    if (user.role !== 'user') return errorResponse(res, 400, 'User is not a regular user');

    await softDeleteUser(user_id);

    return successResponse(res, 200, 'User deleted successfully');
  } catch (err) {
    console.error('Delete user error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// PATCH /api/v1/admin/dietitians/verify
// Body: { dietitian_id }
export const verifyDietitianHandler = async (req: Request, res: Response) => {
  try {
    const { dietitian_id } = req.body;
    if (!dietitian_id) return errorResponse(res, 400, 'dietitian_id is required');

    const dietitian = await findDietitianById(dietitian_id);
    if (!dietitian) return errorResponse(res, 404, 'Dietitian not found');

    if (dietitian.is_verified) {
      return errorResponse(res, 400, 'Dietitian is already verified');
    }

    await verifyDietitian(dietitian_id);

    // 100 free AI diet plan credits on first verification (trial welcome bonus)
    void adminCreditPlanCredits(
      dietitian_id,
      100,
      Number(req.user?.sub),
      'Trial welcome bonus — 100 AI diet plan credits',
    ).catch((err) => console.error('Welcome plan credit failed:', err));

    // Fire-and-forget approval email; a mail failure must not fail the request.
    if (dietitian.email) {
      const { subject, html, text } = dietitianApprovedEmail(dietitian.full_name ?? '');
      void sendEmail({ to: dietitian.email, subject, html, text }).catch((mailErr) => {
        console.error('Dietitian approval email failed:', mailErr);
      });
    }

    return successResponse(res, 200, 'Dietitian verified successfully', { dietitian_id, is_verified: true });
  } catch (err) {
    console.error('Verify dietitian error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/admin/profile
export const getAdminProfile = async (req: Request, res: Response) => {
  try {
    const adminId = parseInt(req.user!.sub);
    const admin = await findUserById(adminId);
    if (!admin) return errorResponse(res, 404, 'Admin not found');

    const { password: _, is_delete: __, ...safeAdmin } = admin as any;

    return successResponse(res, 200, 'Profile fetched successfully', safeAdmin);
  } catch (err) {
    console.error('Get admin profile error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// PATCH /api/v1/admin/change-password
// Body: { current_password, new_password }
export const changeAdminPassword = async (req: Request, res: Response) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return errorResponse(res, 400, 'current_password and new_password are required');
    }

    if (new_password.length < 6) {
      return errorResponse(res, 400, 'new_password must be at least 6 characters');
    }

    if (current_password === new_password) {
      return errorResponse(res, 400, 'new_password must be different from current_password');
    }

    const adminId = parseInt(req.user!.sub);
    const admin = await findUserById(adminId);
    if (!admin) return errorResponse(res, 404, 'Admin not found');

    const isValid = await checkPassword(current_password, admin.password);
    if (!isValid) return errorResponse(res, 401, 'Current password is incorrect');

    await updateUserPassword(adminId, new_password);

    return successResponse(res, 200, 'Password changed successfully');
  } catch (err) {
    console.error('Change admin password error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// ── Dashboard helpers ─────────────────────────────────────────────────────────

interface DateRange {
  current: { from: string; to: string };
  prev:    { from: string; to: string };
}

const buildDateRange = (from?: string, to?: string): DateRange | null => {
  if (!from || !to) return null;
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);

  // Pure UTC arithmetic avoids local-timezone skew when computing the prev period
  const fromMs = Date.UTC(fy, fm - 1, fd);
  const toMs   = Date.UTC(ty, tm - 1, td);
  const days   = Math.round((toMs - fromMs) / 86_400_000) + 1;

  const prevToMs   = fromMs - 86_400_000;
  const prevFromMs = fromMs - days * 86_400_000;

  const fmtUTCDate = (ms: number): string => {
    const u = new Date(ms);
    return `${u.getUTCFullYear()}-${pad2(u.getUTCMonth() + 1)}-${pad2(u.getUTCDate())}`;
  };

  return {
    current: { from: istToUTC(from,                false), to: istToUTC(to,                 true) },
    prev:    { from: istToUTC(fmtUTCDate(prevFromMs), false), to: istToUTC(fmtUTCDate(prevToMs), true) },
  };
};

const pctChange = (cur: number, prev: number): { percent: number; direction: 'up' | 'down' } => {
  if (prev === 0) return { percent: cur > 0 ? 100 : 0, direction: 'up' };
  const pct = ((cur - prev) / prev) * 100;
  return { percent: Math.abs(parseFloat(pct.toFixed(1))), direction: pct >= 0 ? 'up' : 'down' };
};

const fmtPeriodLabel = (period: string, grpKey: string, weekStart?: string): string => {
  if (period === 'daily') {
    const d = new Date(`${grpKey}T00:00:00`);
    return `${d.toLocaleString('en', { month: 'short' })} ${d.getDate()}`;
  }
  if (period === 'weekly' && weekStart) {
    const s = new Date(`${weekStart}T00:00:00`);
    const e = new Date(s); e.setDate(s.getDate() + 6);
    const fd = (d: Date) => `${d.toLocaleString('en', { month: 'short' })} ${d.getDate()}`;
    return `${fd(s)}–${fd(e)}`;
  }
  if (period === 'monthly') {
    const [y, m] = grpKey.split('-');
    const d = new Date(Number(y), Number(m) - 1, 1);
    return `${d.toLocaleString('en', { month: 'short' })} ${y}`;
  }
  return grpKey; // quarterly ("2025-Q2") and yearly ("2025") returned as-is
};

// ── 1. Dashboard Summary Stats ────────────────────────────────────────────────

// GET /api/v1/admin/dashboard-stats?from=YYYY-MM-DD&to=YYYY-MM-DD
export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query as { from?: string; to?: string };
    const range = buildDateRange(from, to);

    // created_at is a DATETIME column → use UTC-converted datetime strings
    const curFilter = range ? 'AND created_at BETWEEN ? AND ?' : '';
    const curP      = range ? [range.current.from, range.current.to] : [];
    const prevP     = range ? [range.prev.from,    range.prev.to]    : [];

    // appointment_date is a DATETIME column storing IST midnight values →
    // compare with raw ISO date strings (same logic as getDashboardConsultations)
    const hasRange        = !!(from && to);
    const apptDateFilter  = hasRange ? 'AND appointment_date BETWEEN ? AND ?' : '';
    const apptCurP: string[]  = hasRange ? [from!, to!] : [];

    // prev period raw date strings for appointment_date comparison
    let apptPrevP: string[] = [];
    if (hasRange) {
      const [fy, fm, fd] = from!.split('-').map(Number);
      const [ty, tm, td] = to!.split('-').map(Number);
      const fromMs     = Date.UTC(fy, fm - 1, fd);
      const toMs       = Date.UTC(ty, tm - 1, td);
      const days       = Math.round((toMs - fromMs) / 86_400_000) + 1;
      const prevToMs   = fromMs - 86_400_000;
      const prevFromMs = fromMs - days * 86_400_000;
      const fmtDate    = (ms: number) => {
        const u = new Date(ms);
        return `${u.getUTCFullYear()}-${pad2(u.getUTCMonth() + 1)}-${pad2(u.getUTCDate())}`;
      };
      apptPrevP = [fmtDate(prevFromMs), fmtDate(prevToMs)];
    }

    // Same filter as the Consultations Overview graph
    const consultFilter = "appointment_source = 'platform' AND session_type = 'video_call' AND payment_status = 'paid' AND status != 'cancelled'";

    const [usersData, dietitiansData, consultationsData, revenueData, dietChartsData] = await Promise.all([
      query<{ total: number }>(`SELECT COUNT(*) AS total FROM users WHERE role = 'user' AND is_delete = 0 ${curFilter}`, curP),
      query<{ total: number }>(`SELECT COUNT(*) AS total FROM dietitians WHERE 1=1 ${curFilter}`, curP),
      query<{ total: number }>(`SELECT COUNT(*) AS total FROM appointments WHERE ${consultFilter} ${apptDateFilter}`, apptCurP),
      query<{ total: number }>(
        `SELECT (
           COALESCE((SELECT SUM(COALESCE(final_amount, amount)) FROM payments WHERE status = 'paid' AND diet_form_id IS NOT NULL ${curFilter}), 0) +
           COALESCE((SELECT SUM(amount) FROM dietitian_registration_payments WHERE status = 'paid' ${curFilter}), 0)
         ) AS total`,
        [...curP, ...curP],
      ),
      query<{ plan_type: number; cnt: number }>(
        `SELECT df.plan_type, COUNT(*) AS cnt
           FROM diet_forms df
           INNER JOIN payments p ON p.diet_form_id = df.id AND p.status = 'paid'
          WHERE 1=1 ${curFilter.replace('created_at', 'p.created_at')}
          GROUP BY df.plan_type`, curP),
    ]);

    const totalUsers         = Number(usersData[0]?.total         ?? 0);
    const totalDietitians    = Number(dietitiansData[0]?.total    ?? 0);
    const totalConsultations = Number(consultationsData[0]?.total ?? 0);
    const totalRevenue       = Number(revenueData[0]?.total       ?? 0);

    const byPlan: Record<string, number> = { '1': 0, '2': 0, '3': 0 };
    let totalDietCharts = 0;
    for (const row of dietChartsData) {
      byPlan[String(row.plan_type)] = Number(row.cnt);
      totalDietCharts += Number(row.cnt);
    }

    let changes = null;
    if (range) {
      const prevFilter = 'AND created_at BETWEEN ? AND ?';
      const [pu, pd, pc, pr, pdc] = await Promise.all([
        query<{ total: number }>(`SELECT COUNT(*) AS total FROM users WHERE role = 'user' AND is_delete = 0 ${prevFilter}`, prevP),
        query<{ total: number }>(`SELECT COUNT(*) AS total FROM dietitians WHERE 1=1 ${prevFilter}`, prevP),
        query<{ total: number }>(`SELECT COUNT(*) AS total FROM appointments WHERE ${consultFilter} AND appointment_date BETWEEN ? AND ?`, apptPrevP),
        query<{ total: number }>(
          `SELECT (
             COALESCE((SELECT SUM(COALESCE(final_amount, amount)) FROM payments WHERE status = 'paid' AND diet_form_id IS NOT NULL ${prevFilter}), 0) +
             COALESCE((SELECT SUM(amount) FROM dietitian_registration_payments WHERE status = 'paid' ${prevFilter}), 0)
           ) AS total`,
          [...prevP, ...prevP],
        ),
        query<{ total: number }>(
          `SELECT COUNT(*) AS total
             FROM diet_forms df
             INNER JOIN payments p ON p.diet_form_id = df.id AND p.status = 'paid'
            WHERE p.created_at BETWEEN ? AND ?`, prevP),
      ]);
      changes = {
        totalUsers:         pctChange(totalUsers,         Number(pu[0]?.total  ?? 0)),
        totalDietitians:    pctChange(totalDietitians,    Number(pd[0]?.total  ?? 0)),
        totalConsultations: pctChange(totalConsultations, Number(pc[0]?.total  ?? 0)),
        totalRevenue:       pctChange(totalRevenue,       Number(pr[0]?.total  ?? 0)),
        dietChartRequests:  pctChange(totalDietCharts,    Number(pdc[0]?.total ?? 0)),
      };
    }

    return successResponse(res, 200, 'Dashboard stats fetched successfully', {
      totalUsers,
      totalDietitians,
      totalConsultations,
      totalRevenue,
      dietChartRequests: { total: totalDietCharts, byPlan },
      changes,
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// ── 2. Revenue Overview Chart ─────────────────────────────────────────────────

// GET /api/v1/admin/dashboard-revenue?from=YYYY-MM-DD&to=YYYY-MM-DD&period=daily|weekly|monthly
export const getDashboardRevenue = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query as { from?: string; to?: string };
    const period       = ['daily', 'weekly', 'monthly'].includes(req.query.period as string)
      ? (req.query.period as string) : 'daily';
    const range = buildDateRange(from, to);

    const dateFilter = range ? 'AND created_at BETWEEN ? AND ?' : '';
    const curP       = range ? [range.current.from, range.current.to] : [];
    const prevP      = range ? [range.prev.from,    range.prev.to]    : [];

    interface RevRow { grp_key: string; week_start?: string; revenue: number; }

    // Group by IST date so chart buckets match the admin's IST day/week/month.
    // created_at is stored in UTC → CONVERT_TZ shifts it to IST before grouping.
    // Each chart query UNIONs diet-form payments + dietitian registration payments.
    let chartSQL: string;
    if (period === 'weekly') {
      chartSQL = `
        SELECT grp_key, MIN(week_start) AS week_start, SUM(revenue) AS revenue FROM (
          SELECT CAST(YEARWEEK(CONVERT_TZ(created_at, '+00:00', '+05:30'), 1) AS CHAR) AS grp_key,
                 DATE_FORMAT(MIN(CONVERT_TZ(created_at, '+00:00', '+05:30')), '%Y-%m-%d') AS week_start,
                 COALESCE(SUM(COALESCE(final_amount, amount)), 0) AS revenue
            FROM payments WHERE status = 'paid' AND diet_form_id IS NOT NULL ${dateFilter}
           GROUP BY YEARWEEK(CONVERT_TZ(created_at, '+00:00', '+05:30'), 1)
          UNION ALL
          SELECT CAST(YEARWEEK(CONVERT_TZ(created_at, '+00:00', '+05:30'), 1) AS CHAR) AS grp_key,
                 DATE_FORMAT(MIN(CONVERT_TZ(created_at, '+00:00', '+05:30')), '%Y-%m-%d') AS week_start,
                 COALESCE(SUM(amount), 0) AS revenue
            FROM dietitian_registration_payments WHERE status = 'paid' ${dateFilter}
           GROUP BY YEARWEEK(CONVERT_TZ(created_at, '+00:00', '+05:30'), 1)
        ) combined
        GROUP BY grp_key ORDER BY grp_key ASC`;
    } else if (period === 'monthly') {
      chartSQL = `
        SELECT grp_key, SUM(revenue) AS revenue FROM (
          SELECT DATE_FORMAT(CONVERT_TZ(created_at, '+00:00', '+05:30'), '%Y-%m') AS grp_key,
                 COALESCE(SUM(COALESCE(final_amount, amount)), 0) AS revenue
            FROM payments WHERE status = 'paid' AND diet_form_id IS NOT NULL ${dateFilter}
           GROUP BY DATE_FORMAT(CONVERT_TZ(created_at, '+00:00', '+05:30'), '%Y-%m')
          UNION ALL
          SELECT DATE_FORMAT(CONVERT_TZ(created_at, '+00:00', '+05:30'), '%Y-%m') AS grp_key,
                 COALESCE(SUM(amount), 0) AS revenue
            FROM dietitian_registration_payments WHERE status = 'paid' ${dateFilter}
           GROUP BY DATE_FORMAT(CONVERT_TZ(created_at, '+00:00', '+05:30'), '%Y-%m')
        ) combined
        GROUP BY grp_key ORDER BY grp_key ASC`;
    } else {
      chartSQL = `
        SELECT grp_key, SUM(revenue) AS revenue FROM (
          SELECT DATE_FORMAT(CONVERT_TZ(created_at, '+00:00', '+05:30'), '%Y-%m-%d') AS grp_key,
                 COALESCE(SUM(COALESCE(final_amount, amount)), 0) AS revenue
            FROM payments WHERE status = 'paid' AND diet_form_id IS NOT NULL ${dateFilter}
           GROUP BY DATE(CONVERT_TZ(created_at, '+00:00', '+05:30'))
          UNION ALL
          SELECT DATE_FORMAT(CONVERT_TZ(created_at, '+00:00', '+05:30'), '%Y-%m-%d') AS grp_key,
                 COALESCE(SUM(amount), 0) AS revenue
            FROM dietitian_registration_payments WHERE status = 'paid' ${dateFilter}
           GROUP BY DATE(CONVERT_TZ(created_at, '+00:00', '+05:30'))
        ) combined
        GROUP BY grp_key ORDER BY grp_key ASC`;
    }

    const dietRegFilter = range ? 'AND created_at BETWEEN ? AND ?' : '';

    const [chartRows, totalData, prevData, dietRegData] = await Promise.all([
      query<RevRow>(chartSQL, [...curP, ...curP]),
      query<{ total: number }>(
        `SELECT (
           COALESCE((SELECT SUM(COALESCE(final_amount, amount)) FROM payments WHERE status = 'paid' AND diet_form_id IS NOT NULL ${dateFilter}), 0) +
           COALESCE((SELECT SUM(amount) FROM dietitian_registration_payments WHERE status = 'paid' ${dateFilter}), 0)
         ) AS total`,
        [...curP, ...curP],
      ),
      range
        ? query<{ total: number }>(
            `SELECT (
               COALESCE((SELECT SUM(COALESCE(final_amount, amount)) FROM payments WHERE status = 'paid' AND diet_form_id IS NOT NULL AND created_at BETWEEN ? AND ?), 0) +
               COALESCE((SELECT SUM(amount) FROM dietitian_registration_payments WHERE status = 'paid' AND created_at BETWEEN ? AND ?), 0)
             ) AS total`,
            [...prevP, ...prevP],
          )
        : Promise.resolve([{ total: 0 }]),
      query<{ count: number }>(
        `SELECT COUNT(*) AS count FROM dietitians ${dietRegFilter ? `WHERE ${dietRegFilter.replace('AND ', '')}` : ''}`,
        curP,
      ),
    ]);

    const total                  = Number(totalData[0]?.total    ?? 0);
    const prevTotal              = Number(prevData[0]?.total     ?? 0);
    const dietitianRegistrations = Number(dietRegData[0]?.count  ?? 0);

    return successResponse(res, 200, 'Dashboard revenue fetched successfully', {
      total,
      change: range ? pctChange(total, prevTotal) : null,
      dietitianRegistrations,
      data: chartRows.map(r => ({ label: fmtPeriodLabel(period, r.grp_key, r.week_start), revenue: Number(r.revenue) })),
    });
  } catch (err) {
    console.error('Dashboard revenue error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// ── 3. User Growth Chart ──────────────────────────────────────────────────────

// GET /api/v1/admin/dashboard-user-growth?from=YYYY-MM-DD&to=YYYY-MM-DD&period=weekly|monthly|quarterly|yearly
export const getDashboardUserGrowth = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query as { from?: string; to?: string };
    const period       = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'].includes(req.query.period as string)
      ? (req.query.period as string) : 'monthly';
    const range = buildDateRange(from, to);

    const dateFilter = range ? 'AND created_at BETWEEN ? AND ?' : '';
    const curP       = range ? [range.current.from, range.current.to] : [];
    const prevP      = range ? [range.prev.from,    range.prev.to]    : [];

    interface GrowthRow { grp_key: string; week_start?: string; newUsers: number; }

    // Group by IST date so chart buckets match the admin's IST day/week/month.
    // created_at is stored in UTC → CONVERT_TZ shifts it to IST before grouping.
    let chartSQL: string;
    if (period === 'daily') {
      chartSQL = `
        SELECT DATE_FORMAT(CONVERT_TZ(created_at, '+00:00', '+05:30'), '%Y-%m-%d') AS grp_key,
               COUNT(*) AS newUsers
          FROM users WHERE role = 'user' AND is_delete = 0 ${dateFilter}
         GROUP BY DATE(CONVERT_TZ(created_at, '+00:00', '+05:30'))
         ORDER BY grp_key ASC`;
    } else if (period === 'weekly') {
      chartSQL = `
        SELECT CAST(YEARWEEK(CONVERT_TZ(created_at, '+00:00', '+05:30'), 1) AS CHAR) AS grp_key,
               DATE_FORMAT(MIN(CONVERT_TZ(created_at, '+00:00', '+05:30')), '%Y-%m-%d') AS week_start,
               COUNT(*) AS newUsers
          FROM users WHERE role = 'user' AND is_delete = 0 ${dateFilter}
         GROUP BY YEARWEEK(CONVERT_TZ(created_at, '+00:00', '+05:30'), 1)
         ORDER BY YEARWEEK(CONVERT_TZ(created_at, '+00:00', '+05:30'), 1) ASC`;
    } else if (period === 'quarterly') {
      chartSQL = `
        SELECT CONCAT(YEAR(CONVERT_TZ(created_at, '+00:00', '+05:30')), '-Q', QUARTER(CONVERT_TZ(created_at, '+00:00', '+05:30'))) AS grp_key,
               COUNT(*) AS newUsers
          FROM users WHERE role = 'user' AND is_delete = 0 ${dateFilter}
         GROUP BY YEAR(CONVERT_TZ(created_at, '+00:00', '+05:30')), QUARTER(CONVERT_TZ(created_at, '+00:00', '+05:30'))
         ORDER BY YEAR(CONVERT_TZ(created_at, '+00:00', '+05:30')) ASC, QUARTER(CONVERT_TZ(created_at, '+00:00', '+05:30')) ASC`;
    } else if (period === 'yearly') {
      chartSQL = `
        SELECT CAST(YEAR(CONVERT_TZ(created_at, '+00:00', '+05:30')) AS CHAR) AS grp_key,
               COUNT(*) AS newUsers
          FROM users WHERE role = 'user' AND is_delete = 0 ${dateFilter}
         GROUP BY YEAR(CONVERT_TZ(created_at, '+00:00', '+05:30'))
         ORDER BY grp_key ASC`;
    } else {
      chartSQL = `
        SELECT DATE_FORMAT(CONVERT_TZ(created_at, '+00:00', '+05:30'), '%Y-%m') AS grp_key,
               COUNT(*) AS newUsers
          FROM users WHERE role = 'user' AND is_delete = 0 ${dateFilter}
         GROUP BY DATE_FORMAT(CONVERT_TZ(created_at, '+00:00', '+05:30'), '%Y-%m')
         ORDER BY grp_key ASC`;
    }

    const [chartRows, totalData, prevData] = await Promise.all([
      query<GrowthRow>(chartSQL, curP),
      query<{ total: number }>(`SELECT COUNT(*) AS total FROM users WHERE role = 'user' AND is_delete = 0 ${dateFilter}`, curP),
      range
        ? query<{ total: number }>(`SELECT COUNT(*) AS total FROM users WHERE role = 'user' AND is_delete = 0 AND created_at BETWEEN ? AND ?`, prevP)
        : Promise.resolve([{ total: 0 }]),
    ]);

    const total     = Number(totalData[0]?.total ?? 0);
    const prevTotal = Number(prevData[0]?.total  ?? 0);

    return successResponse(res, 200, 'Dashboard user growth fetched successfully', {
      total,
      change: range ? pctChange(total, prevTotal) : null,
      data: chartRows.map(r => ({ label: fmtPeriodLabel(period, r.grp_key, r.week_start), newUsers: Number(r.newUsers) })),
    });
  } catch (err) {
    console.error('Dashboard user growth error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// ── 4. Consultations Overview Chart ──────────────────────────────────────────

// GET /api/v1/admin/dashboard-consultations?from=YYYY-MM-DD&to=YYYY-MM-DD&period=daily|weekly
export const getDashboardConsultations = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query as { from?: string; to?: string };
    const period       = ['daily', 'weekly', 'monthly'].includes(req.query.period as string)
      ? (req.query.period as string) : 'daily';

    // appointment_date is a DATE column (IST dates stored as-is, not UTC DATETIME).
    // Compare directly with raw ISO date strings — no UTC conversion needed.
    const hasRange   = !!(from && to);
    const dateFilter = hasRange ? 'AND appointment_date BETWEEN ? AND ?' : '';
    const curP: string[] = hasRange ? [from!, to!] : [];

    // Compute prev period as raw ISO date strings
    let prevP: string[] = [];
    if (hasRange) {
      const [fy, fm, fd] = from!.split('-').map(Number);
      const [ty, tm, td] = to!.split('-').map(Number);
      const fromMs     = Date.UTC(fy, fm - 1, fd);
      const toMs       = Date.UTC(ty, tm - 1, td);
      const days       = Math.round((toMs - fromMs) / 86_400_000) + 1;
      const prevToMs   = fromMs - 86_400_000;
      const prevFromMs = fromMs - days * 86_400_000;
      const fmtDate    = (ms: number) => {
        const u = new Date(ms);
        return `${u.getUTCFullYear()}-${pad2(u.getUTCMonth() + 1)}-${pad2(u.getUTCDate())}`;
      };
      prevP = [fmtDate(prevFromMs), fmtDate(prevToMs)];
    }

    // Only paid, non-cancelled online video-call appointments
    const baseFilter = "appointment_source = 'platform' AND session_type = 'video_call' AND payment_status = 'paid' AND status != 'cancelled'";

    interface ConsRow { grp_key: string; week_start?: string; count: number; }

    let chartSQL: string;
    if (period === 'weekly') {
      chartSQL = `SELECT CAST(YEARWEEK(appointment_date, 1) AS CHAR) AS grp_key,
                         DATE_FORMAT(MIN(appointment_date), '%Y-%m-%d') AS week_start,
                         COUNT(*) AS count
                    FROM appointments WHERE ${baseFilter} ${dateFilter}
                   GROUP BY YEARWEEK(appointment_date, 1)
                   ORDER BY YEARWEEK(appointment_date, 1) ASC`;
    } else if (period === 'monthly') {
      chartSQL = `SELECT DATE_FORMAT(appointment_date, '%Y-%m') AS grp_key,
                         COUNT(*) AS count
                    FROM appointments WHERE ${baseFilter} ${dateFilter}
                   GROUP BY DATE_FORMAT(appointment_date, '%Y-%m')
                   ORDER BY grp_key ASC`;
    } else {
      chartSQL = `SELECT DATE_FORMAT(appointment_date, '%Y-%m-%d') AS grp_key,
                         COUNT(*) AS count
                    FROM appointments WHERE ${baseFilter} ${dateFilter}
                   GROUP BY DATE(appointment_date)
                   ORDER BY grp_key ASC`;
    }

    const [chartRows, totalData, prevData, breakdownData] = await Promise.all([
      query<ConsRow>(chartSQL, curP),
      query<{ total: number }>(`SELECT COUNT(*) AS total FROM appointments WHERE ${baseFilter} ${dateFilter}`, curP),
      hasRange
        ? query<{ total: number }>(`SELECT COUNT(*) AS total FROM appointments WHERE ${baseFilter} AND appointment_date BETWEEN ? AND ?`, prevP)
        : Promise.resolve([{ total: 0 }]),
      query<{ status: string; cnt: number }>(
        `SELECT status, COUNT(*) AS cnt FROM appointments WHERE ${baseFilter} ${dateFilter} GROUP BY status`,
        curP,
      ),
    ]);

    const total     = Number(totalData[0]?.total ?? 0);
    const prevTotal = Number(prevData[0]?.total  ?? 0);

    const statusMap: Record<string, number> = {};
    for (const row of breakdownData) statusMap[row.status] = Number(row.cnt);
    // missed = paid session that wasn't attended — counts as completed from revenue perspective
    const completed = (statusMap['completed'] ?? 0) + (statusMap['missed'] ?? 0);
    const scheduled = (statusMap['pending'] ?? 0) + (statusMap['confirmed'] ?? 0);
    const bdTotal   = completed + scheduled;
    const safePct   = (n: number) => bdTotal === 0 ? 0 : parseFloat(((n / bdTotal) * 100).toFixed(1));

    return successResponse(res, 200, 'Dashboard consultations fetched successfully', {
      total,
      change: hasRange ? pctChange(total, prevTotal) : null,
      data: chartRows.map(r => ({ label: fmtPeriodLabel(period, r.grp_key, r.week_start), count: Number(r.count) })),
      breakdown: {
        completed: { count: completed, percent: safePct(completed) },
        scheduled: { count: scheduled, percent: safePct(scheduled) },
      },
    });
  } catch (err) {
    console.error('Dashboard consultations error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// ── 6. System Overview ────────────────────────────────────────────────────────

// GET /api/v1/admin/system-overview  (no date filter)
export const getSystemOverview = async (_req: Request, res: Response) => {
  try {
    // DB health check
    let databaseStatus = 'healthy';
    try { await query('SELECT 1'); } catch { databaseStatus = 'unhealthy'; }

    const [activeData, ticketsData] = await Promise.all([
      query<{ total: number }>(`SELECT COUNT(*) AS total FROM users WHERE role = 'user' AND is_active = 1 AND is_delete = 0`),
      query<{ total: number }>(`SELECT COUNT(*) AS total FROM contact_us WHERE is_read = 0`),
    ]);

    // Human-readable server uptime
    const sec  = Math.floor(process.uptime());
    const days = Math.floor(sec / 86400);
    const hrs  = Math.floor((sec % 86400) / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const serverUptime = days > 0 ? `${days}d ${hrs}h` : hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;

    return successResponse(res, 200, 'System overview fetched successfully', {
      serverUptime,
      activeUsers:        Number(activeData[0]?.total   ?? 0),
      databaseStatus,
      openSupportTickets: Number(ticketsData[0]?.total  ?? 0),
    });
  } catch (err) {
    console.error('System overview error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// POST /api/v1/admin/dietitians/register
export const adminRegisterDietitian = async (req: Request, res: Response) => {
  try {
    const {
      fullName, email, phone, password, state, city, experience,
      registrationNumber, specialization, dateOfBirth, gender, bio,
      languages, services, degrees, awards, availability, documents,
    } = req.body as {
      fullName?: string; email?: string; phone?: string; password?: string;
      state?: string; city?: string; experience?: string;
      registrationNumber?: string;
      specialization?: string[];
      dateOfBirth?: string; gender?: string; bio?: string;
      languages?: string[]; services?: string[];
      degrees?: { degree: string; institute: string; year: string | null }[];
      awards?: { title: string; organization: string; year: string | null }[];
      availability?: Record<string, string[]>;
      documents?: {
        profilePhoto?: string; degreeCertificate?: string;
        registrationCertificate?: string; idProof?: string; experienceCertificate?: string;
      };
    };

    if (!fullName?.trim())    return errorResponse(res, 400, 'fullName is required');
    if (!email?.trim())       return errorResponse(res, 400, 'email is required');
    if (!phone?.trim())       return errorResponse(res, 400, 'phone is required');
    if (!password?.trim())    return errorResponse(res, 400, 'password is required');
    if (password.length < 6)  return errorResponse(res, 400, 'password must be at least 6 characters');
    if (!state?.trim())       return errorResponse(res, 400, 'state is required');
    if (!city?.trim())        return errorResponse(res, 400, 'city is required');
    if (!experience?.trim())  return errorResponse(res, 400, 'experience is required');

    const normalizedPhone = phone.replace(/\D/g, '').replace(/^91/, '').slice(-10);
    if (normalizedPhone.length !== 10) return errorResponse(res, 400, 'Enter a valid 10-digit Indian mobile number');

    const existingEmail = await findUserByEmail(email.trim());
    if (existingEmail) return errorResponse(res, 409, 'Email is already registered');

    const existingPhone = await findUserByPhoneNumber(normalizedPhone);
    if (existingPhone) return errorResponse(res, 409, 'Phone number is already registered');

    const regNumber = (!registrationNumber || registrationNumber.trim().toUpperCase() === 'N/A')
      ? null
      : registrationNumber.trim();

    if (regNumber) {
      const existingReg = await findDietitianByRegistrationNumber(regNumber);
      if (existingReg) return errorResponse(res, 409, 'Registration number is already used');
    }

    const nullIfEmpty = (val: string | null | undefined): string | null =>
      val && val.trim() !== '' ? val.trim() : null;

    const user = await createUser({
      full_name:    fullName.trim(),
      email:        email.trim().toLowerCase(),
      password:     password,
      phone_code:   '+91',
      phone_number: normalizedPhone,
      role:         'dietitian',
    });
    if (!user) return errorResponse(res, 500, 'Failed to create user account');

    const cleanedDegrees = degrees
      ?.map((d) => ({ ...d, institute: nullIfEmpty(d.institute) ?? '', year: nullIfEmpty(d.year) }))
      ?? null;

    const cleanedAwards = awards
      ?.map((a) => ({ ...a, organization: nullIfEmpty(a.organization) ?? '', year: nullIfEmpty(a.year) }))
      ?? null;

    const dietitian = await createDietitian({
      user_id:                  user.id,
      state:                    state.trim(),
      city:                     city.trim(),
      registration_number:      regNumber,
      experience:               experience.trim(),
      specialization:           specialization ?? [],
      date_of_birth:            nullIfEmpty(dateOfBirth),
      gender:                   nullIfEmpty(gender),
      bio:                      nullIfEmpty(bio),
      languages:                languages ?? null,
      services:                 services ?? null,
      degrees:                  cleanedDegrees,
      awards:                   cleanedAwards,
      availability:             availability ?? null,
      profile_photo:            nullIfEmpty(documents?.profilePhoto),
      degree_certificate:       nullIfEmpty(documents?.degreeCertificate),
      registration_certificate: nullIfEmpty(documents?.registrationCertificate),
      id_proof:                 nullIfEmpty(documents?.idProof),
      experience_certificate:   nullIfEmpty(documents?.experienceCertificate),
    });
    if (!dietitian) return errorResponse(res, 500, 'Failed to create dietitian profile');

    if (user.email) {
      const { subject, html, text } = dietitianWelcomeEmail(user.full_name ?? fullName);
      void sendEmail({ to: user.email, subject, html, text }).catch((err) => {
        console.error('Admin register dietitian welcome email failed:', err);
      });
    }

    return successResponse(res, 201, 'Dietitian registered successfully', {
      user: {
        id:           user.id,
        full_name:    user.full_name,
        email:        user.email,
        phone_number: user.phone_number,
        role:         user.role,
      },
      dietitian: {
        id:                  dietitian.id,
        state:               dietitian.state,
        city:                dietitian.city,
        registration_number: dietitian.registration_number,
        experience:          dietitian.experience,
        specialization:      dietitian.specialization,
        degrees:             dietitian.degrees,
        is_verified:         dietitian.is_verified,
        documents: {
          profile_photo:            dietitian.profile_photo,
          degree_certificate:       dietitian.degree_certificate,
          registration_certificate: dietitian.registration_certificate,
          id_proof:                 dietitian.id_proof,
          experience_certificate:   dietitian.experience_certificate,
        },
      },
    });
  } catch (err) {
    console.error('adminRegisterDietitian error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};
