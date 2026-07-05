import type { Request, Response } from 'express';
import { adminListAppointments, adminGetAppointmentDetail } from '../models/Appointment';
import { getRescheduleHistory } from '../models/AppointmentRescheduleHistory';
import { successResponse, errorResponse } from '../utils/response';

// GET /api/v1/admin/appointments
// Query params: page, limit, status, payment_status, session_type, dietitian_id, date_from, date_to, search
export const adminGetAppointments = async (req: Request, res: Response) => {
  try {
    const {
      page,
      limit,
      status,
      payment_status,
      session_type,
      dietitian_id,
      date_from,
      date_to,
      search,
    } = req.query as Record<string, string | undefined>;

    const validStatuses  = ['pending', 'confirmed', 'completed', 'cancelled', 'missed'];
    const validPayments  = ['unpaid', 'paid', 'refunded'];
    const validSessions  = ['video_call', 'in_person'];

    if (status && !validStatuses.includes(status)) {
      return errorResponse(res, 400, `status must be one of: ${validStatuses.join(', ')}`);
    }
    if (payment_status && !validPayments.includes(payment_status)) {
      return errorResponse(res, 400, `payment_status must be one of: ${validPayments.join(', ')}`);
    }
    if (session_type && !validSessions.includes(session_type)) {
      return errorResponse(res, 400, `session_type must be one of: ${validSessions.join(', ')}`);
    }
    if (date_from && !/^\d{4}-\d{2}-\d{2}$/.test(date_from)) {
      return errorResponse(res, 400, 'date_from must be YYYY-MM-DD');
    }
    if (date_to && !/^\d{4}-\d{2}-\d{2}$/.test(date_to)) {
      return errorResponse(res, 400, 'date_to must be YYYY-MM-DD');
    }

    const result = await adminListAppointments({
      page:           page   ? Number(page)  : 1,
      limit:          limit  ? Number(limit) : 20,
      status,
      payment_status,
      session_type,
      dietitian_id:   dietitian_id ? Number(dietitian_id) : undefined,
      date_from,
      date_to,
      search:         search?.trim() || undefined,
    });

    return successResponse(res, 200, 'Appointments fetched', {
      appointments: result.appointments,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        pages: Math.ceil(result.total / result.limit),
      },
    });
  } catch (err) {
    console.error('Admin get appointments error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// GET /api/v1/admin/appointments/:id
export const adminGetAppointmentById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid appointment ID');

    const [appointment, rescheduleHistory] = await Promise.all([
      adminGetAppointmentDetail(id),
      getRescheduleHistory(id),
    ]);

    if (!appointment) return errorResponse(res, 404, 'Appointment not found');

    return successResponse(res, 200, 'Appointment fetched', {
      ...appointment,
      reschedule_history: rescheduleHistory,
    });
  } catch (err) {
    console.error('Admin get appointment detail error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};
