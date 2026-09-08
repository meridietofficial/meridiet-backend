import type { Request, Response } from 'express';
import { createSponsorCohortInquiry } from '../models/SponsorCohortInquiry';
import { sendEmail } from '../services/email';
import { sponsorCohortAdminEmail } from '../services/emails/sponsorCohortEmail';
import { successResponse, errorResponse } from '../utils/response';
import { env } from '../config/env';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const VALID_ORG_TYPES = [
  'NGO',
  'Corporate / CSR',
  'Government Body',
  'Foundation',
  'Individual',
  'Other',
];

const VALID_COHORT_SIZES = [
  '25 Women – Pilot Cohort',
  '50 Women – Community Cohort',
  '100 Women – Impact Cohort',
  '500+ Women – Transform Communities',
];

const VALID_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

// POST /api/v1/sponsor-cohort
export const submitSponsorCohort = async (req: Request, res: Response) => {
  try {
    const { org, designation, contact, orgType, email, phone, city, state, cohortSize, message } =
      req.body as Record<string, string | undefined>;

    if (!org?.trim())         return errorResponse(res, 400, 'org (Organization Name) is required');
    if (!contact?.trim())     return errorResponse(res, 400, 'contact (Contact Person) is required');
    if (!orgType?.trim())     return errorResponse(res, 400, 'orgType (Organization Type) is required');
    if (!email?.trim())       return errorResponse(res, 400, 'email is required');
    if (!phone?.trim())       return errorResponse(res, 400, 'phone is required');
    if (!city?.trim())        return errorResponse(res, 400, 'city is required');
    if (!state?.trim())       return errorResponse(res, 400, 'state is required');
    if (!cohortSize?.trim())  return errorResponse(res, 400, 'cohortSize (Preferred Cohort Size) is required');

    if (!EMAIL_RE.test(email.trim()))
      return errorResponse(res, 400, 'A valid email address is required');

    if (!VALID_ORG_TYPES.includes(orgType.trim()))
      return errorResponse(res, 400, `orgType must be one of: ${VALID_ORG_TYPES.join(', ')}`);

    if (!VALID_STATES.includes(state.trim()))
      return errorResponse(res, 400, 'Please provide a valid Indian state or UT');

    if (!VALID_COHORT_SIZES.includes(cohortSize.trim()))
      return errorResponse(res, 400, `cohortSize must be one of: ${VALID_COHORT_SIZES.join(', ')}`);

    const saved = await createSponsorCohortInquiry({
      org:         org.trim(),
      designation: designation?.trim() || null,
      contact:     contact.trim(),
      org_type:    orgType.trim(),
      email:       email.trim().toLowerCase(),
      phone:       phone.trim(),
      city:        city.trim(),
      state:       state.trim(),
      cohort_size: cohortSize.trim(),
      message:     message?.trim() || null,
    });

    if (!saved) return errorResponse(res, 500, 'Failed to submit inquiry');

    const adminMail = sponsorCohortAdminEmail({
      id:          saved.id,
      org:         saved.org,
      designation: saved.designation,
      contact:     saved.contact,
      org_type:    saved.org_type,
      email:       saved.email,
      phone:       saved.phone,
      city:        saved.city,
      state:       saved.state,
      cohort_size: saved.cohort_size,
      message:     saved.message,
    });

    sendEmail({ to: env.ADMIN_EMAIL, subject: adminMail.subject, html: adminMail.html, text: adminMail.text })
      .catch((err) => console.error('Sponsor cohort admin email error:', err));

    return successResponse(res, 201, 'Sponsor inquiry submitted successfully', {
      id:          saved.id,
      org:         saved.org,
      contact:     saved.contact,
      cohort_size: saved.cohort_size,
      created_at:  saved.created_at,
    });
  } catch (err) {
    console.error('submitSponsorCohort error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};
