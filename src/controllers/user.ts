import type { Request, Response } from 'express';
import { findUserById, findUserByEmail, updateUser, checkPassword, updateUserPassword } from '../models/User';
import { successResponse, errorResponse } from '../utils/response';

// GET /api/v1/user/profile
export const getUserProfile = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.sub);
    const user = await findUserById(userId);
    if (!user) return errorResponse(res, 404, 'User not found');

    return successResponse(res, 200, 'Profile fetched', {
      id:           user.id,
      full_name:    user.full_name,
      email:        user.email,
      phone_code:   user.phone_code,
      phone_number: user.phone_number,
      avatar_url:   user.avatar_url,
      wallet_balance: user.wallet_balance,
      role:         user.role,
      created_at:   user.created_at,
    });
  } catch (err) {
    console.error('Get user profile error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// PUT /api/v1/user/profile
// Body (all optional): full_name, email, phone_code, phone_number, avatar_url
export const updateUserProfile = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.sub);

    const { full_name, email, phone_code, phone_number, avatar_url } = req.body as {
      full_name?:    string;
      email?:        string;
      phone_code?:   string;
      phone_number?: string;
      avatar_url?:   string;
    };

    // Validate email format if provided
    if (email !== undefined) {
      if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return errorResponse(res, 400, 'Invalid email format');
      }
      // Check if email already in use by another user
      const existing = await findUserByEmail(email.trim());
      if (existing && existing.id !== userId) {
        return errorResponse(res, 409, 'Email is already in use by another account');
      }
    }

    if (full_name !== undefined && typeof full_name === 'string' && !full_name.trim()) {
      return errorResponse(res, 400, 'full_name cannot be empty');
    }

    const updates: Record<string, unknown> = {};
    if (full_name    !== undefined) updates.full_name    = full_name.trim();
    if (email        !== undefined) updates.email        = email.trim();
    if (phone_code   !== undefined) updates.phone_code   = phone_code   || null;
    if (phone_number !== undefined) updates.phone_number = phone_number || null;
    if (avatar_url   !== undefined) updates.avatar_url   = avatar_url   || null;

    if (Object.keys(updates).length === 0) {
      return errorResponse(res, 400, 'No fields provided to update');
    }

    const updated = await updateUser(userId, updates);
    if (!updated) return errorResponse(res, 404, 'User not found');

    return successResponse(res, 200, 'Profile updated successfully', {
      id:           updated.id,
      full_name:    updated.full_name,
      email:        updated.email,
      phone_code:   updated.phone_code,
      phone_number: updated.phone_number,
      avatar_url:   updated.avatar_url,
      wallet_balance: updated.wallet_balance,
      role:         updated.role,
      created_at:   updated.created_at,
    });
  } catch (err) {
    console.error('Update user profile error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// PUT /api/v1/user/change-password
// Body: current_password, new_password
export const changeUserPassword = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.sub);

    const { current_password, new_password } = req.body as {
      current_password?: string;
      new_password?:     string;
    };

    if (!current_password || !new_password) {
      return errorResponse(res, 400, 'current_password and new_password are required');
    }
    if (new_password.length < 6) {
      return errorResponse(res, 400, 'new_password must be at least 6 characters');
    }

    const user = await findUserById(userId);
    if (!user) return errorResponse(res, 404, 'User not found');

    // Google-only accounts have no real password
    if (!user.password) {
      return errorResponse(res, 400, 'Password change is not available for Google-linked accounts');
    }

    const isMatch = await checkPassword(current_password, user.password);
    if (!isMatch) return errorResponse(res, 401, 'Current password is incorrect');

    await updateUserPassword(userId, new_password);

    return successResponse(res, 200, 'Password changed successfully');
  } catch (err) {
    console.error('Change user password error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};
