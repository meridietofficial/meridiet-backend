import type { Request, Response } from 'express';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { findPaymentById } from '../models/Payment';
import { findUserById } from '../models/User';
import { buildGstInvoiceHtml } from '../services/gstInvoiceHtml';
import { getOrCreateRazorpayInvoice } from '../services/razorpayInvoice';
import { errorResponse, successResponse } from '../utils/response';

const LOCAL_CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
];

const getExecutablePath = async (): Promise<string> => {
  if (process.env.NODE_ENV === 'production') {
    return chromium.executablePath();
  }
  for (const p of LOCAL_CHROME_PATHS) {
    const { existsSync } = await import('fs');
    if (existsSync(p)) return p;
  }
  throw new Error('No Chrome/Chromium found locally.');
};

const fmtDate = (d: Date): string => {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const invoiceNumber = (paymentId: number, createdAt: Date): string => {
  const y = createdAt.getFullYear();
  const m = createdAt.getMonth() + 1;
  const fy = m >= 4 ? `${y}-${String(y + 1).slice(-2)}` : `${y - 1}-${String(y).slice(-2)}`;
  return `MDT/INV/${fy}/${String(paymentId).padStart(5, '0')}`;
};

const planLabel = (plan: string): string => {
  const map: Record<string, string> = {
    '1_week':   '1 Week',
    '1_month':  '1 Month',
    '3_months': '3 Months',
  };
  return map[plan] ?? plan;
};

const buildInvoiceData = async (paymentId: number) => {
  const payment = await findPaymentById(paymentId);
  if (!payment) return null;
  const user = payment.user_id ? await findUserById(payment.user_id) : null;
  const amount = payment.final_amount ?? payment.amount;
  return {
    payment,
    html: buildGstInvoiceHtml({
      invoiceNumber:     invoiceNumber(payment.id, new Date(payment.created_at)),
      invoiceDate:       fmtDate(new Date(payment.created_at)),
      customerName:      user?.full_name ?? 'Customer',
      customerEmail:     user?.email ?? '',
      customerPhone:     user?.phone_number ? `${user.phone_code ?? '+91'} ${user.phone_number}` : null,
      planLabel:         planLabel(payment.plan),
      amountPaid:        amount,
      razorpayPaymentId: payment.razorpay_payment_id,
    }),
  };
};

// GET /api/v1/invoice/razorpay/:paymentId
// Returns the Razorpay-hosted GST invoice URL — no token needed to VIEW it (Razorpay handles auth on their end)
export const getRazorpayInvoiceUrl = async (req: Request, res: Response) => {
  try {
    const paymentId = parseInt(req.params.paymentId, 10);
    if (isNaN(paymentId)) return errorResponse(res, 400, 'Invalid payment ID');

    const payment = await findPaymentById(paymentId);
    if (!payment) return errorResponse(res, 404, 'Payment not found');
    if (payment.status !== 'paid') return errorResponse(res, 400, 'Invoice only available for completed payments');
    if (!payment.razorpay_order_id) return errorResponse(res, 400, 'No Razorpay order linked to this payment');

    const user = payment.user_id ? await findUserById(payment.user_id) : null;

    const shortUrl = await getOrCreateRazorpayInvoice({
      razorpayOrderId: payment.razorpay_order_id,
      customerName:    user?.full_name ?? 'Customer',
      customerEmail:   user?.email ?? '',
      customerPhone:   user?.phone_number ?? null,
      plan:            payment.plan,
      amountPaid:      payment.final_amount ?? payment.amount,
    });

    if (!shortUrl) return errorResponse(res, 500, 'Could not generate Razorpay invoice URL');

    return successResponse(res, 200, 'Invoice URL generated', { invoice_url: shortUrl });
  } catch (err) {
    console.error('[invoice] Razorpay invoice error:', err);
    return errorResponse(res, 500, 'Failed to generate Razorpay invoice');
  }
};

// GET /api/v1/invoice/gst/:paymentId/preview  — returns HTML, open directly in browser (admin only)
export const previewGstInvoice = async (req: Request, res: Response) => {
  try {
    const paymentId = parseInt(req.params.paymentId, 10);
    if (isNaN(paymentId)) return errorResponse(res, 400, 'Invalid payment ID');

    const result = await buildInvoiceData(paymentId);
    if (!result) return errorResponse(res, 404, 'Payment not found');
    if (result.payment.status !== 'paid') return errorResponse(res, 400, 'Invoice only available for completed payments');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(result.html);
  } catch (err) {
    console.error('[invoice] preview error:', err);
    return errorResponse(res, 500, 'Failed to render invoice');
  }
};

// GET /api/v1/invoice/gst/:paymentId
// Auth: Bearer token (user must own the payment, or be admin)
export const downloadGstInvoice = async (req: Request, res: Response) => {
  try {
    const paymentId = parseInt(req.params.paymentId, 10);
    if (isNaN(paymentId)) return errorResponse(res, 400, 'Invalid payment ID');

    const result = await buildInvoiceData(paymentId);
    if (!result) return errorResponse(res, 404, 'Payment not found');
    const { payment, html } = result;
    if (payment.status !== 'paid') return errorResponse(res, 400, 'Invoice only available for completed payments');

    // Authorise: user must own the payment or be admin
    const requestingUserId = req.user?.sub ? Number(req.user.sub) : null;
    const isAdmin = req.user?.role === 'admin';
    if (!isAdmin && payment.user_id !== requestingUserId) {
      return errorResponse(res, 403, 'Access denied');
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const browser = await puppeteer.launch({
      args: isProduction
        ? [...chromium.args, '--font-render-hinting=none']
        : ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--font-render-hinting=none'],
      executablePath: await getExecutablePath(),
      headless: isProduction ? ('shell' as const) : true,
    });

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      await page.evaluate('document.fonts.ready');
      await new Promise((r) => setTimeout(r, 150));

      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0', bottom: '0', left: '0', right: '0' },
      });

      const filename = `GST_Invoice_${invoiceNumber(payment.id, new Date(payment.created_at)).replace(/\//g, '-')}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(Buffer.from(pdf));
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error('[invoice] GST invoice error:', err);
    return errorResponse(res, 500, 'Failed to generate invoice');
  }
};
