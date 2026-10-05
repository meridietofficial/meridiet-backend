import type { Request, Response } from 'express';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { findPaymentById } from '../models/Payment';
import { findUserById } from '../models/User';
import { findDietFormById } from '../models/DietForm';
import { buildGstInvoiceHtml } from '../services/gstInvoiceHtml';
import { getOrCreateRazorpayInvoice } from '../services/razorpayInvoice';
import { generateGstInvoicePdf } from '../services/generateGstInvoicePdf';
import { sendEmail } from '../services/email';
import { dietPlanReadyEmail } from '../services/emails/dietPlanReady';
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
  const [user, form] = await Promise.all([
    payment.user_id ? findUserById(payment.user_id) : null,
    payment.diet_form_id ? findDietFormById(payment.diet_form_id) : null,
  ]);
  const amount = payment.final_amount ?? payment.amount;
  return {
    payment,
    html: buildGstInvoiceHtml({
      invoiceNumber:     invoiceNumber(payment.id, new Date(payment.created_at)),
      invoiceDate:       fmtDate(new Date(payment.created_at)),
      customerName:      user?.full_name ?? form?.full_name ?? 'Customer',
      customerEmail:     user?.email ?? form?.email ?? '',
      customerPhone:     user?.phone_number ? `${user.phone_code ?? '+91'} ${user.phone_number}` : null,
      customerState:     form?.state ?? null,
      planLabel:         planLabel(payment.plan),
      amountPaid:        amount,
      razorpayPaymentId: payment.razorpay_payment_id,
    }),
  };
};

// GET /api/v1/invoice/gst/sample/preview?state=up  — renders a dummy diet-plan invoice (no auth, no DB)
// ?state=up   → intra-state (CGST+SGST)   default
// ?state=dl   → inter-state (IGST)
export const previewSampleGstInvoice = (req: Request, res: Response) => {
  const stateParam = (req.query.state as string | undefined) ?? 'up';
  const customerState = stateParam === 'dl' ? 'Delhi' : 'Uttar Pradesh';
  const now = new Date();
  const html = buildGstInvoiceHtml({
    invoiceNumber:     'MDT/INV/2026-27/00001',
    invoiceDate:       fmtDate(now),
    customerName:      'Priya Sharma',
    customerEmail:     'priya.sharma@example.com',
    customerPhone:     '+91 98765 43210',
    customerState,
    planLabel:         '1 Month',
    amountPaid:        499,
    razorpayPaymentId: 'pay_SamplePaymentId12',
  });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
};

// GET /api/v1/invoice/appointment/sample/preview?type=video_call|in_person
// Renders a dummy appointment invoice (no auth, no DB)
export const previewSampleAppointmentInvoice = (req: Request, res: Response) => {
  const typeParam = (req.query.type as string | undefined) ?? 'video_call';
  const sessionLabel = typeParam === 'in_person' ? 'In-Person' : 'Video Call';
  const now = new Date();
  const html = buildGstInvoiceHtml({
    invoiceNumber:      'MDT/APT/2026-27/00001',
    invoiceDate:        fmtDate(now),
    customerName:       'Rahul Verma',
    customerEmail:      'rahul.verma@example.com',
    customerPhone:      '+91 91234 56789',
    customerState:      null,
    planLabel:          sessionLabel,
    serviceDescription: `Dietitian Consultation – ${sessionLabel}`,
    amountPaid:         799,
    razorpayPaymentId:  'pay_SampleAptPayment12',
  });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
};

// GET /api/v1/invoice/gst/test-email?to=someone@example.com  — sends a combined diet plan + invoice email (no auth, dev only)
export const sendTestInvoiceEmail = async (req: Request, res: Response) => {
  const to = req.query.to as string | undefined;
  if (!to) return errorResponse(res, 400, 'Query param ?to=email is required');

  try {
    const now = new Date();
    const invNumber = 'MDT/INV/2026-27/00001';

    // Build GST invoice PDF
    const invoiceHtml = buildGstInvoiceHtml({
      invoiceNumber:     invNumber,
      invoiceDate:       fmtDate(now),
      customerName:      'Manish Kumar',
      customerEmail:     to,
      customerPhone:     '+91 98765 43210',
      customerState:     'Delhi',
      planLabel:         '1 Month',
      amountPaid:        499,
      razorpayPaymentId: 'pay_TestPaymentId123',
    });
    const pdfBuffer = await generateGstInvoicePdf(invoiceHtml);

    // Diet plan ready email body with invoice attached
    const samplePdfUrl = 'https://meridiet.com/sample-diet-plan.pdf';
    const { subject, html, text } = dietPlanReadyEmail('Manish Kumar', samplePdfUrl, null);

    await sendEmail({
      to,
      subject,
      html,
      text,
      attachments: [{
        filename:    `GST_Invoice_${invNumber.replace(/\//g, '-')}.pdf`,
        content:     pdfBuffer,
        contentType: 'application/pdf',
      }],
    });

    return successResponse(res, 200, `Test email sent to ${to}`);
  } catch (err) {
    console.error('[invoice] test email error:', err);
    return errorResponse(res, 500, 'Failed to send test email');
  }
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
