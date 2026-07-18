import crypto from 'crypto';
import type { Request, Response } from 'express';
import { razorpay } from '../config/razorpay';
import { env } from '../config/env';
import { findUserByEmail, findUserByPhoneNumber, createUser } from '../models/User';
import { findDietitianByRegistrationNumber, createDietitian } from '../models/Dietitian';
import {
  upsertPendingRegistration,
  setOrderId,
  findByOrderId,
  markRegistrationPaid,
  markRegistrationFailed,
} from '../models/DietitianRegistrationPayment';
import { getDietitianRegistrationFee } from '../models/Setting';
import { saveOtp, getLatestOtp, getVerifiedOtp, markOtpVerified } from '../models/PhoneOtp';
import { generateOtp, sendOtp, verifyOtp } from '../services/otp';
import { successResponse, errorResponse } from '../utils/response';
import { sendEmail } from '../services/email';
import { dietitianWelcomeEmail } from '../services/emails/dietitianWelcome';

const PHONE_CODE = '91';

const normalizePhone = (phone: string): string | null => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 10) return digits;
  return null;
};

const nullIfEmpty = (val: string | null | undefined): string | null =>
  val && val.trim() !== '' ? val.trim() : null;

type RegistrationData = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  state: string;
  city: string;
  experience: string;
  registrationNumber?: string | null;
  specialization?: string[];
  dateOfBirth?: string | null;
  gender?: string | null;
  bio?: string | null;
  languages?: string[] | null;
  services?: string[] | null;
  degrees?: { degree: string; institute: string; year: string | null }[] | null;
  awards?: { title: string; organization: string; year: string | null }[] | null;
  availability?: Record<string, string[]> | null;
  documents?: {
    profilePhoto?: string;
    degreeCertificate?: string;
    registrationCertificate?: string;
    idProof?: string;
    experienceCertificate?: string;
  } | null;
};

