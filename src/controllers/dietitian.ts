import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { createUser, findUserByEmail } from '../models/User';
import { createDietitian, findDietitianByRegistrationNumber } from '../models/Dietitian';
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
      highestDegree,
      registrationNumber,
      experience,
      specialization,
      documents,
    } = req.body as {
      fullName?: string;
      email?: string;
      phone?: string;
      password?: string;
      state?: string;
      city?: string;
      highestDegree?: string;
      registrationNumber?: string;
      experience?: string;
      specialization?: string;
      documents?: {
        profilePhoto?: string;
        degreeCertificate?: string;
        registrationCertificate?: string;
        idProof?: string;
      };
    };

    if (!fullName || !email || !phone || !password || !state || !city || !highestDegree || !registrationNumber || !experience || !specialization) {
      return errorResponse(res, 400, 'fullName, email, phone, password, state, city, highestDegree, registrationNumber, experience and specialization are required');
    }

    const existingEmail = await findUserByEmail(email);
    if (existingEmail) return errorResponse(res, 409, 'Email is already registered');

    const existingReg = await findDietitianByRegistrationNumber(registrationNumber);
    if (existingReg) return errorResponse(res, 409, 'Registration number is already used');

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
      highest_degree: highestDegree,
      registration_number: registrationNumber,
      experience,
      specialization,
      profile_photo: documents?.profilePhoto ?? null,
      degree_certificate: documents?.degreeCertificate ?? null,
      registration_certificate: documents?.registrationCertificate ?? null,
      id_proof: documents?.idProof ?? null,
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
        highest_degree: dietitian.highest_degree,
        registration_number: dietitian.registration_number,
        experience: dietitian.experience,
        specialization: dietitian.specialization,
        is_verified: dietitian.is_verified,
        documents: {
          profile_photo: dietitian.profile_photo,
          degree_certificate: dietitian.degree_certificate,
          registration_certificate: dietitian.registration_certificate,
          id_proof: dietitian.id_proof,
        },
      },
    });
  } catch (err) {
    console.error('Dietitian register error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};
