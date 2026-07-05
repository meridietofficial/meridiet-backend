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

export const sendAppointmentBookedWhatsApp = async (
  whatsappNumber: string,
  userName: string,
  appointmentDate: string,
  slot: string,
): Promise<void> => {
  if (!env.MSG91_WHATSAPP_INTEGRATED_NUMBER || !env.MSG91_WHATSAPP_APPOINTMENT_TEMPLATE) {
    console.warn('[whatsapp] MSG91 WhatsApp not configured — skipping appointment notification');
    return;
  }

  const mobile = whatsappNumber.replace(/\D/g, '');
  if (!mobile) return;

  // Format date: YYYY-MM-DD → "7 July 2026"
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const [yr, mo, dy] = appointmentDate.split('-').map(Number);
  const formattedDate = `${dy} ${MONTHS[mo - 1]} ${yr}`;

  // Format time: HH:MM (24h) → "9:30 AM"
  const [h, m] = slot.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  const formattedTime = `${hour}:${m.toString().padStart(2, '0')} ${suffix}`;

  const payload = {
    integrated_number: env.MSG91_WHATSAPP_INTEGRATED_NUMBER,
    content_type: 'template',
    payload: {
      messaging_product: 'whatsapp',
      to: mobile,
      type: 'template',
      template: {
        name: env.MSG91_WHATSAPP_APPOINTMENT_TEMPLATE,
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: userName },
              { type: 'text', text: formattedDate },
              { type: 'text', text: formattedTime },
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
    console.error(`[whatsapp] Appointment-booked send failed for ${mobile}:`, JSON.stringify(body));
  } else {
    console.log(`[whatsapp] Appointment-booked queued for ${mobile} — uuid: ${body.data?.message_uuid}`);
  }
};

export const sendDietitianNewBookingWhatsApp = async (
  whatsappNumber: string,
  dietitianName: string,
  patientName: string,
  appointmentDate: string,
  slot: string,
): Promise<void> => {
  if (!env.MSG91_WHATSAPP_INTEGRATED_NUMBER || !env.MSG91_WHATSAPP_DIETITIAN_APPOINTMENT_TEMPLATE) {
    console.warn('[whatsapp] MSG91 WhatsApp not configured — skipping dietitian booking notification');
    return;
  }

  const mobile = whatsappNumber.replace(/\D/g, '');
  if (!mobile) return;

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const [yr, mo, dy] = appointmentDate.split('-').map(Number);
  const formattedDate = `${dy} ${MONTHS[mo - 1]} ${yr}`;

  const [h, m] = slot.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  const formattedTime = `${hour}:${m.toString().padStart(2, '0')} ${suffix}`;

  const payload = {
    integrated_number: env.MSG91_WHATSAPP_INTEGRATED_NUMBER,
    content_type: 'template',
    payload: {
      messaging_product: 'whatsapp',
      to: mobile,
      type: 'template',
      template: {
        name: env.MSG91_WHATSAPP_DIETITIAN_APPOINTMENT_TEMPLATE,
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: dietitianName },
              { type: 'text', text: patientName },
              { type: 'text', text: formattedDate },
              { type: 'text', text: formattedTime },
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
    console.error(`[whatsapp] Dietitian new-booking send failed for ${mobile}:`, JSON.stringify(body));
  } else {
    console.log(`[whatsapp] Dietitian new-booking queued for ${mobile} — uuid: ${body.data?.message_uuid}`);
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
