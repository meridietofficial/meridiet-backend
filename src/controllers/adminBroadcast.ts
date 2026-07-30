import type { Request, Response } from 'express';
import { query, execute } from '../config/database';
import { successResponse, errorResponse } from '../utils/response';
import { sendEmail } from '../services/email';
import { adminBroadcastEmail } from '../services/emails/adminBroadcast';

// How many days recipient-level detail rows are kept before nightly purge.
export const RECIPIENT_RETENTION_DAYS = 30;

interface RecipientRow {
  id: number;
  full_name: string;
  email: string;
  type: 'user' | 'dietitian';
  is_active: number;
}

// ── GET /api/v1/admin/broadcast/recipients ────────────────────────────────────
// Query: type=all|users|dietitians  search  page  limit
export const getBroadcastRecipients = async (req: Request, res: Response) => {
  try {
    const type = (req.query.type as string) || 'all';
    const search = (req.query.search as string) || '';
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * limit;

    if (!['all', 'users', 'dietitians'].includes(type)) {
      return errorResponse(res, 400, 'type must be: all, users, or dietitians');
    }

    const searchCond = search ? '(u.full_name LIKE ? OR u.email LIKE ?)' : null;
    const searchParams: unknown[] = search ? [`%${search}%`, `%${search}%`] : [];

    let selectSql: string;
    let countSql: string;

    if (type === 'users') {
      const where = [
        "u.role = 'user'", 'u.is_delete = 0', 'u.email IS NOT NULL',
        ...(searchCond ? [searchCond] : []),
      ].join(' AND ');
      selectSql = `SELECT u.id, u.full_name, u.email, 'user' AS type, u.is_active FROM users u WHERE ${where} ORDER BY u.full_name ASC LIMIT ${limit} OFFSET ${offset}`;
      countSql  = `SELECT COUNT(*) AS total FROM users u WHERE ${where}`;
    } else if (type === 'dietitians') {
      const where = [
        "u.role = 'dietitian'", 'u.is_delete = 0', 'u.email IS NOT NULL',
        ...(searchCond ? [searchCond] : []),
      ].join(' AND ');
      selectSql = `SELECT u.id, u.full_name, u.email, 'dietitian' AS type, u.is_active FROM users u INNER JOIN dietitians d ON d.user_id = u.id WHERE ${where} ORDER BY u.full_name ASC LIMIT ${limit} OFFSET ${offset}`;
      countSql  = `SELECT COUNT(*) AS total FROM users u INNER JOIN dietitians d ON d.user_id = u.id WHERE ${where}`;
    } else {
      const where = [
        "u.role IN ('user', 'dietitian')", 'u.is_delete = 0', 'u.email IS NOT NULL',
        ...(searchCond ? [searchCond] : []),
      ].join(' AND ');
      selectSql = `SELECT u.id, u.full_name, u.email, u.role AS type, u.is_active FROM users u WHERE ${where} ORDER BY u.full_name ASC LIMIT ${limit} OFFSET ${offset}`;
      countSql  = `SELECT COUNT(*) AS total FROM users u WHERE ${where}`;
    }

    const [rows, countRows] = await Promise.all([
      query<RecipientRow>(selectSql, searchParams),
      query<{ total: number }>(countSql, searchParams),
    ]);

    const total = countRows[0]?.total ?? 0;

    return successResponse(res, 200, 'Recipients fetched', rows, {
      page, limit, total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('getBroadcastRecipients error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// ── POST /api/v1/admin/broadcast/send ────────────────────────────────────────
// Body: { recipient_type, recipient_ids?, subject, message }
export const sendBroadcastEmail = async (req: Request, res: Response) => {
  try {
    const adminId = Number(req.user!.sub);
    const { recipient_type, recipient_ids, subject, message } = req.body as {
      recipient_type: string;
      recipient_ids?: unknown[];
      subject: string;
      message: string;
    };

    if (!subject?.trim()) return errorResponse(res, 400, 'subject is required');
    if (!message?.trim()) return errorResponse(res, 400, 'message is required');
    if (!recipient_type) return errorResponse(res, 400, 'recipient_type is required');

    if (!['all', 'users', 'dietitians', 'selected'].includes(recipient_type)) {
      return errorResponse(res, 400, 'recipient_type must be: all, users, dietitians, or selected');
    }

    if (recipient_type === 'selected' && (!Array.isArray(recipient_ids) || recipient_ids.length === 0)) {
      return errorResponse(res, 400, 'recipient_ids must be a non-empty array when recipient_type is selected');
    }

    // Fetch all matching recipients (no pagination — we want every email)
    let recipients: { id: number; full_name: string; email: string }[] = [];

    if (recipient_type === 'selected') {
      const ids = (recipient_ids as unknown[]).map(Number).filter((n) => !isNaN(n));
      if (ids.length === 0) return errorResponse(res, 400, 'No valid recipient IDs provided');
      const placeholders = ids.map(() => '?').join(', ');
      recipients = await query<{ id: number; full_name: string; email: string }>(
        `SELECT id, full_name, email FROM users WHERE id IN (${placeholders}) AND is_delete = 0 AND email IS NOT NULL`,
        ids,
      );
    } else {
      let roleFilter: string;
      if (recipient_type === 'users')      roleFilter = "role = 'user'";
      else if (recipient_type === 'dietitians') roleFilter = "role = 'dietitian'";
      else                                 roleFilter = "role IN ('user', 'dietitian')";

      recipients = await query<{ id: number; full_name: string; email: string }>(
        `SELECT id, full_name, email FROM users WHERE ${roleFilter} AND is_delete = 0 AND is_active = 1 AND email IS NOT NULL`,
        [],
      );
    }

    if (recipients.length === 0) {
      return successResponse(res, 200, 'No recipients found', { sent: 0, failed: 0, failed_emails: [] });
    }

    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();

    // Send emails in concurrent batches of 5
    const BATCH_SIZE = 5;
    let sent = 0;
    let failed = 0;
    const results: { userId: number; email: string; fullName: string; status: 'sent' | 'failed' }[] = [];

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);
      const settled = await Promise.allSettled(
        batch.map((r) => {
          const { html, text } = adminBroadcastEmail({
            recipientName: r.full_name,
            subject: trimmedSubject,
            message: trimmedMessage,
          });
          return sendEmail({ to: r.email, subject: trimmedSubject, html, text });
        }),
      );

      settled.forEach((result, idx) => {
        const r = batch[idx]!;
        if (result.status === 'fulfilled') {
          sent++;
          results.push({ userId: r.id, email: r.email, fullName: r.full_name, status: 'sent' });
        } else {
          failed++;
          results.push({ userId: r.id, email: r.email, fullName: r.full_name, status: 'failed' });
          console.error(`Broadcast email failed for ${r.email}:`, result.reason);
        }
      });
    }

    // ── Persist broadcast log ─────────────────────────────────────────────────
    const logResult = await execute(
      `INSERT INTO broadcast_logs (admin_id, recipient_type, subject, message, total_recipients, sent_count, failed_count)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [adminId, recipient_type, trimmedSubject, trimmedMessage, recipients.length, sent, failed],
    );
    const broadcastId = logResult.insertId;

    // Bulk-insert recipient detail rows in chunks of 200
    const INSERT_CHUNK = 200;
    for (let i = 0; i < results.length; i += INSERT_CHUNK) {
      const chunk = results.slice(i, i + INSERT_CHUNK);
      const placeholders = chunk.map(() => '(?, ?, ?, ?, ?)').join(', ');
      const values: unknown[] = chunk.flatMap((r) => [broadcastId, r.userId, r.email, r.fullName, r.status]);
      await execute(
        `INSERT INTO broadcast_recipients (broadcast_id, user_id, email, full_name, status) VALUES ${placeholders}`,
        values,
      );
    }

    return successResponse(res, 200, `Broadcast complete. Sent: ${sent}, Failed: ${failed}`, {
      broadcast_id: broadcastId,
      sent,
      failed,
      failed_emails: results.filter((r) => r.status === 'failed').map((r) => r.email),
    });
  } catch (err) {
    console.error('sendBroadcastEmail error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// ── GET /api/v1/admin/broadcast/history ──────────────────────────────────────
// Query: page  limit
export const getBroadcastHistory = async (req: Request, res: Response) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;

    const [rows, countRows] = await Promise.all([
      query<{
        id: number;
        admin_id: number;
        admin_name: string;
        recipient_type: string;
        subject: string;
        message_preview: string;
        total_recipients: number;
        sent_count: number;
        failed_count: number;
        detail_available: number;
        created_at: string;
      }>(
        `SELECT
           bl.id,
           bl.admin_id,
           u.full_name        AS admin_name,
           bl.recipient_type,
           bl.subject,
           LEFT(bl.message, 200) AS message_preview,
           bl.total_recipients,
           bl.sent_count,
           bl.failed_count,
           (bl.created_at > DATE_SUB(NOW(), INTERVAL ${RECIPIENT_RETENTION_DAYS} DAY)) AS detail_available,
           bl.created_at
         FROM broadcast_logs bl
         LEFT JOIN users u ON u.id = bl.admin_id
         ORDER BY bl.created_at DESC
         LIMIT ${limit} OFFSET ${offset}`,
        [],
      ),
      query<{ total: number }>('SELECT COUNT(*) AS total FROM broadcast_logs', []),
    ]);

    const total = countRows[0]?.total ?? 0;

    return successResponse(res, 200, 'Broadcast history fetched', rows, {
      page, limit, total,
      totalPages: Math.ceil(total / limit),
      recipient_detail_retention_days: RECIPIENT_RETENTION_DAYS,
    });
  } catch (err) {
    console.error('getBroadcastHistory error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};

// ── GET /api/v1/admin/broadcast/history/:id ───────────────────────────────────
// Returns the broadcast log + recipient list (paginated) if within retention window.
export const getBroadcastDetail = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return errorResponse(res, 400, 'Invalid broadcast ID');

    const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * limit;

    // Fetch the log
    const logs = await query<{
      id: number;
      admin_id: number;
      admin_name: string;
      recipient_type: string;
      subject: string;
      message: string;
      total_recipients: number;
      sent_count: number;
      failed_count: number;
      detail_available: number;
      created_at: string;
    }>(
      `SELECT
         bl.id,
         bl.admin_id,
         u.full_name AS admin_name,
         bl.recipient_type,
         bl.subject,
         bl.message,
         bl.total_recipients,
         bl.sent_count,
         bl.failed_count,
         (bl.created_at > DATE_SUB(NOW(), INTERVAL ${RECIPIENT_RETENTION_DAYS} DAY)) AS detail_available,
         bl.created_at
       FROM broadcast_logs bl
       LEFT JOIN users u ON u.id = bl.admin_id
       WHERE bl.id = ?`,
      [id],
    );

    if (!logs.length) return errorResponse(res, 404, 'Broadcast not found');
    const log = logs[0]!;

    // Fetch recipient rows only if within retention window
    let recipients: unknown[] = [];
    let recipientTotal = 0;

    if (log.detail_available) {
      const [recipientRows, countRows] = await Promise.all([
        query<{ id: number; user_id: number | null; email: string; full_name: string; status: string; created_at: string }>(
          `SELECT id, user_id, email, full_name, status, created_at
           FROM broadcast_recipients
           WHERE broadcast_id = ?
           ORDER BY status ASC, full_name ASC
           LIMIT ${limit} OFFSET ${offset}`,
          [id],
        ),
        query<{ total: number }>('SELECT COUNT(*) AS total FROM broadcast_recipients WHERE broadcast_id = ?', [id]),
      ]);
      recipients = recipientRows;
      recipientTotal = countRows[0]?.total ?? 0;
    }

    return successResponse(res, 200, 'Broadcast detail fetched', {
      ...log,
      recipients,
    }, {
      page,
      limit,
      total: recipientTotal,
      totalPages: Math.ceil(recipientTotal / limit),
      detail_available: Boolean(log.detail_available),
      recipient_detail_retention_days: RECIPIENT_RETENTION_DAYS,
    });
  } catch (err) {
    console.error('getBroadcastDetail error:', err);
    return errorResponse(res, 500, 'Something went wrong');
  }
};
