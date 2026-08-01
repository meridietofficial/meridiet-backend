import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/authenticate';
import { downloadGstInvoice, previewGstInvoice, getRazorpayInvoiceUrl } from '../controllers/invoice';

export const invoiceRouter = Router();

// GET /api/v1/invoice/gst/:paymentId
// User downloads their own invoice; admin can download any.
invoiceRouter.get('/gst/:paymentId', authenticate, downloadGstInvoice);

// Admin-only: download any invoice without ownership check (same handler — admin bypass is inside)
invoiceRouter.get('/admin/gst/:paymentId', authenticate, authorize('admin'), downloadGstInvoice);

// Preview in browser — no auth, HTML only
invoiceRouter.get('/gst/:paymentId/preview', previewGstInvoice);

// Razorpay-hosted GST invoice — returns short_url, requires auth to fetch but the URL itself is public
invoiceRouter.get('/razorpay/:paymentId', authenticate, getRazorpayInvoiceUrl);
