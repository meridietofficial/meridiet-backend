import type { Request, Response } from 'express';
import { createContactMessage } from '../models/ContactMessage';
import { successResponse, errorResponse } from '../utils/response';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/v1/contact
// Public — submit a contact / enquiry message.
export const submitContact = async (req: Request, res: Response) => {
  try {
    const { name, email, phone, subject, message } = req.body as {
      name?: string;
      email?: string;
      phone?: string;
      subject?: string;
      message?: string;
    };

    if (!name || !name.trim())       return errorResponse(res, 400, 'name is required');
    if (!message || !message.trim()) return errorResponse(res, 400, 'message is required');
    // email & phone are optional, but validate the email format if one is given
    if (email && email.trim() && !EMAIL_RE.test(email.trim())) {
      return errorResponse(res, 400, 'A valid email is required');
    }

    const saved = await createContactMessage({
      name: name.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      subject: subject?.trim() || null,
      message: message.trim(),
    });

    if (!saved) return errorResponse(res, 500, 'Failed to submit message');

    return successResponse(res, 201, 'Message submitted successfully', {
      id: saved.id,
      name: saved.name,
      email: saved.email,
      subject: saved.subject,
      created_at: saved.created_at,
    });
  } catch (err) {
    console.error('Submit contact error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};
