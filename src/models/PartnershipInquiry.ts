import { query, execute } from '../config/database';

export interface PartnershipInquiry {
  id: number;
  org: string;
  name: string;
  email: string;
  phone: string;
  city: string | null;
  state: string | null;
  area: string | null;
  message: string | null;
  is_read: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePartnershipInquiryData {
  org: string;
  name: string;
  email: string;
  phone: string;
  city?: string | null;
  state?: string | null;
  area?: string | null;
  message?: string | null;
}

export const createPartnershipInquiry = async (data: CreatePartnershipInquiryData) => {
  const result = await execute(
    `INSERT INTO partnership_inquiries (org, name, email, phone, city, state, area, message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.org,
      data.name,
      data.email,
      data.phone,
      data.city ?? null,
      data.state ?? null,
      data.area ?? null,
      data.message ?? null,
    ],
  );
  const rows = await query<PartnershipInquiry>(
    'SELECT * FROM partnership_inquiries WHERE id = ? LIMIT 1',
    [result.insertId],
  );
  return rows[0] ?? null;
};
