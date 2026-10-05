import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/authenticate';
import { downloadGstInvoice, previewGstInvoice, previewSampleGstInvoice, previewSampleAppointmentInvoice, sendTestInvoiceEmail, getRazorpayInvoiceUrl } from '../controllers/invoice';

export const invoiceRouter = Router();

// Static routes MUST come before parameterized routes to avoid :paymentId capturing them
invoiceRouter.get('/gst/sample/preview', previewSampleGstInvoice);
invoiceRouter.get('/appointment/sample/preview', previewSampleAppointmentInvoice);
invoiceRouter.get('/gst/test-email', sendTestInvoiceEmail);

// GET /api/v1/invoice/gst/:paymentId/preview — no auth, HTML only
invoiceRouter.get('/gst/:paymentId/preview', previewGstInvoice);

// GET /api/v1/invoice/gst/:paymentId — user downloads their own invoice; admin can download any
invoiceRouter.get('/gst/:paymentId', authenticate, downloadGstInvoice);

// Admin-only: download any invoice without ownership check
invoiceRouter.get('/admin/gst/:paymentId', authenticate, authorize('admin'), downloadGstInvoice);

// Razorpay-hosted GST invoice — returns short_url, requires auth to fetch but the URL itself is public
invoiceRouter.get('/razorpay/:paymentId', authenticate, getRazorpayInvoiceUrl);
