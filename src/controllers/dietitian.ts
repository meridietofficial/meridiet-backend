import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { createUser, findUserByEmail, findUserById, checkPassword, updateUserPassword, softDeleteUser } from '../models/User';
import { createDietitian, findDietitianByRegistrationNumber, findDietitianByUserId, findDietitianById, updateDietitian, setDietitianOnlineStatus, formatDietitianRow } from '../models/Dietitian';
import { updateUser } from '../models/User';
import { query } from '../config/database';
import { env } from '../config/env';
import { successResponse, errorResponse } from '../utils/response';
import { sendEmail } from '../services/email';
import { dietitianWelcomeEmail } from '../services/emails/dietitianWelcome';

const generateToken = (userId: number, email: string | null, role: string, tokenVersion: number) => {
  return jwt.sign(
    { sub: userId, email, role, tokenVersion },
    env.JWT_SECRET,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN } as any,
  );
};

// POST /api/v1/dietitian/register
export const registerDietitian = async (req: Request, res: Response) => {
  try {
    const {
      fullName,
      email,
      phone,
      password,
      state,
      city,
      registrationNumber,
      experience,
      specialization,
      dateOfBirth,
      gender,
      bio,
      languages,
      services,
      degrees,
      awards,
      availability,
      documents,
    } = req.body as {
      fullName?: string;
      email?: string;
      phone?: string;
      password?: string;
      state?: string;
      city?: string;
      registrationNumber?: string;
      experience?: string;
      specialization?: string[];
      dateOfBirth?: string;
      gender?: string;
      bio?: string;
      languages?: string[];
      services?: string[];
      degrees?: { degree: string; institute: string; year: string | null }[];
      awards?: { title: string; organization: string; year: string | null }[];
      availability?: Record<string, string[]>;
      documents?: {
        profilePhoto?: string;
        degreeCertificate?: string;
        registrationCertificate?: string;
        idProof?: string;
        experienceCertificate?: string;
      };
    };

    if (!fullName || !email || !phone || !password || !state || !city || !experience) {
      return errorResponse(res, 400, 'fullName, email, phone, password, state, city and experience are required');
    }

    const existingEmail = await findUserByEmail(email);
    if (existingEmail) return errorResponse(res, 409, 'Email is already registered');

    // Treat "N/A" or empty as no registration number
    const regNumber = (!registrationNumber || registrationNumber.trim().toUpperCase() === 'N/A')
      ? null
      : registrationNumber.trim();

    if (regNumber) {
      const existingReg = await findDietitianByRegistrationNumber(regNumber);
      if (existingReg) return errorResponse(res, 409, 'Registration number is already used');
    }

    const user = await createUser({
      full_name: fullName,
      email,
      password,
      phone_code: '+91',
      phone_number: phone,
      role: 'dietitian',
    });

    if (!user) return errorResponse(res, 500, 'Failed to create user');

    const dietitian = await createDietitian({
      user_id: user.id,
      state,
      city,
      registration_number: regNumber,
      experience,
      specialization: specialization ?? [],
      date_of_birth: dateOfBirth ?? null,
      gender: gender ?? null,
      bio: bio ?? null,
      languages: languages ?? null,
      services: services ?? null,
      degrees: degrees ?? null,
      awards: awards ?? null,
      availability: availability ?? null,
      profile_photo: documents?.profilePhoto ?? null,
      degree_certificate: documents?.degreeCertificate ?? null,
      registration_certificate: documents?.registrationCertificate ?? null,
      id_proof: documents?.idProof ?? null,
      experience_certificate: documents?.experienceCertificate ?? null,
    });

    if (!dietitian) return errorResponse(res, 500, 'Failed to create dietitian profile');

    const token = generateToken(user.id, user.email, user.role, user.token_version);

    // Fire-and-forget acknowledgment email. A mail failure must not break
    // registration, so we don't await it and just log any error.
    if (user.email) {
      const { subject, html, text } = dietitianWelcomeEmail(user.full_name ?? fullName);
      void sendEmail({ to: user.email, subject, html, text }).catch((mailErr) => {
        console.error('Dietitian welcome email failed:', mailErr);
      });
    }

    return successResponse(res, 201, 'Dietitian registered successfully', {
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone_number: user.phone_number,
        role: user.role,
      },
      dietitian: {
        id: dietitian.id,
        state: dietitian.state,
        city: dietitian.city,
        registration_number: dietitian.registration_number,
        experience: dietitian.experience,
        specialization: dietitian.specialization,
        degrees: dietitian.degrees,
        is_verified: dietitian.is_verified,
        documents: {
          profile_photo: dietitian.profile_photo,
          degree_certificate: dietitian.degree_certificate,
          registration_certificate: dietitian.registration_certificate,
          id_proof: dietitian.id_proof,
          experience_certificate: dietitian.experience_certificate,
        },
      },
    });
  } catch (err) {
    console.error('Dietitian register error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

const formatDietitian = (d: Awaited<ReturnType<typeof findDietitianById>>) => formatDietitianRow(d!);

// PUT /api/v1/dietitian/profile
// Updates the logged-in dietitian's profile (all fields optional)
export const updateDietitianProfile = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.sub);

    const dietitian = await findDietitianByUserId(userId);
    if (!dietitian) return errorResponse(res, 404, 'Dietitian profile not found');

    const {
      fullName,
      phone,
      avatarUrl,
      state,
      city,
      experience,
      specialization,
      dateOfBirth,
      gender,
      bio,
      languages,
      services,
      degrees,
      awards,
      availability,
      appointmentFee,
      appointmentCurrency,
      documents,
    } = req.body as {
      fullName?: string;
      phone?: string;
      avatarUrl?: string;
      state?: string;
      city?: string;
      experience?: string;
      specialization?: string[];
      dateOfBirth?: string;
      gender?: string;
      bio?: string;
      languages?: string[];
      services?: string[];
      degrees?: { degree: string; institute: string; year: string | null }[];
      awards?: { title: string; organization: string; year: string | null }[];
      availability?: Record<string, string[]>;
      appointmentFee?: number;
      appointmentCurrency?: string;
      documents?: {
        profilePhoto?: string;
        logoUrl?: string | null;
        degreeCertificate?: string;
        registrationCertificate?: string;
        idProof?: string;
        experienceCertificate?: string;
      };
    };

    // Update user table fields if provided
    const userUpdates: Record<string, unknown> = {};
    if (fullName  !== undefined) userUpdates.full_name    = fullName;
    if (phone     !== undefined) userUpdates.phone_number = phone;
    if (avatarUrl !== undefined) userUpdates.avatar_url   = avatarUrl;
    if (Object.keys(userUpdates).length > 0) {
      await updateUser(userId, userUpdates);
    }

    // Build dietitian update object from only provided fields
    const dietitianUpdates: Record<string, unknown> = {};
    if (state          !== undefined) dietitianUpdates.state      = state;
    if (city           !== undefined) dietitianUpdates.city       = city;
    if (experience     !== undefined) dietitianUpdates.experience = experience;
    if (specialization !== undefined) dietitianUpdates.specialization = specialization;
    if (dateOfBirth    !== undefined) dietitianUpdates.date_of_birth  = dateOfBirth;
    if (gender         !== undefined) dietitianUpdates.gender         = gender;
    if (bio            !== undefined) dietitianUpdates.bio            = bio;
    if (languages      !== undefined) dietitianUpdates.languages      = languages;
    if (services       !== undefined) dietitianUpdates.services       = services;
    if (degrees        !== undefined) dietitianUpdates.degrees        = degrees;
    if (awards         !== undefined) dietitianUpdates.awards         = awards;
    if (availability   !== undefined) dietitianUpdates.availability   = availability;
    if (documents?.profilePhoto            !== undefined) dietitianUpdates.profile_photo            = documents.profilePhoto;
    if (documents?.logoUrl                 !== undefined) dietitianUpdates.logo_url                 = documents.logoUrl;
    if (documents?.degreeCertificate       !== undefined) dietitianUpdates.degree_certificate        = documents.degreeCertificate;
    if (documents?.registrationCertificate !== undefined) dietitianUpdates.registration_certificate  = documents.registrationCertificate;
    if (documents?.idProof                 !== undefined) dietitianUpdates.id_proof                  = documents.idProof;
    if (documents?.experienceCertificate   !== undefined) dietitianUpdates.experience_certificate    = documents.experienceCertificate;
    if (appointmentFee       !== undefined) {
      const fee = Number(appointmentFee);
      if (isNaN(fee) || fee < 0) return errorResponse(res, 400, 'appointmentFee must be a non-negative number');
      dietitianUpdates.appointment_fee = fee;
    }
    if (appointmentCurrency  !== undefined) dietitianUpdates.appointment_currency = appointmentCurrency;

    if (Object.keys(dietitianUpdates).length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await updateDietitian(dietitian.id, dietitianUpdates as any);
    }

    const updated = await findDietitianById(dietitian.id);
    if (!updated) return errorResponse(res, 500, 'Failed to fetch updated profile');

    return successResponse(res, 200, 'Profile updated successfully', formatDietitian(updated));
  } catch (err) {
    console.error('Update dietitian profile error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// PUT /api/v1/dietitian/change-password
export const changeDietitianPassword = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.sub);
    const { current_password, new_password } = req.body as { current_password?: string; new_password?: string };

    if (!current_password) return errorResponse(res, 400, 'current_password is required');
    if (!new_password)     return errorResponse(res, 400, 'new_password is required');
    if (new_password.length < 6) return errorResponse(res, 400, 'new_password must be at least 6 characters');

    const user = await findUserById(userId);
    if (!user) return errorResponse(res, 404, 'User not found');

    const isValid = await checkPassword(current_password, user.password);
    if (!isValid) return errorResponse(res, 401, 'Current password is incorrect');

    if (current_password === new_password) {
      return errorResponse(res, 400, 'New password must be different from current password');
    }

    await updateUserPassword(userId, new_password);

    return successResponse(res, 200, 'Password changed successfully');
  } catch (err) {
    console.error('Change password error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/dietitian/profile
// Returns the logged-in dietitian's full details (requires dietitian JWT)
export const getDietitianProfile = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.sub);
    const dietitian = await findDietitianByUserId(userId);
    if (!dietitian) return errorResponse(res, 404, 'Dietitian profile not found');

    // Use findDietitianById to get the joined data (with user fields)
    const full = await findDietitianById(dietitian.id);
    if (!full) return errorResponse(res, 404, 'Dietitian profile not found');

    return successResponse(res, 200, 'Dietitian profile fetched successfully', formatDietitian(full));
  } catch (err) {
    console.error('Get dietitian profile error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// PATCH /api/v1/dietitian/online-status
// Body: { is_online: boolean }
export const updateOnlineStatus = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.sub);
    const { is_online } = req.body as { is_online?: boolean };

    if (is_online === undefined || typeof is_online !== 'boolean') {
      return errorResponse(res, 400, 'is_online (boolean) is required');
    }

    const dietitian = await findDietitianByUserId(userId);
    if (!dietitian) return errorResponse(res, 404, 'Dietitian profile not found');

    if (is_online) {
      const missing: string[] = [];

      if (!dietitian.appointment_fee || dietitian.appointment_fee <= 0) {
        missing.push('Appointment fee is not set — please add your consultation fee in your profile');
      }

      const availability = dietitian.availability;
      const hasAvailability =
        availability &&
        typeof availability === 'object' &&
        Object.values(availability).some((slots) => Array.isArray(slots) && slots.length > 0);

      if (!hasAvailability) {
        missing.push('Weekly availability is not set — please add at least one day with time slots in your profile');
      }

      if (missing.length > 0) {
        return errorResponse(res, 400, `Cannot go online. Please fix the following:\n• ${missing.join('\n• ')}`);
      }
    }

    await setDietitianOnlineStatus(dietitian.id, is_online);

    return successResponse(res, 200, `You are now ${is_online ? 'online' : 'offline'}`, {
      is_online,
    });
  } catch (err) {
    console.error('Update online status error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// DELETE /api/v1/dietitian/account
// Soft-deletes the logged-in dietitian's account.
// Requires password confirmation and blocks if any upcoming appointments exist.
export const deleteMyAccount = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.user?.sub);
    const { password } = req.body as { password?: string };

    if (!password) {
      return errorResponse(res, 400, 'password is required to confirm account deletion');
    }

    const user = await findUserById(userId);
    if (!user) return errorResponse(res, 404, 'User not found');

    const isValid = await checkPassword(password, user.password);
    if (!isValid) return errorResponse(res, 401, 'Incorrect password');

    const dietitian = await findDietitianByUserId(userId);
    if (!dietitian) return errorResponse(res, 404, 'Dietitian profile not found');

    // Block deletion if upcoming confirmed or pending appointments exist
    const upcomingRows = await query<{ count: number }>(
      `SELECT COUNT(*) AS count FROM appointments
       WHERE dietitian_id = ?
         AND status IN ('confirmed', 'pending')
         AND appointment_date >= CURDATE()`,
      [dietitian.id],
    );
    const upcomingCount = Number(upcomingRows[0]?.count ?? 0);
    if (upcomingCount > 0) {
      return errorResponse(
        res,
        400,
        `You have ${upcomingCount} upcoming appointment(s). Please cancel or complete them before deleting your account.`,
      );
    }

    // Take offline, then soft-delete
    await setDietitianOnlineStatus(dietitian.id, false);
    await softDeleteUser(userId);

    return successResponse(res, 200, 'Account deleted successfully');
  } catch (err) {
    console.error('Delete dietitian account error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/dietitian/:id
// Returns a dietitian's full details by dietitian ID
export const getDietitianById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid dietitian ID');

    const dietitian = await findDietitianById(id);
    if (!dietitian) return errorResponse(res, 404, 'Dietitian not found');

    return successResponse(res, 200, 'Dietitian fetched successfully', formatDietitian(dietitian));
  } catch (err) {
    console.error('Get dietitian by ID error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};
