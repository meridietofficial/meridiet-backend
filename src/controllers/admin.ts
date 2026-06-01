import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { findUserByEmail, findUserById, checkPassword, updateUser, softDeleteUser, updateUserPassword, getUsersPaginated } from '../models/User';
import { getAllDietitians, findDietitianById, verifyDietitian } from '../models/Dietitian';
import { env } from '../config/env';
import { successResponse, errorResponse } from '../utils/response';

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
      rows,
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
      rows,
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

    return successResponse(res, 200, 'Dietitian details fetched successfully', dietitian);
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
