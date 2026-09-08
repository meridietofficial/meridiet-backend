import type { Request, Response } from 'express';
import { createPartnershipInquiry } from '../models/PartnershipInquiry';
import { sendEmail } from '../services/email';
import { partnershipInquiryAdminEmail } from '../services/emails/partnershipInquiryEmail';
import { successResponse, errorResponse } from '../utils/response';
import { env } from '../config/env';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const VALID_AREAS = [
  'Support a Cohort',
  'Corporate CSR',
  'NGO Partnership',
  'Government Program',
  'Individual Sponsorship',
  'Other',
];

// POST /api/v1/partnership-inquiry
export const submitPartnershipInquiry = async (req: Request, res: Response) => {
  try {
    const { org, name, email, phone, city, state, area, message } = req.body as Record<string, string | undefined>;

    if (!org?.trim())   return errorResponse(res, 400, 'org (Organization Name) is required');
    if (!name?.trim())  return errorResponse(res, 400, 'name (Contact Person) is required');
    if (!email?.trim()) return errorResponse(res, 400, 'email is required');
    if (!phone?.trim()) return errorResponse(res, 400, 'phone is required');

    if (!EMAIL_RE.test(email.trim())) return errorResponse(res, 400, 'A valid email address is required');

    if (area && area.trim() && !VALID_AREAS.includes(area.trim())) {
      return errorResponse(res, 400, `area must be one of: ${VALID_AREAS.join(', ')}`);
    }

    const saved = await createPartnershipInquiry({
      org:     org.trim(),
      name:    name.trim(),
      email:   email.trim().toLowerCase(),
      phone:   phone.trim(),
      city:    city?.trim()    || null,
      state:   state?.trim()   || null,
      area:    area?.trim()    || null,
      message: message?.trim() || null,
    });

    if (!saved) return errorResponse(res, 500, 'Failed to submit inquiry');

    const adminMail = partnershipInquiryAdminEmail({
      id:      saved.id,
      org:     saved.org,
      name:    saved.name,
      email:   saved.email,
      phone:   saved.phone,
      city:    saved.city,
      state:   saved.state,
      area:    saved.area,
      message: saved.message,
    });

    sendEmail({ to: env.ADMIN_EMAIL, subject: adminMail.subject, html: adminMail.html, text: adminMail.text })
      .catch((err) => console.error('Partnership inquiry admin email error:', err));

    return successResponse(res, 201, 'Partnership inquiry submitted successfully', {
      id:         saved.id,
      org:        saved.org,
      name:       saved.name,
      email:      saved.email,
      created_at: saved.created_at,
    });
  } catch (err) {
    console.error('submitPartnershipInquiry error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};
