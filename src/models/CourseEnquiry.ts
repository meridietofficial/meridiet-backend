import { query, execute } from '../config/database';

export interface CourseEnquiry {
  id: number;
  name: string;
  email: string;
  phone: string;
  qualification: string | null;
  message: string | null;
  status: 'new' | 'contacted' | 'closed';
  created_at: Date;
  updated_at: Date;
}

export interface CreateCourseEnquiryData {
  name: string;
  email: string;
  phone: string;
  qualification?: string | null;
  message?: string | null;
}

export const createCourseEnquiry = async (data: CreateCourseEnquiryData): Promise<CourseEnquiry | null> => {
  const result = await execute(
    `INSERT INTO course_enquiries (name, email, phone, qualification, message)
     VALUES (?, ?, ?, ?, ?)`,
    [data.name, data.email, data.phone, data.qualification ?? null, data.message ?? null],
  );
  const rows = await query<CourseEnquiry>('SELECT * FROM course_enquiries WHERE id = ? LIMIT 1', [result.insertId]);
  return rows[0] ?? null;
};

export const getAllCourseEnquiries = async (): Promise<CourseEnquiry[]> => {
  return query<CourseEnquiry>('SELECT * FROM course_enquiries ORDER BY created_at DESC');
};
