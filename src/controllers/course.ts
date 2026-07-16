import crypto from 'crypto';
import type { Request, Response } from 'express';
import { createCourseEnquiry } from '../models/CourseEnquiry';
import { createCourseEnrollment, getCourseEnrollmentById, updateCourseEnrollmentPayment } from '../models/CourseEnrollment';
import { getCourseFee } from '../models/Setting';
import { saveOtp, getLatestOtp, markOtpVerified } from '../models/PhoneOtp';
import { generateOtp, sendOtp, verifyOtp } from '../services/otp';
import { sendEmail } from '../services/email';
import { razorpay } from '../config/razorpay';
import { courseEnquiryUserEmail, courseEnquiryAdminEmail } from '../services/emails/courseEnquiryEmail';
import { coursePaymentSuccessUserEmail, coursePaymentSuccessAdminEmail } from '../services/emails/coursePaymentSuccessEmail';
import { coursePaymentFailedUserEmail } from '../services/emails/coursePaymentFailedEmail';
import { successResponse, errorResponse } from '../utils/response';
import { env } from '../config/env';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Accepts +91XXXXXXXXXX, 91XXXXXXXXXX, or XXXXXXXXXX (10 digits)
// Returns { phoneCode: '91', phoneNumber: '9876543210' }
const normalizeIndianPhone = (phone: string): { phoneCode: string; phoneNumber: string } | null => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return { phoneCode: '91', phoneNumber: digits.slice(2) };
  }
  if (digits.length === 10) {
    return { phoneCode: '91', phoneNumber: digits };
  }
  return null;
};

