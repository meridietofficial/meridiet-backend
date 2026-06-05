import { query, execute } from '../config/database';

export interface ContactMessage {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  subject: string | null;
  message: string;
  is_read: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateContactMessageData {
  name: string;
  email?: string | null;
  phone?: string | null;
  subject?: string | null;
  message: string;
}

export const createContactMessage = async (data: CreateContactMessageData) => {
  const result = await execute(
    `INSERT INTO contact_us (name, email, phone, subject, message)
     VALUES (?, ?, ?, ?, ?)`,
    [data.name, data.email, data.phone ?? null, data.subject ?? null, data.message],
  );
  const rows = await query<ContactMessage>('SELECT * FROM contact_us WHERE id = ? LIMIT 1', [result.insertId]);
  return rows[0] ?? null;
};
