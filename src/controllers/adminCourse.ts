import type { Request, Response } from 'express';
import { query, execute } from '../config/database';
import { successResponse, errorResponse } from '../utils/response';
import type { CourseEnquiry } from '../models/CourseEnquiry';
import type { CourseEnrollment } from '../models/CourseEnrollment';

// ─── Enquiries ────────────────────────────────────────────────────────────────

// GET /api/v1/admin/course/enquiries
// Query: page, limit, search, status
export const adminListEnquiries = async (req: Request, res: Response) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;
    const search = (req.query.search as string | undefined)?.trim() || '';
    const status = (req.query.status as string | undefined)?.trim() || '';

    const conditions: string[] = [];
    const params: unknown[]    = [];

    if (search) {
      conditions.push('(name LIKE ? OR email LIKE ? OR phone LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (['new', 'contacted', 'closed'].includes(status)) {
      conditions.push('status = ?');
      params.push(status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows, countRows] = await Promise.all([
      query<CourseEnquiry>(
        `SELECT * FROM course_enquiries ${where} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
        params,
      ),
      query<{ total: number }>(
        `SELECT COUNT(*) AS total FROM course_enquiries ${where}`,
        params,
      ),
    ]);

    const total      = countRows[0]?.total ?? 0;
    const totalPages = Math.ceil(total / limit);

    return successResponse(res, 200, 'Enquiries fetched successfully', rows, {
      page, limit, total, totalPages,
    });
  } catch (err) {
    console.error('Admin list enquiries error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/admin/course/enquiries/:id
export const adminGetEnquiry = async (req: Request, res: Response) => {
  try {
    const rows = await query<CourseEnquiry>(
      'SELECT * FROM course_enquiries WHERE id = ? LIMIT 1',
      [req.params.id],
    );
    if (!rows[0]) return errorResponse(res, 404, 'Enquiry not found');
    return successResponse(res, 200, 'Enquiry fetched', rows[0]);
  } catch (err) {
    console.error('Admin get enquiry error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// PATCH /api/v1/admin/course/enquiries/:id/status
// Body: { status: 'new' | 'contacted' | 'closed' }
export const adminUpdateEnquiryStatus = async (req: Request, res: Response) => {
  try {
    const { status } = req.body as { status?: string };
    if (!status || !['new', 'contacted', 'closed'].includes(status)) {
      return errorResponse(res, 400, 'status must be: new, contacted, or closed');
    }

    const rows = await query<CourseEnquiry>(
      'SELECT id FROM course_enquiries WHERE id = ? LIMIT 1',
      [req.params.id],
    );
    if (!rows[0]) return errorResponse(res, 404, 'Enquiry not found');

    await execute('UPDATE course_enquiries SET status = ? WHERE id = ?', [status, req.params.id]);

    return successResponse(res, 200, 'Enquiry status updated', { id: Number(req.params.id), status });
  } catch (err) {
    console.error('Admin update enquiry status error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// ─── Enrollments ──────────────────────────────────────────────────────────────

// GET /api/v1/admin/course/enrollments
// Query: page, limit, search, payment_status
export const adminListEnrollments = async (req: Request, res: Response) => {
  try {
    const page           = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit          = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset         = (page - 1) * limit;
    const search         = (req.query.search as string | undefined)?.trim() || '';
    const payment_status = (req.query.payment_status as string | undefined)?.trim() || '';

    const conditions: string[] = [];
    const params: unknown[]    = [];

    if (search) {
      conditions.push('(name LIKE ? OR email LIKE ? OR phone LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (['pending', 'paid', 'failed'].includes(payment_status)) {
      conditions.push('payment_status = ?');
      params.push(payment_status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows, countRows] = await Promise.all([
      query<CourseEnrollment>(
        `SELECT * FROM course_enrollments ${where} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
        params,
      ),
      query<{ total: number }>(
        `SELECT COUNT(*) AS total FROM course_enrollments ${where}`,
        params,
      ),
    ]);

    const total      = countRows[0]?.total ?? 0;
    const totalPages = Math.ceil(total / limit);

    return successResponse(res, 200, 'Enrollments fetched successfully', rows, {
      page, limit, total, totalPages,
    });
  } catch (err) {
    console.error('Admin list enrollments error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/admin/course/enrollments/:id
export const adminGetEnrollment = async (req: Request, res: Response) => {
  try {
    const rows = await query<CourseEnrollment>(
      'SELECT * FROM course_enrollments WHERE id = ? LIMIT 1',
      [req.params.id],
    );
    if (!rows[0]) return errorResponse(res, 404, 'Enrollment not found');
    return successResponse(res, 200, 'Enrollment fetched', rows[0]);
  } catch (err) {
    console.error('Admin get enrollment error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/admin/course/stats
export const adminCourseStats = async (_req: Request, res: Response) => {
  try {
    const [enrollStats, enquiryStats] = await Promise.all([
      query<{ payment_status: string; count: number; total_fee: number }>(
        `SELECT payment_status,
                COUNT(*)       AS count,
                SUM(course_fee) AS total_fee
         FROM course_enrollments
         GROUP BY payment_status`,
      ),
      query<{ status: string; count: number }>(
        `SELECT status, COUNT(*) AS count FROM course_enquiries GROUP BY status`,
      ),
    ]);

    const enrollMap  = Object.fromEntries(enrollStats.map((r) => [r.payment_status, r]));
    const enquiryMap = Object.fromEntries(enquiryStats.map((r) => [r.status, r]));

    return successResponse(res, 200, 'Course stats fetched', {
      enrollments: {
        total:         (enrollMap.pending?.count ?? 0) + (enrollMap.paid?.count ?? 0) + (enrollMap.failed?.count ?? 0),
        pending:       enrollMap.pending?.count  ?? 0,
        paid:          enrollMap.paid?.count     ?? 0,
        failed:        enrollMap.failed?.count   ?? 0,
        total_revenue: enrollMap.paid?.total_fee ?? 0,
      },
      enquiries: {
        total:     (enquiryMap.new?.count ?? 0) + (enquiryMap.contacted?.count ?? 0) + (enquiryMap.closed?.count ?? 0),
        new:       enquiryMap.new?.count       ?? 0,
        contacted: enquiryMap.contacted?.count ?? 0,
        closed:    enquiryMap.closed?.count    ?? 0,
      },
    });
  } catch (err) {
    console.error('Admin course stats error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};