// POST /api/v1/course/send-otp
// Body: { phone }
export const sendCourseOtp = async (req: Request, res: Response) => {
  try {
    const { phone } = req.body as { phone?: string };

    if (!phone?.trim()) return errorResponse(res, 400, 'phone is required');

    const normalized = normalizeIndianPhone(phone.trim());
    if (!normalized) return errorResponse(res, 400, 'Enter a valid 10-digit Indian mobile number');

    const otp = generateOtp();
    await saveOtp(normalized.phoneCode, normalized.phoneNumber, otp);

    const result = await sendOtp(normalized.phoneCode, normalized.phoneNumber, otp);
    if (!result.ok) {
      console.error('MSG91 OTP send failed:', result.message);
      return errorResponse(res, 502, 'Failed to send OTP. Please try again.');
    }

    return successResponse(res, 200, `OTP sent to ${phone.trim()}`);
  } catch (err) {
    console.error('Course send-otp error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// POST /api/v1/course/enquiry
// Body: { name, email, phone, otp, qualification?, message? }
export const submitCourseEnquiry = async (req: Request, res: Response) => {
  try {
    const { name, email, phone, otp, qualification, message } = req.body as {
      name?: string;
      email?: string;
      phone?: string;
      otp?: string;
      qualification?: string;
      message?: string;
    };

    if (!name?.trim())                return errorResponse(res, 400, 'name is required');
    if (!email?.trim())               return errorResponse(res, 400, 'email is required');
    if (!EMAIL_RE.test(email.trim())) return errorResponse(res, 400, 'A valid email is required');
    if (!phone?.trim())               return errorResponse(res, 400, 'phone is required');
    if (!otp?.trim())                 return errorResponse(res, 400, 'otp is required');

    const normalized = normalizeIndianPhone(phone.trim());
    if (!normalized) return errorResponse(res, 400, 'Enter a valid 10-digit Indian mobile number');

    // Verify OTP
    const record = await getLatestOtp(normalized.phoneCode, normalized.phoneNumber);
    if (!record) return errorResponse(res, 400, 'OTP not found. Please request a new OTP.');

    const check = await verifyOtp(
      normalized.phoneCode,
      normalized.phoneNumber,
      otp.trim(),
      record.otp,
      record.expires_at,
    );
    if (!check.ok) return errorResponse(res, 400, check.message);

    await markOtpVerified(normalized.phoneCode, normalized.phoneNumber);

    // Save to DB
    const saved = await createCourseEnquiry({
      name:          name.trim(),
      email:         email.trim().toLowerCase(),
      phone:         `+${normalized.phoneCode}${normalized.phoneNumber}`,
      qualification: qualification?.trim() || null,
      message:       message?.trim() || null,
    });
    if (!saved) return errorResponse(res, 500, 'Failed to save enquiry');

    // Send emails (fire-and-forget)
    const userMail  = courseEnquiryUserEmail(saved.name, { email: saved.email, phone: saved.phone, qualification: saved.qualification, message: saved.message });
    const adminMail = courseEnquiryAdminEmail({ id: saved.id, name: saved.name, email: saved.email, phone: saved.phone, qualification: saved.qualification, message: saved.message });

    Promise.all([
      sendEmail({ to: saved.email,       subject: userMail.subject,  html: userMail.html,  text: userMail.text }),
      sendEmail({ to: env.ADMIN_EMAIL,   subject: adminMail.subject, html: adminMail.html, text: adminMail.text }),
    ]).catch((err) => console.error('Course enquiry email error:', err));

    return successResponse(res, 201, 'Enquiry submitted successfully', {
      id:         saved.id,
      name:       saved.name,
      email:      saved.email,
      created_at: saved.created_at,
    });
  } catch (err) {
    console.error('Course enquiry error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// POST /api/v1/course/enroll
// Body: { name, email, phone, otp }
export const submitCourseEnrollment = async (req: Request, res: Response) => {
  try {
    const { name, email, phone, otp } = req.body as {
      name?: string;
      email?: string;
      phone?: string;
      otp?: string;
    };

    if (!name?.trim())                return errorResponse(res, 400, 'name is required');
    if (!email?.trim())               return errorResponse(res, 400, 'email is required');
    if (!EMAIL_RE.test(email.trim())) return errorResponse(res, 400, 'A valid email is required');
    if (!phone?.trim())               return errorResponse(res, 400, 'phone is required');
    if (!otp?.trim())                 return errorResponse(res, 400, 'otp is required');

    const normalized = normalizeIndianPhone(phone.trim());
    if (!normalized) return errorResponse(res, 400, 'Enter a valid 10-digit Indian mobile number');

    // Verify OTP
    const record = await getLatestOtp(normalized.phoneCode, normalized.phoneNumber);
    if (!record) return errorResponse(res, 400, 'OTP not found. Please request a new OTP.');

    const check = await verifyOtp(
      normalized.phoneCode,
      normalized.phoneNumber,
      otp.trim(),
      record.otp,
      record.expires_at,
    );
    if (!check.ok) return errorResponse(res, 400, check.message);

    await markOtpVerified(normalized.phoneCode, normalized.phoneNumber);

    // Read course fee from app_settings
    const courseFee = await getCourseFee();

    // Save to DB
    const saved = await createCourseEnrollment({
      name:  name.trim(),
      email: email.trim().toLowerCase(),
      phone: `+${normalized.phoneCode}${normalized.phoneNumber}`,
    });
    if (!saved) return errorResponse(res, 500, 'Failed to save enrollment');

    return successResponse(res, 201, 'Enrollment registered successfully', {
      id:         saved.id,
      name:       saved.name,
      email:      saved.email,
      course_fee: courseFee,
      created_at: saved.created_at,
    });
  } catch (err) {
    console.error('Course enrollment error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// POST /api/v1/course/payment/create-order
// Body: { enrollment_id }
export const createCourseOrder = async (req: Request, res: Response) => {
  try {
    const { enrollment_id } = req.body as { enrollment_id?: number };
    if (!enrollment_id) return errorResponse(res, 400, 'enrollment_id is required');

    const enrollment = await getCourseEnrollmentById(Number(enrollment_id));
    if (!enrollment)                              return errorResponse(res, 404, 'Enrollment not found');
    if (enrollment.payment_status === 'paid')     return errorResponse(res, 409, 'Enrollment is already paid');

    const courseFee = await getCourseFee();

    const order = await razorpay.orders.create({
      amount:   Math.round(courseFee * 100), // paise
      currency: 'INR',
      receipt:  `course_${enrollment.id}_${Date.now()}`,
      notes:    { enrollment_id: String(enrollment.id), name: enrollment.name, phone: enrollment.phone },
    });

    // Store the Razorpay order id on the enrollment row
    await import('../config/database').then(({ execute }) =>
      execute('UPDATE course_enrollments SET razorpay_order_id = ? WHERE id = ?', [order.id, enrollment.id]),
    );

    return successResponse(res, 201, 'Order created', {
      order_id:      order.id,
      amount:        courseFee,
      currency:      'INR',
      key_id:        env.RAZORPAY_KEY_ID,
      enrollment_id: enrollment.id,
      name:          enrollment.name,
      email:         enrollment.email,
      phone:         enrollment.phone,
    });
  } catch (err) {
    console.error('Course create-order error:', err);
    return errorResponse(res, 500, 'Failed to create payment order');
  }
};

// POST /api/v1/course/payment/verify
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
export const verifyCoursePayment = async (req: Request, res: Response) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body as {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return errorResponse(res, 400, 'razorpay_order_id, razorpay_payment_id and razorpay_signature are required');
  }

  // Verify HMAC signature
  const expectedSig = crypto
    .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (expectedSig !== razorpay_signature) {
    return errorResponse(res, 400, 'Payment verification failed: invalid signature');
  }

  try {
    // Find enrollment by order id
    const rows = await import('../config/database').then(({ query }) =>
      query<{ id: number }>('SELECT id FROM course_enrollments WHERE razorpay_order_id = ? LIMIT 1', [razorpay_order_id]),
    );
    if (!rows[0]) return errorResponse(res, 404, 'Order not found');

    const enrollment = await getCourseEnrollmentById(rows[0].id);
    if (!enrollment)                          return errorResponse(res, 404, 'Enrollment not found');
    if (enrollment.payment_status === 'paid') return errorResponse(res, 409, 'Payment already verified');

    const courseFee = await getCourseFee();

    await updateCourseEnrollmentPayment(enrollment.id, {
      payment_status:      'paid',
      razorpay_payment_id,
      razorpay_signature,
      payment_verified_at: new Date(),
    });

    // Send success emails
    const userMail  = coursePaymentSuccessUserEmail(enrollment.name, {
      enrollmentId:      enrollment.id,
      email:             enrollment.email,
      phone:             enrollment.phone,
      amountPaid:        courseFee,
      razorpayPaymentId: razorpay_payment_id,
    });
    const adminMail = coursePaymentSuccessAdminEmail({
      enrollmentId:      enrollment.id,
      name:              enrollment.name,
      email:             enrollment.email,
      phone:             enrollment.phone,
      amountPaid:        courseFee,
      razorpayPaymentId: razorpay_payment_id,
      razorpayOrderId:   razorpay_order_id,
    });

    Promise.all([
      sendEmail({ to: enrollment.email, subject: userMail.subject,  html: userMail.html,  text: userMail.text }),
      sendEmail({ to: env.ADMIN_EMAIL,  subject: adminMail.subject, html: adminMail.html, text: adminMail.text }),
    ]).catch((err) => console.error('Course payment success email error:', err));

    return successResponse(res, 200, 'Payment verified successfully', {
      enrollment_id: enrollment.id,
      name:          enrollment.name,
      amount_paid:   courseFee,
      payment_id:    razorpay_payment_id,
    });
  } catch (err) {
    console.error('Course verify payment error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// POST /api/v1/course/payment/failed
// Body: { razorpay_order_id }
export const coursePyamentFailed = async (req: Request, res: Response) => {
  try {
    const { razorpay_order_id } = req.body as { razorpay_order_id?: string };
    if (!razorpay_order_id) return errorResponse(res, 400, 'razorpay_order_id is required');

    const rows = await import('../config/database').then(({ query }) =>
      query<{ id: number }>('SELECT id FROM course_enrollments WHERE razorpay_order_id = ? LIMIT 1', [razorpay_order_id]),
    );
    if (!rows[0]) return errorResponse(res, 404, 'Order not found');

    const enrollment = await getCourseEnrollmentById(rows[0].id);
    if (!enrollment) return errorResponse(res, 404, 'Enrollment not found');

    const courseFee = await getCourseFee();

    await updateCourseEnrollmentPayment(enrollment.id, {
      payment_status:   'failed',
      payment_failed_at: new Date(),
    });

    const userMail = coursePaymentFailedUserEmail(enrollment.name, {
      enrollmentId:    enrollment.id,
      amountAttempted: courseFee,
    });
    sendEmail({ to: enrollment.email, subject: userMail.subject, html: userMail.html, text: userMail.text })
      .catch((err) => console.error('Course payment failed email error:', err));

    return successResponse(res, 200, 'Payment failure recorded');
  } catch (err) {
    console.error('Course payment failed error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};
