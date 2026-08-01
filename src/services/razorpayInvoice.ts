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
  amountPaid: number;   // GST-inclusive, in INR
}

// Returns the Razorpay invoice short_url (browser-viewable, no auth needed)
export const getOrCreateRazorpayInvoice = async (input: InvoiceInput): Promise<string> => {
  // Reuse existing invoice for this order if one was already created
  const existing = await razorpay.invoices.all({ count: 5 } as Parameters<typeof razorpay.invoices.all>[0]);
  const found = existing.items.find((inv) => (inv as any).order_id === input.razorpayOrderId);
  if (found?.short_url) return found.short_url;

  const useTaxId = !!env.RAZORPAY_GST_TAX_ID;
  const taxableAmountPaise = Math.round((input.amountPaid / 1.18) * 100);

  const lineItem: Record<string, unknown> = {
    name:        PLAN_LABEL[input.plan] ?? input.plan,
    description: 'AI-powered personalised nutrition plan (SAC: 998399)',
    amount:      taxableAmountPaise,
    currency:    'INR',
    quantity:    1,
  };

  if (useTaxId) {
    // Use the pre-configured GST tax from Razorpay dashboard — it handles CGST/SGST split
    lineItem['tax_id'] = env.RAZORPAY_GST_TAX_ID;
  } else {
    // Fallback: inline 18% rate (Razorpay will show as GST 18%, no CGST/SGST split)
    lineItem['tax_inclusive'] = false;
  }

  const invoice = await razorpay.invoices.create({
    type:         'invoice',
    date:         Math.floor(Date.now() / 1000),
    order_id:     input.razorpayOrderId,
    customer: {
      name:    input.customerName,
      email:   input.customerEmail ?? undefined,
      contact: input.customerPhone ?? undefined,
    },
    line_items:    [lineItem as any],
    currency:      'INR',
    sms_notify:    0,
    email_notify:  0,
    description:   `Payment for ${PLAN_LABEL[input.plan] ?? input.plan}`,
  });

  return invoice.short_url ?? '';
};