// POST /api/v1/dietitian/register/send-otp
// Body: { phone }
export const sendRegistrationOtp = async (req: Request, res: Response) => {
  try {
    const { phone } = req.body as { phone?: string };
    if (!phone?.trim()) return errorResponse(res, 400, 'phone is required');

    const number = normalizePhone(phone.trim());
    if (!number) return errorResponse(res, 400, 'Enter a valid 10-digit Indian mobile number');

    const existingPhone = await findUserByPhoneNumber(number);
    if (existingPhone) return errorResponse(res, 409, 'Phone number is already registered');

    const otp = generateOtp();
    await saveOtp(PHONE_CODE, number, otp);

    const result = await sendOtp(PHONE_CODE, number, otp);
    if (!result.ok) {
      console.error('MSG91 OTP send failed:', result.message);
      return errorResponse(res, 502, 'Failed to send OTP. Please try again.');
    }

    return successResponse(res, 200, `OTP sent to ${number}`);
  } catch (err) {
    console.error('Dietitian send-otp error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// POST /api/v1/dietitian/register/verify-otp
// Body: { phone, otp }
export const verifyRegistrationOtp = async (req: Request, res: Response) => {
  try {
    const { phone, otp } = req.body as { phone?: string; otp?: string };
    if (!phone?.trim()) return errorResponse(res, 400, 'phone is required');
    if (!otp?.trim())   return errorResponse(res, 400, 'otp is required');

    const number = normalizePhone(phone.trim());
    if (!number) return errorResponse(res, 400, 'Enter a valid 10-digit Indian mobile number');

    const record = await getLatestOtp(PHONE_CODE, number);
    if (!record) return errorResponse(res, 400, 'OTP not found. Please request a new OTP.');

    const check = await verifyOtp(PHONE_CODE, number, otp.trim(), record.otp, record.expires_at);
    if (!check.ok) return errorResponse(res, 400, check.message);

    await markOtpVerified(PHONE_CODE, number);

    return successResponse(res, 200, 'Phone number verified successfully', { phone_verified: true });
  } catch (err) {
    console.error('Dietitian verify-otp error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// POST /api/v1/dietitian/register/create-order
export const createRegistrationOrder = async (req: Request, res: Response) => {
  try {
    const body = req.body as Partial<RegistrationData>;
    const { fullName, email, phone, password, state, city, experience } = body;

    if (!fullName || !email || !phone || !password || !state || !city || !experience) {
      return errorResponse(res, 400, 'fullName, email, phone, password, state, city and experience are required');
    }

    if (password.length < 6) {
      return errorResponse(res, 400, 'password must be at least 6 characters');
    }

    const existingEmail = await findUserByEmail(email);
    if (existingEmail) return errorResponse(res, 409, 'Email is already registered');

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) return errorResponse(res, 400, 'Enter a valid 10-digit Indian mobile number');

    const existingPhone = await findUserByPhoneNumber(normalizedPhone);
    if (existingPhone) return errorResponse(res, 409, 'Phone number is already registered');

    const otpRecord = await getVerifiedOtp(PHONE_CODE, normalizedPhone);
    if (!otpRecord) {
      return errorResponse(res, 400, 'Phone number is not verified. Please verify your phone number first.');
    }

    const regNumber = (!body.registrationNumber || body.registrationNumber.trim().toUpperCase() === 'N/A')
      ? null
      : body.registrationNumber.trim();

    if (regNumber) {
      const existingReg = await findDietitianByRegistrationNumber(regNumber);
      if (existingReg) return errorResponse(res, 409, 'Registration number is already used');
    }

    const fee = await getDietitianRegistrationFee();

    // Store all registration fields (including password — hashing happens on verify)
    const pendingId = await upsertPendingRegistration(email, { ...body, registrationNumber: regNumber }, fee);

    const order = await razorpay.orders.create({
      amount: fee * 100, // paise
      currency: 'INR',
      receipt: `dietitian_reg_${pendingId}`,
    });

    await setOrderId(pendingId, order.id);

    return successResponse(res, 201, 'Order created', {
      order_id: order.id,
      amount:   fee,
      currency: 'INR',
      key_id:   env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error('Dietitian registration create-order error:', err);
    return errorResponse(res, 500, 'Failed to create payment order');
  }
};

// POST /api/v1/dietitian/register/verify-payment
export const verifyRegistrationPayment = async (req: Request, res: Response) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body as {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return errorResponse(res, 400, 'razorpay_order_id, razorpay_payment_id and razorpay_signature are required');
  }

  // Verify HMAC signature
  const expectedSignature = crypto
    .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (expectedSignature !== razorpay_signature) {
    await markRegistrationFailed(razorpay_order_id).catch(() => null);
    return errorResponse(res, 400, 'Payment verification failed: invalid signature');
  }

  try {
    const pending = await findByOrderId(razorpay_order_id);
    if (!pending) return errorResponse(res, 404, 'Order not found');
    if (pending.status === 'paid') return errorResponse(res, 409, 'Payment already verified');

    const data: RegistrationData = typeof pending.registration_data === 'string'
      ? JSON.parse(pending.registration_data)
      : pending.registration_data as RegistrationData;

    // Re-check uniqueness (guard against race conditions)
    const existingEmail = await findUserByEmail(data.email);
    if (existingEmail) return errorResponse(res, 409, 'Email is already registered');

    await markRegistrationPaid(pending.id, razorpay_payment_id, razorpay_signature);

    const user = await createUser({
      full_name:    data.fullName,
      email:        data.email,
      password:     data.password,
      phone_code:   '+91',
      phone_number: data.phone,
      role:         'dietitian',
    });
    if (!user) return errorResponse(res, 500, 'Failed to create user');

    // Clean empty-string values in degrees (year, institute may arrive as "")
    const cleanedDegrees = data.degrees
      ?.map((d) => ({ ...d, institute: nullIfEmpty(d.institute) ?? '', year: nullIfEmpty(d.year) }))
      ?? null;

    const cleanedAwards = data.awards
      ?.map((a) => ({ ...a, organization: nullIfEmpty(a.organization) ?? '', year: nullIfEmpty(a.year) }))
      ?? null;

    const dietitian = await createDietitian({
      user_id:                  user.id,
      state:                    data.state,
      city:                     data.city,
      registration_number:      nullIfEmpty(data.registrationNumber),
      experience:               data.experience,
      specialization:           data.specialization ?? [],
      date_of_birth:            nullIfEmpty(data.dateOfBirth),
      gender:                   nullIfEmpty(data.gender),
      bio:                      nullIfEmpty(data.bio),
      languages:                data.languages ?? null,
      services:                 data.services ?? null,
      degrees:                  cleanedDegrees,
      awards:                   cleanedAwards,
      availability:             data.availability ?? null,
      profile_photo:            nullIfEmpty(data.documents?.profilePhoto),
      degree_certificate:       nullIfEmpty(data.documents?.degreeCertificate),
      registration_certificate: nullIfEmpty(data.documents?.registrationCertificate),
      id_proof:                 nullIfEmpty(data.documents?.idProof),
      experience_certificate:   nullIfEmpty(data.documents?.experienceCertificate),
    });
    if (!dietitian) return errorResponse(res, 500, 'Failed to create dietitian profile');

    if (user.email) {
      const { subject, html, text } = dietitianWelcomeEmail(user.full_name ?? data.fullName);
      void sendEmail({ to: user.email, subject, html, text }).catch((err) => {
        console.error('Dietitian welcome email failed:', err);
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
    console.error('Dietitian registration verify-payment error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// POST /api/v1/dietitian/register/failed
export const markRegistrationPaymentFailed = async (req: Request, res: Response) => {
  try {
    const { razorpay_order_id } = req.body as { razorpay_order_id?: string };
    if (!razorpay_order_id) return errorResponse(res, 400, 'razorpay_order_id is required');
    await markRegistrationFailed(razorpay_order_id);
    return successResponse(res, 200, 'Marked as failed');
  } catch (err) {
    console.error('Dietitian registration mark-failed error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};
