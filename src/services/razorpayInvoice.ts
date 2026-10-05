import { razorpay } from '../config/razorpay';
import { env } from '../config/env';

const PLAN_LABEL: Record<string, string> = {
  '1_week':   '1 Week Diet Plan',
  '1_month':  '1 Month Diet Plan',
  '3_months': '3 Months Diet Plan',
};

interface InvoiceInput {
  razorpayOrderId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  plan: string;
  amountPaid: number;   // GST-inclusive total, in INR
}

const findExistingInvoice = async (orderId: string): Promise<string | null> => {
  try {
    const invoices = await razorpay.invoices.all({
      type:  'invoice',
      count: 25,
    } as Parameters<typeof razorpay.invoices.all>[0]);

    const found = (invoices.items as any[]).find(
      (inv) => inv.order_id === orderId && inv.short_url,
    );
    return found?.short_url ?? null;
  } catch {
    return null;
  }
};

// Creates a Razorpay-hosted invoice for a completed payment.
// Passes the GST-inclusive amount directly — no Tax ID required.
// Razorpay emails the invoice to the customer when email_notify = 1.
export const getOrCreateRazorpayInvoice = async (input: InvoiceInput): Promise<string> => {
  const existing = await findExistingInvoice(input.razorpayOrderId);
  if (existing) return existing;

  const totalPaise = Math.round(input.amountPaid * 100);

  const taxableInr  = parseFloat((input.amountPaid / 1.18).toFixed(2));
  const cgstInr     = parseFloat((taxableInr * 0.09).toFixed(2));
  const sgstInr     = parseFloat((taxableInr * 0.09).toFixed(2));

  const planName = PLAN_LABEL[input.plan] ?? input.plan;

  const invoice = await razorpay.invoices.create({
    type:     'invoice',
    date:     Math.floor(Date.now() / 1000),
    order_id: input.razorpayOrderId,
    customer: {
      name:    input.customerName,
      email:   input.customerEmail,
      contact: input.customerPhone ?? undefined,
    },
    line_items: [
      {
        name:        planName,
        description: `Taxable: ₹${taxableInr} | CGST 9%: ₹${cgstInr} | SGST 9%: ₹${sgstInr}`,
        amount:      totalPaise,
        currency:    'INR',
        quantity:    1,
      } as any,
    ],
    currency:     'INR',
    sms_notify:   input.customerPhone ? 1 : 0,
    email_notify: input.customerEmail ? 1 : 0,
    description:  `Payment for ${planName} — GSTIN: ${env.COMPANY_GSTIN} | GST @18% incl.`,
  });

  return invoice.short_url ?? '';
};
