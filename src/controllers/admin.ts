import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { findUserByEmail, findUserById, checkPassword, updateUser, softDeleteUser, updateUserPassword, getUsersPaginated } from '../models/User';
import { getAllDietitians, findDietitianById, verifyDietitian, formatDietitianRow } from '../models/Dietitian';
import { query } from '../config/database';
import { findDietFormById, type DietForm } from '../models/DietForm';
import { findDietPlanByFormId } from '../models/DietPlan';
import { env } from '../config/env';
import { successResponse, errorResponse } from '../utils/response';
import { sendEmail } from '../services/email';
import { dietitianApprovedEmail } from '../services/emails/dietitianApproved';

const generateAccessToken = (userId: number, email: string | null, role: string) => {
  return jwt.sign(
    { sub: userId, email, role },
    env.JWT_SECRET,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN } as any,
  );
};

const generateRefreshToken = (userId: number, email: string | null, role: string) => {
  return jwt.sign(
    { sub: userId, email, role },
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

    const accessToken = generateAccessToken(user.id, user.email, user.role);
    const refreshToken = generateRefreshToken(user.id, user.email, user.role);

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

    let payload: { sub: string; email: string | null; role: string };
    try {
      payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as typeof payload;
    } catch {
      return errorResponse(res, 401, 'Invalid or expired refresh token');
    }

    const user = await findUserById(Number(payload.sub));
    if (!user || user.role !== 'admin') return errorResponse(res, 401, 'Invalid refresh token');
    if (!user.is_active) return errorResponse(res, 403, 'Account is deactivated. Please contact support.');

    const accessToken = generateAccessToken(user.id, user.email, user.role);
    const newRefreshToken = generateRefreshToken(user.id, user.email, user.role);

    return successResponse(res, 200, 'Token refreshed', {
      tokens: { accessToken, refreshToken: newRefreshToken },
    });
  } catch (err) {
    console.error('Refresh admin token error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/admin/dietitians?page=1&limit=10  (verified only)
export const getDietitianList = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));

    const { rows, total } = await getAllDietitians(page, limit, 1);
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

// GET /api/v1/admin/dietitian-requests?page=1&limit=10  (pending / not yet verified)
export const getDietitianRequests = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));

    const { rows, total } = await getAllDietitians(page, limit, 0);
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

// GET /api/v1/admin/existing-users?page=1&limit=10
export const getUserList = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));

    const { rows, total } = await getUsersPaginated(page, limit);
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

