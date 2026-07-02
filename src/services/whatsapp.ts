import { env } from '../config/env';
import { MSG91_HEADERS } from '../config/msg91';

const MSG91_WA_URL = 'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/';

export const sendFormReceivedWhatsApp = async (
  whatsappNumber: string,
  userName: string,
): Promise<void> => {
  if (!env.MSG91_WHATSAPP_INTEGRATED_NUMBER || !env.MSG91_WHATSAPP_CONFIRMATION_TEMPLATE) {
    console.warn('[whatsapp] MSG91 WhatsApp not configured — skipping');
    return;
  }

  const mobile = whatsappNumber.replace(/\D/g, '');
  if (!mobile) return;

  const payload = {
    integrated_number: env.MSG91_WHATSAPP_INTEGRATED_NUMBER,
    content_type: 'template',
    payload: {
      messaging_product: 'whatsapp',
      to: mobile,
      type: 'template',
      template: {
        name: env.MSG91_WHATSAPP_CONFIRMATION_TEMPLATE,
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [{ type: 'text', text: userName }],
          },
        ],
      },
    },
  };

  const res = await fetch(MSG91_WA_URL, {
    method: 'POST',
    headers: MSG91_HEADERS,
    body: JSON.stringify(payload),
  });

  const body = (await res.json()) as { status?: string; hasError?: boolean; data?: { message_uuid?: string }; errors?: unknown };
  if (body.hasError) {
    console.error(`[whatsapp] Form-received send failed for ${mobile}:`, JSON.stringify(body));
  } else {
    console.log(`[whatsapp] Form-received queued for ${mobile} — uuid: ${body.data?.message_uuid}`);
  }
};

export const sendDietPlanWhatsApp = async (
  whatsappNumber: string,
  userName: string,
  pdfUrl: string,
): Promise<void> => {
  if (!env.MSG91_WHATSAPP_INTEGRATED_NUMBER || !env.MSG91_WHATSAPP_DIET_PLAN_TEMPLATE) {
    console.warn('[whatsapp] MSG91 WhatsApp not configured — skipping');
    return;
  }

  const mobile = whatsappNumber.replace(/\D/g, '');
  if (!mobile) return;

  const payload = {
    integrated_number: env.MSG91_WHATSAPP_INTEGRATED_NUMBER,
    content_type: 'template',
    payload: {
      messaging_product: 'whatsapp',
      to: mobile,
      type: 'template',
      template: {
        name: env.MSG91_WHATSAPP_DIET_PLAN_TEMPLATE,
        language: { code: 'en' },
        components: [
          {
            type: 'header',
            parameters: [
              {
                type: 'document',
                document: {
                  link: pdfUrl,
                  filename: 'MeriDiet_Plan.pdf',
                },
              },
            ],
          },
          {
            type: 'body',
            parameters: [
              { type: 'text', text: userName },
              { type: 'text', text: pdfUrl },
            ],
          },
        ],
      },
    },
  };

  const res = await fetch(MSG91_WA_URL, {
    method: 'POST',
    headers: MSG91_HEADERS,
    body: JSON.stringify(payload),
  });

  const body = (await res.json()) as { status?: string; hasError?: boolean; data?: { message_uuid?: string }; errors?: unknown };
  if (body.hasError) {
    console.error(`[whatsapp] Diet-plan send failed for ${mobile}:`, JSON.stringify(body));
  } else {
    console.log(`[whatsapp] Diet-plan queued for ${mobile} — uuid: ${body.data?.message_uuid}`);
  }
};
