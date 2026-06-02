import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { createUser, findUserByEmail } from '../models/User';
import { createDietitian, findDietitianByRegistrationNumber, findDietitianByUserId, findDietitianById, updateDietitian } from '../models/Dietitian';
import { updateUser } from '../models/User';
import { env } from '../config/env';
import { successResponse, errorResponse } from '../utils/response';

const generateToken = (userId: number, email: string | null, role: string) => {
  return jwt.sign(
    { sub: userId, email, role },
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
    if (!specialization || specialization.length === 0) {
      return errorResponse(res, 400, 'specialization array is required and must not be empty');
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
      specialization,
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

    const token = generateToken(user.id, user.email, user.role);

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

const parseJson = <T>(val: T | string | null): T | null => {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') {
    try { return JSON.parse(val) as T; } catch { return null; }
  }
  return val as T;
};

const formatDietitian = (d: Awaited<ReturnType<typeof findDietitianById>>) => ({
  id: d!.id,
  user_id: d!.user_id,
  full_name: d!.full_name,
  email: d!.email,
  phone_code: d!.phone_code,
  phone_number: d!.phone_number,
  avatar_url: d!.avatar_url,
  is_active: d!.is_active,
  date_of_birth: d!.date_of_birth ?? null,
  gender: d!.gender ?? null,
  bio: d!.bio ?? null,
  state: d!.state,
  city: d!.city,
  registration_number: d!.registration_number,
  experience: d!.experience,
  specialization: parseJson<string[]>(d!.specialization) ?? [],
  languages: parseJson<string[]>(d!.languages) ?? [],
  services: parseJson<string[]>(d!.services) ?? [],
  degrees: parseJson<{ degree: string; institute: string; year: string | null }[]>(d!.degrees) ?? [],
  awards: parseJson<{ title: string; organization: string; year: string | null }[]>(d!.awards) ?? [],
  availability: parseJson<Record<string, string[]>>(d!.availability) ?? null,
  is_verified: d!.is_verified,
  documents: {
    profile_photo: d!.profile_photo,
    degree_certificate: d!.degree_certificate,
    registration_certificate: d!.registration_certificate,
    id_proof: d!.id_proof,
    experience_certificate: d!.experience_certificate,
  },
  created_at: d!.created_at,
  updated_at: d!.updated_at,
});

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
      documents?: {
        profilePhoto?: string;
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
    if (documents?.profilePhoto          !== undefined) dietitianUpdates.profile_photo           = documents.profilePhoto;
    if (documents?.degreeCertificate     !== undefined) dietitianUpdates.degree_certificate      = documents.degreeCertificate;
    if (documents?.registrationCertificate !== undefined) dietitianUpdates.registration_certificate = documents.registrationCertificate;
    if (documents?.idProof               !== undefined) dietitianUpdates.id_proof               = documents.idProof;
    if (documents?.experienceCertificate !== undefined) dietitianUpdates.experience_certificate  = documents.experienceCertificate;

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