// GET /api/v1/admin/diet-form-requests?page=1&limit=10&status=completed&plan_type=1&from=YYYY-MM-DD&to=YYYY-MM-DD
export const getDietFormRequests = async (req: Request, res: Response) => {
  try {
    const page      = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit     = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
    const status    = req.query.status    as string | undefined;
    const plan_type = req.query.plan_type as string | undefined;
    const from      = req.query.from      as string | undefined;
    const to        = req.query.to        as string | undefined;
    const offset    = (page - 1) * limit;

    const validStatuses  = ['pending', 'generating', 'completed', 'failed'];
    const validPlanTypes = ['1', '2', '3'];

    // 'pending' = a request form with no generated plan yet
    const statusFilter  = status && validStatuses.includes(status)
      ? (status === 'pending' ? `AND dp.id IS NULL` : `AND dp.status = '${status}'`)
      : '';

    const planFilter = plan_type && validPlanTypes.includes(plan_type)
      ? `AND df.plan_type = ${parseInt(plan_type)}`
      : '';

    const queryParams: string[] = [];
    let dateFilter = '';
    if (from && to) {
      dateFilter = 'AND df.created_at BETWEEN ? AND ?';
      queryParams.push(`${from} 00:00:00`, `${to} 23:59:59`);
    }

    const baseWhere = `WHERE 1=1 ${statusFilter} ${planFilter} ${dateFilter}`;

    const rows = await query<DietForm & { plan_id: number | null; status: string }>(
      `SELECT
        df.*,
        dp.id AS plan_id,
        COALESCE(dp.status, 'pending') AS status
       FROM diet_forms df
       LEFT JOIN diet_plans dp ON dp.id = (
         SELECT id FROM diet_plans WHERE form_id = df.id ORDER BY created_at DESC LIMIT 1
       )
       ${baseWhere}
       ORDER BY df.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      queryParams,
    );

    // Parse JSON-encoded columns stored as strings
    const JSON_FIELDS = ['goals', 'cuisine_preference', 'food_allergies', 'medical_conditions', 'delivery_method'];
    const data = rows.map((row) => {
      const r = row as unknown as Record<string, unknown>;
      for (const field of JSON_FIELDS) {
        if (typeof r[field] === 'string') {
          try { r[field] = JSON.parse(r[field] as string); } catch { /* leave as-is */ }
        }
      }
      return row;
    });

    const countRows = await query<{ total: number }>(
      `SELECT COUNT(*) AS total
         FROM diet_forms df
         LEFT JOIN diet_plans dp ON dp.id = (
           SELECT id FROM diet_plans WHERE form_id = df.id ORDER BY created_at DESC LIMIT 1
         )
       ${baseWhere}`,
      queryParams,
    );

    const total      = countRows[0]?.total ?? 0;
    const totalPages = Math.ceil(total / limit);

    return successResponse(res, 200, 'Diet form requests fetched successfully', data, {
      page, limit, total, totalPages,
    });
  } catch (err) {
    console.error('Get diet chart requests error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/admin/diet-form-requests/:form_id/details
export const getDietChartDetails = async (req: Request, res: Response) => {
  try {
    const form_id = parseInt(req.params.form_id);
    if (isNaN(form_id)) return errorResponse(res, 400, 'Invalid form_id');

    // Get full diet form
    const form = await findDietFormById(form_id);
    if (!form) return errorResponse(res, 404, 'Diet form not found');

    // Get user details if linked
    let user = null;
    if (form.user_id) {
      const u = await findUserById(form.user_id);
      if (u) {
        const { password: _, is_delete: __, ...safeUser } = u as unknown as Record<string, unknown>;
        user = safeUser;
      }
    }

    // Get generated diet plan if exists
    const plan = await findDietPlanByFormId(form_id);

    return successResponse(res, 200, 'Diet chart details fetched successfully', {
      form: {
        // Identity
        id:            form.id,
        user_id:       form.user_id,
        plan_type:     form.plan_type,

        // Step 1 — Basic Details
        full_name:     form.full_name,
        age:           form.age,
        gender:        form.gender,
        dob:           form.dob,
        height:        form.height,
        height_unit:   form.height_unit,
        weight:        form.weight,
        weight_unit:   form.weight_unit,
        goals:         form.goals,

        // Step 2 — Lifestyle
        activity_level: form.activity_level,
        work_type:      form.work_type,
        workout_type:   form.workout_type,

        // Step 3 — Food Preferences
        diet_type:          form.diet_type,
        cuisine_preference: form.cuisine_preference,
        food_allergies:     form.food_allergies,
        foods_dislike:      form.foods_dislike,
        favorite_foods:     form.favorite_foods,

        // Step 4 — Health & Medical
        medical_conditions: form.medical_conditions,
        other_condition:    form.other_condition,
        on_medication:      form.on_medication,
        medications:        form.medications,
        digestive_health:   form.digestive_health,
        smoke_alcohol:      form.smoke_alcohol,
        health_notes:       form.health_notes,

        // Step 5 — Contact
        contact_name:    form.contact_name,
        whatsapp:        form.whatsapp,
        email:           form.email,
        delivery_method: form.delivery_method,
        city:            form.city,
        state:           form.state,
        state_code:      form.state_code,
        final_notes:     form.final_notes,

        created_at: form.created_at,
        updated_at: form.updated_at,
      },
      user,
      diet_plan: plan ? {
        plan_id:          plan.id,
        status:           plan.status,
        bmi:              plan.bmi,
        bmi_category:     plan.bmi_category,
        bmr:              plan.bmr,
        tdee:             plan.tdee,
        client_profile:   plan.client_profile,
        summary: {
          client_name:      plan.client_name,
          calorie_range:    plan.calorie_range,
          protein_target_g: plan.protein_target_g,
          carbs_target_g:   plan.carbs_target_g,
          fat_target_g:     plan.fat_target_g,
          primary_goal:     plan.primary_goal,
          plan_duration:    plan.plan_duration,
          diet_type:        plan.diet_type,
        },
        hydration_guide:  plan.hydration_guide,
        weeks:            plan.weeks,
        general_tips:     plan.general_tips,
        featured_recipes: plan.featured_recipes,
        created_at:       plan.created_at,
      } : null,
    });
  } catch (err) {
    console.error('Get diet chart details error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/admin/diet-form-requests/:form_id/preview
// Preview the AI-generated diet plan for a given form
export const previewDietPlan = async (req: Request, res: Response) => {
  try {
    const form_id = parseInt(req.params.form_id);
    if (isNaN(form_id)) return errorResponse(res, 400, 'Invalid form_id');

    // Make sure the request form exists
    const form = await findDietFormById(form_id);
    if (!form) return errorResponse(res, 404, 'Diet form not found');

    // Get the latest generated diet plan for this form
    const plan = await findDietPlanByFormId(form_id);
    if (!plan) {
      return errorResponse(res, 404, 'Diet chart has not been generated for this request yet');
    }

    // Generation still in progress
    if (plan.status === 'generating') {
      return successResponse(res, 202, 'Diet chart is still being generated', {
        plan_id: plan.id,
        status:  plan.status,
      });
    }

    // Generation failed
    if (plan.status === 'failed') {
      return errorResponse(res, 409, 'Diet chart generation failed for this request');
    }

    // status === 'completed' — return the full AI-generated plan
    return successResponse(res, 200, 'Diet plan generated successfully', {
      plan_id:          plan.id,
      form_id:          plan.form_id,
      client_profile:   plan.client_profile,
      summary: {
        client_name:      plan.client_name,
        calorie_range:    plan.calorie_range,
        protein_target_g: plan.protein_target_g,
        carbs_target_g:   plan.carbs_target_g,
        fat_target_g:     plan.fat_target_g,
        primary_goal:     plan.primary_goal,
        plan_duration:    plan.plan_duration,
        diet_type:        plan.diet_type,
      },
      weeks:            plan.weeks,
      hydration_guide:  plan.hydration_guide,
      general_tips:     plan.general_tips,
      featured_recipes: plan.featured_recipes,
    });
  } catch (err) {
    console.error('Preview diet plan error:', err);
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
  const fromDate = new Date(from);
  const toDate   = new Date(to);
  const days     = Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1;

  const prevTo   = new Date(fromDate); prevTo.setDate(prevTo.getDate() - 1);
  const prevFrom = new Date(fromDate); prevFrom.setDate(prevFrom.getDate() - days);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return {
    current: { from: `${from} 00:00:00`,        to: `${to} 23:59:59`              },
    prev:    { from: `${fmt(prevFrom)} 00:00:00`, to: `${fmt(prevTo)} 23:59:59`   },
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
    return `${d.getDate()} ${d.toLocaleString('en', { month: 'short' })}`;
  }
  if (period === 'weekly' && weekStart) {
    const s = new Date(`${weekStart}T00:00:00`);
    const e = new Date(s); e.setDate(s.getDate() + 6);
    const fd = (d: Date) => `${d.getDate()} ${d.toLocaleString('en', { month: 'short' })}`;
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

    const curFilter = range ? 'AND created_at BETWEEN ? AND ?' : '';
    const curP      = range ? [range.current.from, range.current.to] : [];
    const prevP     = range ? [range.prev.from,    range.prev.to]    : [];

    const [usersData, dietitiansData, consultationsData, revenueData, dietChartsData] = await Promise.all([
      query<{ total: number }>(`SELECT COUNT(*) AS total FROM users WHERE role = 'user' AND is_delete = 0 ${curFilter}`, curP),
      query<{ total: number }>(`SELECT COUNT(*) AS total FROM dietitians WHERE 1=1 ${curFilter}`, curP),
      query<{ total: number }>(`SELECT COUNT(*) AS total FROM appointments WHERE 1=1 ${curFilter}`, curP),
      query<{ total: number }>(`SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE status = 'paid' ${curFilter}`, curP),
      query<{ plan_type: number; cnt: number }>(
        `SELECT df.plan_type, COUNT(*) AS cnt
           FROM diet_forms df
           INNER JOIN payments p ON p.diet_form_id = df.id AND p.status = 'paid'
          WHERE 1=1 ${curFilter.replace('created_at', 'df.created_at')}
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
        query<{ total: number }>(`SELECT COUNT(*) AS total FROM appointments WHERE 1=1 ${prevFilter}`, prevP),
        query<{ total: number }>(`SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE status = 'paid' ${prevFilter}`, prevP),
        query<{ total: number }>(
          `SELECT COUNT(*) AS total
             FROM diet_forms df
             INNER JOIN payments p ON p.diet_form_id = df.id AND p.status = 'paid'
            WHERE df.created_at BETWEEN ? AND ?`, prevP),
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

    let chartSQL: string;
    if (period === 'weekly') {
      chartSQL = `
        SELECT CAST(YEARWEEK(created_at, 1) AS CHAR) AS grp_key,
               DATE_FORMAT(MIN(created_at), '%Y-%m-%d') AS week_start,
               COALESCE(SUM(amount), 0) AS revenue
          FROM payments WHERE status = 'paid' ${dateFilter}
         GROUP BY YEARWEEK(created_at, 1)
         ORDER BY YEARWEEK(created_at, 1) ASC`;
    } else if (period === 'monthly') {
      chartSQL = `
        SELECT DATE_FORMAT(created_at, '%Y-%m') AS grp_key,
               COALESCE(SUM(amount), 0) AS revenue
          FROM payments WHERE status = 'paid' ${dateFilter}
         GROUP BY DATE_FORMAT(created_at, '%Y-%m')
         ORDER BY grp_key ASC`;
    } else {
      chartSQL = `
        SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS grp_key,
               COALESCE(SUM(amount), 0) AS revenue
          FROM payments WHERE status = 'paid' ${dateFilter}
         GROUP BY DATE(created_at)
         ORDER BY grp_key ASC`;
    }

    const [chartRows, totalData, prevData] = await Promise.all([
      query<RevRow>(chartSQL, curP),
      query<{ total: number }>(`SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE status = 'paid' ${dateFilter}`, curP),
      range
        ? query<{ total: number }>(`SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE status = 'paid' AND created_at BETWEEN ? AND ?`, prevP)
        : Promise.resolve([{ total: 0 }]),
    ]);

    const total     = Number(totalData[0]?.total ?? 0);
    const prevTotal = Number(prevData[0]?.total  ?? 0);

    return successResponse(res, 200, 'Dashboard revenue fetched successfully', {
      total,
      change: range ? pctChange(total, prevTotal) : null,
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
    const period       = ['weekly', 'monthly', 'quarterly', 'yearly'].includes(req.query.period as string)
      ? (req.query.period as string) : 'monthly';
    const range = buildDateRange(from, to);

    const dateFilter = range ? 'AND created_at BETWEEN ? AND ?' : '';
    const curP       = range ? [range.current.from, range.current.to] : [];
    const prevP      = range ? [range.prev.from,    range.prev.to]    : [];

    interface GrowthRow { grp_key: string; week_start?: string; newUsers: number; }

    let chartSQL: string;
    if (period === 'weekly') {
      chartSQL = `
        SELECT CAST(YEARWEEK(created_at, 1) AS CHAR) AS grp_key,
               DATE_FORMAT(MIN(created_at), '%Y-%m-%d') AS week_start,
               COUNT(*) AS newUsers
          FROM users WHERE role = 'user' AND is_delete = 0 ${dateFilter}
         GROUP BY YEARWEEK(created_at, 1)
         ORDER BY YEARWEEK(created_at, 1) ASC`;
    } else if (period === 'quarterly') {
      chartSQL = `
        SELECT CONCAT(YEAR(created_at), '-Q', QUARTER(created_at)) AS grp_key,
               COUNT(*) AS newUsers
          FROM users WHERE role = 'user' AND is_delete = 0 ${dateFilter}
         GROUP BY YEAR(created_at), QUARTER(created_at)
         ORDER BY YEAR(created_at) ASC, QUARTER(created_at) ASC`;
    } else if (period === 'yearly') {
      chartSQL = `
        SELECT CAST(YEAR(created_at) AS CHAR) AS grp_key,
               COUNT(*) AS newUsers
          FROM users WHERE role = 'user' AND is_delete = 0 ${dateFilter}
         GROUP BY YEAR(created_at)
         ORDER BY grp_key ASC`;
    } else {
      chartSQL = `
        SELECT DATE_FORMAT(created_at, '%Y-%m') AS grp_key,
               COUNT(*) AS newUsers
          FROM users WHERE role = 'user' AND is_delete = 0 ${dateFilter}
         GROUP BY DATE_FORMAT(created_at, '%Y-%m')
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
    const period       = ['daily', 'weekly'].includes(req.query.period as string)
      ? (req.query.period as string) : 'daily';
    const range = buildDateRange(from, to);

    const dateFilter = range ? 'AND created_at BETWEEN ? AND ?' : '';
    const curP       = range ? [range.current.from, range.current.to] : [];
    const prevP      = range ? [range.prev.from,    range.prev.to]    : [];

    interface ConsRow { grp_key: string; week_start?: string; count: number; }

    const chartSQL = period === 'weekly'
      ? `SELECT CAST(YEARWEEK(created_at, 1) AS CHAR) AS grp_key,
                DATE_FORMAT(MIN(created_at), '%Y-%m-%d') AS week_start,
                COUNT(*) AS count
           FROM appointments WHERE 1=1 ${dateFilter}
          GROUP BY YEARWEEK(created_at, 1)
          ORDER BY YEARWEEK(created_at, 1) ASC`
      : `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS grp_key,
                COUNT(*) AS count
           FROM appointments WHERE 1=1 ${dateFilter}
          GROUP BY DATE(created_at)
          ORDER BY grp_key ASC`;

    const [chartRows, totalData, breakdownData, prevData] = await Promise.all([
      query<ConsRow>(chartSQL, curP),
      query<{ total: number }>(`SELECT COUNT(*) AS total FROM appointments WHERE 1=1 ${dateFilter}`, curP),
      query<{ status: string; cnt: number }>(`SELECT status, COUNT(*) AS cnt FROM appointments WHERE 1=1 ${dateFilter} GROUP BY status`, curP),
      range
        ? query<{ total: number }>(`SELECT COUNT(*) AS total FROM appointments WHERE created_at BETWEEN ? AND ?`, prevP)
        : Promise.resolve([{ total: 0 }]),
    ]);

    const total     = Number(totalData[0]?.total ?? 0);
    const prevTotal = Number(prevData[0]?.total  ?? 0);

    const statusMap: Record<string, number> = {};
    for (const row of breakdownData) statusMap[row.status] = Number(row.cnt);

    const completed = statusMap['completed'] ?? 0;
    const scheduled = (statusMap['pending'] ?? 0) + (statusMap['confirmed'] ?? 0);
    const cancelled = (statusMap['cancelled'] ?? 0) + (statusMap['missed'] ?? 0);
    const safePct   = (n: number) => total === 0 ? 0 : parseFloat(((n / total) * 100).toFixed(1));

    return successResponse(res, 200, 'Dashboard consultations fetched successfully', {
      total,
      change: range ? pctChange(total, prevTotal) : null,
      data: chartRows.map(r => ({ label: fmtPeriodLabel(period, r.grp_key, r.week_start), count: Number(r.count) })),
      breakdown: {
        completed: { count: completed, percent: safePct(completed) },
        scheduled: { count: scheduled, percent: safePct(scheduled) },
        cancelled: { count: cancelled, percent: safePct(cancelled) },
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
