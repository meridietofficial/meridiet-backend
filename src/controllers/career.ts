import type { Request, Response } from 'express';
import { query, execute } from '../config/database';
import { successResponse, errorResponse } from '../utils/response';

interface JobPosting {
  id: number;
  title: string;
  department: string;
  location: string;
  job_type: string;
  experience_required: string;
  description: string;
  responsibilities: string;
  requirements: string;
  salary_range: string | null;
  is_active: number;
  deadline: string | null;
  created_at: string;
  updated_at: string;
}

interface JobApplication {
  id: number;
  job_id: number;
  full_name: string;
  email: string;
  phone: string;
  current_location: string;
  total_experience: string;
  current_company: string | null;
  current_ctc: string | null;
  expected_ctc: string | null;
  notice_period: string | null;
  resume_url: string;
  cover_letter: string | null;
  linkedin_url: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

// ── PUBLIC ────────────────────────────────────────────────────────────────────

// GET /api/v1/career/jobs
export const listActiveJobs = async (req: Request, res: Response) => {
  try {
    const department = (req.query.department as string) || '';
    const job_type   = (req.query.job_type   as string) || '';

    const conditions: string[] = ['is_active = 1', '(deadline IS NULL OR deadline >= CURDATE())'];
    const params: unknown[] = [];

    if (department) { conditions.push('department = ?'); params.push(department); }
    if (job_type)   { conditions.push('job_type = ?');   params.push(job_type); }

    const where = conditions.join(' AND ');

    const jobs = await query<JobPosting>(
      `SELECT id, title, department, location, job_type, experience_required,
              description, responsibilities, requirements, salary_range, deadline, created_at
       FROM job_postings
       WHERE ${where}
       ORDER BY created_at DESC`,
      params,
    );

    const parsed = jobs.map((j) => ({
      ...j,
      responsibilities: safeParseJson(j.responsibilities),
      requirements:     safeParseJson(j.requirements),
    }));

    return successResponse(res, 200, 'Jobs fetched', parsed);
  } catch (err) {
    console.error('listActiveJobs error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/career/jobs/:id
export const getJobById = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid job ID');

    const rows = await query<JobPosting>(
      `SELECT id, title, department, location, job_type, experience_required,
              description, responsibilities, requirements, salary_range, deadline, created_at
       FROM job_postings WHERE id = ? AND is_active = 1 AND (deadline IS NULL OR deadline >= CURDATE())`,
      [id],
    );

    if (!rows.length) return errorResponse(res, 404, 'Job not found');

    const job = rows[0]!;
    return successResponse(res, 200, 'Job fetched', {
      ...job,
      responsibilities: safeParseJson(job.responsibilities),
      requirements:     safeParseJson(job.requirements),
    });
  } catch (err) {
    console.error('getJobById error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// POST /api/v1/career/jobs/:id/apply
export const applyForJob = async (req: Request, res: Response) => {
  try {
    const jobId = parseInt(req.params.id);
    if (isNaN(jobId)) return errorResponse(res, 400, 'Invalid job ID');

    const {
      full_name, email, phone, current_location, total_experience,
      current_company, current_ctc, expected_ctc, notice_period,
      resume_url, cover_letter, linkedin_url,
    } = req.body as Record<string, string | undefined>;

    if (!full_name?.trim())         return errorResponse(res, 400, 'full_name is required');
    if (!email?.trim())             return errorResponse(res, 400, 'email is required');
    if (!phone?.trim())             return errorResponse(res, 400, 'phone is required');
    if (!current_location?.trim())  return errorResponse(res, 400, 'current_location is required');
    if (!total_experience?.trim())  return errorResponse(res, 400, 'total_experience is required');
    if (!resume_url?.trim())        return errorResponse(res, 400, 'resume_url is required');

    // Verify job exists and is open
    const jobs = await query<{ id: number }>(
      `SELECT id FROM job_postings WHERE id = ? AND is_active = 1 AND (deadline IS NULL OR deadline >= CURDATE())`,
      [jobId],
    );
    if (!jobs.length) return errorResponse(res, 404, 'Job not found or no longer accepting applications');

    // Prevent duplicate applications from same email for same job
    const existing = await query<{ id: number }>(
      'SELECT id FROM job_applications WHERE job_id = ? AND email = ?',
      [jobId, email.trim().toLowerCase()],
    );
    if (existing.length) return errorResponse(res, 409, 'You have already applied for this position');

    const result = await execute(
      `INSERT INTO job_applications
         (job_id, full_name, email, phone, current_location, total_experience,
          current_company, current_ctc, expected_ctc, notice_period,
          resume_url, cover_letter, linkedin_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        jobId,
        full_name.trim(),
        email.trim().toLowerCase(),
        phone.trim(),
        current_location.trim(),
        total_experience.trim(),
        current_company?.trim() || null,
        current_ctc?.trim()     || null,
        expected_ctc?.trim()    || null,
        notice_period?.trim()   || null,
        resume_url.trim(),
        cover_letter?.trim()    || null,
        linkedin_url?.trim()    || null,
      ],
    );

    return successResponse(res, 201, 'Application submitted successfully', { id: result.insertId });
  } catch (err) {
    console.error('applyForJob error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// ── ADMIN ─────────────────────────────────────────────────────────────────────

// GET /api/v1/admin/career/jobs
export const adminListJobs = async (req: Request, res: Response) => {
  try {
    const page       = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit      = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset     = (page - 1) * limit;
    const search     = (req.query.search     as string) || '';
    const department = (req.query.department as string) || '';
    const is_active  = req.query.is_active;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (search)     { conditions.push('(title LIKE ? OR department LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
    if (department) { conditions.push('department = ?'); params.push(department); }
    if (is_active !== undefined) { conditions.push('is_active = ?'); params.push(Number(is_active)); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows, countRows] = await Promise.all([
      query<JobPosting & { application_count: number }>(
        `SELECT jp.*,
                (SELECT COUNT(*) FROM job_applications ja WHERE ja.job_id = jp.id) AS application_count
         FROM job_postings jp
         ${where}
         ORDER BY jp.created_at DESC
         LIMIT ${limit} OFFSET ${offset}`,
        params,
      ),
      query<{ total: number }>(`SELECT COUNT(*) AS total FROM job_postings ${where}`, params),
    ]);

    const total = countRows[0]?.total ?? 0;

    return successResponse(res, 200, 'Jobs fetched', rows.map((j) => ({
      ...j,
      responsibilities: safeParseJson(j.responsibilities as unknown as string),
      requirements:     safeParseJson(j.requirements     as unknown as string),
    })), { page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('adminListJobs error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// POST /api/v1/admin/career/jobs
export const adminCreateJob = async (req: Request, res: Response) => {
  try {
    const {
      title, department, location, job_type, experience_required,
      description, responsibilities, requirements, salary_range, is_active, deadline,
    } = req.body as Record<string, unknown>;

    if (!title)               return errorResponse(res, 400, 'title is required');
    if (!department)          return errorResponse(res, 400, 'department is required');
    if (!location)            return errorResponse(res, 400, 'location is required');
    if (!job_type)            return errorResponse(res, 400, 'job_type is required');
    if (!experience_required) return errorResponse(res, 400, 'experience_required is required');
    if (!description)         return errorResponse(res, 400, 'description is required');
    if (!Array.isArray(responsibilities) || responsibilities.length === 0)
      return errorResponse(res, 400, 'responsibilities must be a non-empty array');
    if (!Array.isArray(requirements) || requirements.length === 0)
      return errorResponse(res, 400, 'requirements must be a non-empty array');

    const validJobTypes = ['full_time', 'part_time', 'contract', 'internship'];
    if (!validJobTypes.includes(job_type as string))
      return errorResponse(res, 400, `job_type must be one of: ${validJobTypes.join(', ')}`);

    const result = await execute(
      `INSERT INTO job_postings
         (title, department, location, job_type, experience_required, description,
          responsibilities, requirements, salary_range, is_active, deadline)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        (title as string).trim(),
        (department as string).trim(),
        (location as string).trim(),
        job_type,
        (experience_required as string).trim(),
        (description as string).trim(),
        JSON.stringify(responsibilities),
        JSON.stringify(requirements),
        (salary_range as string | undefined)?.trim() || null,
        is_active !== undefined ? Number(is_active) : 1,
        (deadline as string | undefined) || null,
      ],
    );

    return successResponse(res, 201, 'Job posting created', { id: result.insertId });
  } catch (err) {
    console.error('adminCreateJob error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/admin/career/jobs/:id
export const adminGetJob = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid job ID');

    const rows = await query<JobPosting>(
      'SELECT * FROM job_postings WHERE id = ?',
      [id],
    );
    if (!rows.length) return errorResponse(res, 404, 'Job not found');

    const job = rows[0]!;
    return successResponse(res, 200, 'Job fetched', {
      ...job,
      responsibilities: safeParseJson(job.responsibilities),
      requirements:     safeParseJson(job.requirements),
    });
  } catch (err) {
    console.error('adminGetJob error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// PUT /api/v1/admin/career/jobs/:id
export const adminUpdateJob = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid job ID');

    const rows = await query<{ id: number }>('SELECT id FROM job_postings WHERE id = ?', [id]);
    if (!rows.length) return errorResponse(res, 404, 'Job not found');

    const {
      title, department, location, job_type, experience_required,
      description, responsibilities, requirements, salary_range, is_active, deadline,
    } = req.body as Record<string, unknown>;

    const setClauses: string[] = [];
    const params: unknown[] = [];

    if (title !== undefined)               { setClauses.push('title = ?');               params.push((title as string).trim()); }
    if (department !== undefined)          { setClauses.push('department = ?');           params.push((department as string).trim()); }
    if (location !== undefined)            { setClauses.push('location = ?');             params.push((location as string).trim()); }
    if (job_type !== undefined)            { setClauses.push('job_type = ?');             params.push(job_type); }
    if (experience_required !== undefined) { setClauses.push('experience_required = ?'); params.push((experience_required as string).trim()); }
    if (description !== undefined)         { setClauses.push('description = ?');          params.push((description as string).trim()); }
    if (responsibilities !== undefined)    { setClauses.push('responsibilities = ?');     params.push(JSON.stringify(responsibilities)); }
    if (requirements !== undefined)        { setClauses.push('requirements = ?');         params.push(JSON.stringify(requirements)); }
    if (salary_range !== undefined)        { setClauses.push('salary_range = ?');         params.push((salary_range as string | null) || null); }
    if (is_active !== undefined)           { setClauses.push('is_active = ?');            params.push(Number(is_active)); }
    if (deadline !== undefined)            { setClauses.push('deadline = ?');             params.push((deadline as string | null) || null); }

    if (!setClauses.length) return errorResponse(res, 400, 'No fields to update');

    params.push(id);
    await execute(`UPDATE job_postings SET ${setClauses.join(', ')} WHERE id = ?`, params);

    return successResponse(res, 200, 'Job posting updated');
  } catch (err) {
    console.error('adminUpdateJob error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// DELETE /api/v1/admin/career/jobs/:id
export const adminDeleteJob = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid job ID');

    const rows = await query<{ id: number }>('SELECT id FROM job_postings WHERE id = ?', [id]);
    if (!rows.length) return errorResponse(res, 404, 'Job not found');

    await execute('DELETE FROM job_postings WHERE id = ?', [id]);

    return successResponse(res, 200, 'Job posting deleted');
  } catch (err) {
    console.error('adminDeleteJob error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// PATCH /api/v1/admin/career/jobs/:id/toggle
export const adminToggleJob = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid job ID');

    const rows = await query<{ id: number; is_active: number }>('SELECT id, is_active FROM job_postings WHERE id = ?', [id]);
    if (!rows.length) return errorResponse(res, 404, 'Job not found');

    const newStatus = rows[0]!.is_active ? 0 : 1;
    await execute('UPDATE job_postings SET is_active = ? WHERE id = ?', [newStatus, id]);

    return successResponse(res, 200, `Job ${newStatus ? 'activated' : 'deactivated'}`, { is_active: newStatus });
  } catch (err) {
    console.error('adminToggleJob error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/admin/career/applications
export const adminListApplications = async (req: Request, res: Response) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;
    const search = (req.query.search as string) || '';
    const job_id = req.query.job_id ? parseInt(req.query.job_id as string) : null;
    const status = (req.query.status as string) || '';

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (search)  { conditions.push('(ja.full_name LIKE ? OR ja.email LIKE ? OR ja.phone LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (job_id)  { conditions.push('ja.job_id = ?'); params.push(job_id); }
    if (status)  { conditions.push('ja.status = ?'); params.push(status); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows, countRows] = await Promise.all([
      query<JobApplication & { job_title: string; job_department: string }>(
        `SELECT ja.*, jp.title AS job_title, jp.department AS job_department
         FROM job_applications ja
         LEFT JOIN job_postings jp ON jp.id = ja.job_id
         ${where}
         ORDER BY ja.created_at DESC
         LIMIT ${limit} OFFSET ${offset}`,
        params,
      ),
      query<{ total: number }>(
        `SELECT COUNT(*) AS total FROM job_applications ja ${where}`,
        params,
      ),
    ]);

    const total = countRows[0]?.total ?? 0;

    return successResponse(res, 200, 'Applications fetched', rows, {
      page, limit, total, totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('adminListApplications error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/admin/career/applications/:id
export const adminGetApplication = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid application ID');

    const rows = await query<JobApplication & { job_title: string; job_department: string; job_location: string }>(
      `SELECT ja.*, jp.title AS job_title, jp.department AS job_department, jp.location AS job_location
       FROM job_applications ja
       LEFT JOIN job_postings jp ON jp.id = ja.job_id
       WHERE ja.id = ?`,
      [id],
    );

    if (!rows.length) return errorResponse(res, 404, 'Application not found');

    return successResponse(res, 200, 'Application fetched', rows[0]);
  } catch (err) {
    console.error('adminGetApplication error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// PATCH /api/v1/admin/career/applications/:id/status
export const adminUpdateApplicationStatus = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid application ID');

    const { status, admin_notes } = req.body as { status?: string; admin_notes?: string };

    const validStatuses = ['new', 'reviewing', 'shortlisted', 'rejected', 'hired'];
    if (!status) return errorResponse(res, 400, 'status is required');
    if (!validStatuses.includes(status)) return errorResponse(res, 400, `status must be one of: ${validStatuses.join(', ')}`);

    const rows = await query<{ id: number }>('SELECT id FROM job_applications WHERE id = ?', [id]);
    if (!rows.length) return errorResponse(res, 404, 'Application not found');

    const setClauses = ['status = ?'];
    const params: unknown[] = [status];

    if (admin_notes !== undefined) { setClauses.push('admin_notes = ?'); params.push(admin_notes?.trim() || null); }

    params.push(id);
    await execute(`UPDATE job_applications SET ${setClauses.join(', ')} WHERE id = ?`, params);

    return successResponse(res, 200, 'Application status updated');
  } catch (err) {
    console.error('adminUpdateApplicationStatus error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeParseJson(val: string): unknown {
  try { return JSON.parse(val); } catch { return val; }
}
