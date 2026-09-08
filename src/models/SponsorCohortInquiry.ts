import { query, execute } from '../config/database';

export interface SponsorCohortInquiry {
  id: number;
  org: string;
  designation: string | null;
  contact: string;
  org_type: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  cohort_size: string;
  message: string | null;
  is_read: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateSponsorCohortInquiryData {
  org: string;
  designation?: string | null;
  contact: string;
  org_type: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  cohort_size: string;
  message?: string | null;
}

export const createSponsorCohortInquiry = async (data: CreateSponsorCohortInquiryData) => {
  const result = await execute(
    `INSERT INTO sponsor_cohort_inquiries
       (org, designation, contact, org_type, email, phone, city, state, cohort_size, message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.org,
      data.designation ?? null,
      data.contact,
      data.org_type,
      data.email,
      data.phone,
      data.city,
      data.state,
      data.cohort_size,
      data.message ?? null,
    ],
  );
  const rows = await query<SponsorCohortInquiry>(
    'SELECT * FROM sponsor_cohort_inquiries WHERE id = ? LIMIT 1',
    [result.insertId],
  );
  return rows[0] ?? null;
};
