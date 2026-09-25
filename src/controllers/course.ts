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
import { resolveCoupon, createCouponUsage } from '../models/Coupon';
import { sendCoursePaymentWhatsApp } from '../services/whatsapp';
import { successResponse, errorResponse } from '../utils/response';
import { env } from '../config/env';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMI_FIRST_INSTALLMENT      = 4999;
const EMI_SUBSEQUENT_INSTALLMENT = 5000;
const EMI_TOTAL_INSTALLMENTS     = 3;

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
// Body: { name, email, phone, otp, payment_plan? }
export const submitCourseEnrollment = async (req: Request, res: Response) => {
  try {
    const { name, email, phone, otp, payment_plan } = req.body as {
      name?: string;
      email?: string;
      phone?: string;
      otp?: string;
      payment_plan?: string;
    };

    if (!name?.trim())                return errorResponse(res, 400, 'name is required');
    if (!email?.trim())               return errorResponse(res, 400, 'email is required');
    if (!EMAIL_RE.test(email.trim())) return errorResponse(res, 400, 'A valid email is required');
    if (!phone?.trim())               return errorResponse(res, 400, 'phone is required');
    if (!otp?.trim())                 return errorResponse(res, 400, 'otp is required');
    if (payment_plan && !['full', 'emi'].includes(payment_plan)) {
      return errorResponse(res, 400, 'payment_plan must be "full" or "emi"');
    }

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
      name:         name.trim(),
      email:        email.trim().toLowerCase(),
      phone:        `+${normalized.phoneCode}${normalized.phoneNumber}`,
      payment_plan: (payment_plan as 'full' | 'emi') ?? 'full',
    });
    if (!saved) return errorResponse(res, 500, 'Failed to save enrollment');

    return successResponse(res, 201, 'Enrollment registered successfully', {
      id:           saved.id,
      name:         saved.name,
      email:        saved.email,
      payment_plan: saved.payment_plan,
      course_fee:   courseFee,
      created_at:   saved.created_at,
    });
  } catch (err) {
    console.error('Course enrollment error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// POST /api/v1/course/payment/create-order
// Body: { enrollment_id, coupon_code? }
export const createCourseOrder = async (req: Request, res: Response) => {
  try {
    const { enrollment_id, coupon_code } = req.body as { enrollment_id?: number; coupon_code?: string };
    if (!enrollment_id) return errorResponse(res, 400, 'enrollment_id is required');

    const enrollment = await getCourseEnrollmentById(Number(enrollment_id));
    if (!enrollment)                          return errorResponse(res, 404, 'Enrollment not found');
    if (enrollment.payment_status === 'paid') return errorResponse(res, 409, 'Enrollment is already paid');

    const courseFee = await getCourseFee();
    const isEmi = enrollment.payment_plan === 'emi';

    // EMI: block coupon and check installment ceiling
    if (isEmi) {
      if (enrollment.emi_installments_paid >= EMI_TOTAL_INSTALLMENTS) {
        return errorResponse(res, 409, 'All EMI installments have already been paid');
      }
      if (coupon_code?.trim()) {
        return errorResponse(res, 400, 'Coupons cannot be applied to EMI payments');
      }
    }

    let finalAmount     = isEmi ? EMI_FIRST_INSTALLMENT : courseFee;
    let discountApplied = 0;
    let couponId: number | null = null;
    let appliedCode: string | null = null;

    if (!isEmi && coupon_code?.trim()) {
      const couponResult = await resolveCoupon(coupon_code.trim(), 'course', courseFee, null, null);
      if ('error' in couponResult) return errorResponse(res, 400, couponResult.error);
      couponId        = couponResult.coupon.id;
      appliedCode     = couponResult.coupon.code;
      discountApplied = couponResult.discountApplied;
      finalAmount     = couponResult.finalAmount;
    }

    const installmentNumber = isEmi ? enrollment.emi_installments_paid + 1 : null;
    if (isEmi) {
      finalAmount = installmentNumber === 1 ? EMI_FIRST_INSTALLMENT : EMI_SUBSEQUENT_INSTALLMENT;
    }

    const order = await razorpay.orders.create({
      amount:   Math.round(finalAmount * 100), // paise
      currency: 'INR',
      receipt:  `course_${enrollment.id}_${Date.now()}`,
      notes:    { enrollment_id: String(enrollment.id), name: enrollment.name, phone: enrollment.phone },
    });

    // Store order id and coupon / amount details on the enrollment row
    await import('../config/database').then(({ execute }) =>
      execute(
        `UPDATE course_enrollments
            SET razorpay_order_id = ?,
                coupon_id         = ?,
                coupon_code       = ?,
                original_fee      = ?,
                discount_applied  = ?,
                amount_paid       = ?
          WHERE id = ?`,
        [order.id, couponId, appliedCode, isEmi ? finalAmount : courseFee, discountApplied, finalAmount, enrollment.id],
      ),
    );

    return successResponse(res, 201, 'Order created', {
      order_id:             order.id,
      amount:               finalAmount,
      original_amount:      isEmi ? finalAmount : courseFee,
      discount_applied:     discountApplied,
      coupon_code:          appliedCode,
      payment_plan:         enrollment.payment_plan,
      installment_number:   installmentNumber,
      total_installments:   isEmi ? EMI_TOTAL_INSTALLMENTS : null,
      currency:             'INR',
      key_id:               env.RAZORPAY_KEY_ID,
      enrollment_id:        enrollment.id,
      name:                 enrollment.name,
      email:                enrollment.email,
      phone:                enrollment.phone,
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
    const isEmi     = enrollment.payment_plan === 'emi';
    const amountPaid = isEmi ? (enrollment.amount_paid ?? EMI_FIRST_INSTALLMENT) : (enrollment.amount_paid ?? courseFee);

    const newInstallmentCount = isEmi ? (enrollment.emi_installments_paid ?? 0) + 1 : null;
    const emiFullyPaid        = isEmi && newInstallmentCount! >= EMI_TOTAL_INSTALLMENTS;

    await updateCourseEnrollmentPayment(enrollment.id, {
      payment_status:       isEmi && !emiFullyPaid ? 'emi_partial' : 'paid',
      razorpay_payment_id,
      razorpay_signature,
      payment_verified_at:  new Date(),
      ...(isEmi ? { emi_installments_paid: newInstallmentCount! } : {}),
    });

    // Record coupon usage if a coupon was applied at order creation (full plan only)
    if (enrollment.coupon_id) {
      void createCouponUsage({
        coupon_id:        enrollment.coupon_id,
        user_id:          null,
        applicable_type:  'course',
        payment_id:       null,
        appointment_id:   null,
        original_amount:  enrollment.original_fee ?? courseFee,
        discount_applied: enrollment.discount_applied ?? 0,
        final_amount:     amountPaid,
      }).catch((err) => console.error('Course coupon usage record failed:', err));
    }

    // Send success emails
    const userMail  = coursePaymentSuccessUserEmail(enrollment.name, {
      enrollmentId:      enrollment.id,
      email:             enrollment.email,
      phone:             enrollment.phone,
      amountPaid,
      razorpayPaymentId: razorpay_payment_id,
    });
    const adminMail = coursePaymentSuccessAdminEmail({
      enrollmentId:      enrollment.id,
      name:              enrollment.name,
      email:             enrollment.email,
      phone:             enrollment.phone,
      amountPaid,
      razorpayPaymentId: razorpay_payment_id,
      razorpayOrderId:   razorpay_order_id,
    });

    Promise.all([
      sendEmail({ to: enrollment.email, subject: userMail.subject,  html: userMail.html,  text: userMail.text }),
      sendEmail({ to: env.ADMIN_EMAIL,  subject: adminMail.subject, html: adminMail.html, text: adminMail.text }),
    ]).catch((err) => console.error('Course payment success email error:', err));

    sendCoursePaymentWhatsApp(enrollment.phone, enrollment.name, amountPaid, enrollment.id)
      .catch((err) => console.error('Course payment WhatsApp error:', err));

    return successResponse(res, 200, 'Payment verified successfully', {
      enrollment_id:          enrollment.id,
      name:                   enrollment.name,
      amount_paid:            amountPaid,
      payment_id:             razorpay_payment_id,
      payment_plan:           enrollment.payment_plan,
      emi_installments_paid:  newInstallmentCount ?? undefined,
      emi_total_installments: isEmi ? EMI_TOTAL_INSTALLMENTS : undefined,
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
