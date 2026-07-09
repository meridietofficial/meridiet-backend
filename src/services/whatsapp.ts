import { env } from '../config/env';
import { MSG91_HEADERS } from '../config/msg91';

const MSG91_WA_URL = 'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/';

// Normalise a mobile number to digits only.
// 10-digit Indian numbers get country code 91 prepended.
const normaliseMobile = (raw: string): string => {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  return digits;
};

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const formatDate = (dateStr: string): string => {
  const [yr, mo, dy] = dateStr.split('-').map(Number);
  return `${dy} ${MONTHS[mo - 1]} ${yr}`;
};

const formatTime = (slot: string): string => {
  const [h, m] = slot.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${suffix}`;
};

export const sendFormReceivedWhatsApp = async (
  whatsappNumber: string,
  userName: string,
): Promise<void> => {
  if (!env.MSG91_WHATSAPP_INTEGRATED_NUMBER || !env.MSG91_WHATSAPP_CONFIRMATION_TEMPLATE) {
    console.warn('[whatsapp] MSG91 WhatsApp not configured — skipping');
    return;
  }

  const mobile = normaliseMobile(whatsappNumber);
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

  const res = await fetch(MSG91_WA_URL, { method: 'POST', headers: MSG91_HEADERS, body: JSON.stringify(payload) });
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
  joinUrl?: string,
): Promise<void> => {
  if (!env.MSG91_WHATSAPP_INTEGRATED_NUMBER || !env.MSG91_WHATSAPP_APPOINTMENT_TEMPLATE) {
    console.warn('[whatsapp] MSG91 WhatsApp not configured — skipping appointment notification');
    return;
  }

  const mobile = normaliseMobile(whatsappNumber);
  if (!mobile) return;

  const components: object[] = [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: userName },
        { type: 'text', text: formatDate(appointmentDate) },
        { type: 'text', text: formatTime(slot) },
      ],
    },
  ];

  // Join Consultation is the 2nd button (index 1) — Visit Website is index 0 (static, no param)
  if (joinUrl && env.APP_BASE_URL) {
    const urlSuffix = joinUrl.replace(`${env.APP_BASE_URL}/`, '');
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '1',
      parameters: [{ type: 'text', text: urlSuffix }],
    });
  }

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
        components,
      },
    },
  };

  const res = await fetch(MSG91_WA_URL, { method: 'POST', headers: MSG91_HEADERS, body: JSON.stringify(payload) });
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

  const mobile = normaliseMobile(whatsappNumber);
  if (!mobile) return;

  const components: object[] = [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: dietitianName },
        { type: 'text', text: patientName },
        { type: 'text', text: formatDate(appointmentDate) },
        { type: 'text', text: formatTime(slot) },
      ],
    },
  ];

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
        components,
      },
    },
  };

  const res = await fetch(MSG91_WA_URL, { method: 'POST', headers: MSG91_HEADERS, body: JSON.stringify(payload) });
  const body = (await res.json()) as { status?: string; hasError?: boolean; data?: { message_uuid?: string }; errors?: unknown };
  if (body.hasError) {
    console.error(`[whatsapp] Dietitian new-booking send failed for ${mobile}:`, JSON.stringify(body));
  } else {
    console.log(`[whatsapp] Dietitian new-booking queued for ${mobile} — uuid: ${body.data?.message_uuid}`);
  }
};

export const sendAppointmentConfirmedWhatsApp = async (
  whatsappNumber: string,
  userName: string,
  appointmentDate: string,
  slot: string,
  joinUrl?: string,
): Promise<void> => {
  if (!env.MSG91_WHATSAPP_INTEGRATED_NUMBER || !env.MSG91_WHATSAPP_CONFIRMED_TEMPLATE) {
    console.warn('[whatsapp] MSG91 WhatsApp not configured — skipping confirmed notification');
    return;
  }

  const mobile = normaliseMobile(whatsappNumber);
  if (!mobile) return;

  const components: object[] = [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: userName },
        { type: 'text', text: formatDate(appointmentDate) },
        { type: 'text', text: formatTime(slot) },
      ],
    },
  ];

  if (joinUrl && env.APP_BASE_URL) {
    const urlSuffix = joinUrl.replace(`${env.APP_BASE_URL}/`, '');
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: urlSuffix }],
    });
  }

  const payload = {
    integrated_number: env.MSG91_WHATSAPP_INTEGRATED_NUMBER,
    content_type: 'template',
    payload: {
      messaging_product: 'whatsapp',
      to: mobile,
      type: 'template',
      template: {
        name: env.MSG91_WHATSAPP_CONFIRMED_TEMPLATE,
        language: { code: 'en' },
        components,
      },
    },
  };

  const res = await fetch(MSG91_WA_URL, { method: 'POST', headers: MSG91_HEADERS, body: JSON.stringify(payload) });
  const body = (await res.json()) as { status?: string; hasError?: boolean; data?: { message_uuid?: string }; errors?: unknown };
  if (body.hasError) {
    console.error(`[whatsapp] Confirmed send failed for ${mobile}:`, JSON.stringify(body));
  } else {
    console.log(`[whatsapp] Confirmed queued for ${mobile} — uuid: ${body.data?.message_uuid}`);
  }
};

export const sendFollowUpScheduledWhatsApp = async (
  whatsappNumber: string,
  userName: string,
  appointmentDate: string,
  slot: string,
  joinUrl?: string,
): Promise<void> => {
  if (!env.MSG91_WHATSAPP_INTEGRATED_NUMBER || !env.MSG91_WHATSAPP_FOLLOW_UP_TEMPLATE) {
    console.warn('[whatsapp] MSG91 WhatsApp not configured — skipping follow-up notification');
    return;
  }

  const mobile = normaliseMobile(whatsappNumber);
  if (!mobile) return;

  const components: object[] = [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: userName },
        { type: 'text', text: formatDate(appointmentDate) },
        { type: 'text', text: formatTime(slot) },
      ],
    },
  ];

  if (joinUrl && env.APP_BASE_URL) {
    const urlSuffix = joinUrl.replace(`${env.APP_BASE_URL}/`, '');
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: urlSuffix }],
    });
  }

  const payload = {
    integrated_number: env.MSG91_WHATSAPP_INTEGRATED_NUMBER,
    content_type: 'template',
    payload: {
      messaging_product: 'whatsapp',
      to: mobile,
      type: 'template',
      template: {
        name: env.MSG91_WHATSAPP_FOLLOW_UP_TEMPLATE,
        language: { code: 'en' },
        components,
      },
    },
  };

  const res = await fetch(MSG91_WA_URL, { method: 'POST', headers: MSG91_HEADERS, body: JSON.stringify(payload) });
  const body = (await res.json()) as { status?: string; hasError?: boolean; data?: { message_uuid?: string }; errors?: unknown };
  if (body.hasError) {
    console.error(`[whatsapp] Follow-up send failed for ${mobile}:`, JSON.stringify(body));
  } else {
    console.log(`[whatsapp] Follow-up queued for ${mobile} — uuid: ${body.data?.message_uuid}`);
  }
};

export const sendAppointmentRescheduledWhatsApp = async (
  whatsappNumber: string,
  userName: string,
  previousDate: string,
  previousSlot: string,
  newDate: string,
  newSlot: string,
  joinUrl?: string,
): Promise<void> => {
  if (!env.MSG91_WHATSAPP_INTEGRATED_NUMBER || !env.MSG91_WHATSAPP_RESCHEDULE_TEMPLATE) {
    console.warn('[whatsapp] MSG91 WhatsApp not configured — skipping reschedule notification');
    return;
  }

  const mobile = normaliseMobile(whatsappNumber);
  if (!mobile) return;

  const components: object[] = [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: userName },
        { type: 'text', text: formatDate(previousDate) },
        { type: 'text', text: formatTime(previousSlot) },
        { type: 'text', text: formatDate(newDate) },
        { type: 'text', text: formatTime(newSlot) },
      ],
    },
  ];

  if (joinUrl && env.APP_BASE_URL) {
    const urlSuffix = joinUrl.replace(`${env.APP_BASE_URL}/`, '');
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: urlSuffix }],
    });
  }

  const payload = {
    integrated_number: env.MSG91_WHATSAPP_INTEGRATED_NUMBER,
    content_type: 'template',
    payload: {
      messaging_product: 'whatsapp',
      to: mobile,
      type: 'template',
      template: {
        name: env.MSG91_WHATSAPP_RESCHEDULE_TEMPLATE,
        language: { code: 'en' },
        components,
      },
    },
  };

  const res = await fetch(MSG91_WA_URL, { method: 'POST', headers: MSG91_HEADERS, body: JSON.stringify(payload) });
  const body = (await res.json()) as { status?: string; hasError?: boolean; data?: { message_uuid?: string }; errors?: unknown };
  if (body.hasError) {
    console.error(`[whatsapp] Reschedule send failed for ${mobile}:`, JSON.stringify(body));
  } else {
    console.log(`[whatsapp] Reschedule queued for ${mobile} — uuid: ${body.data?.message_uuid}`);
  }
};

export const sendDietitianRescheduledWhatsApp = async (
  whatsappNumber: string,
  dietitianName: string,
  patientName: string,
  previousDate: string,
  previousSlot: string,
  newDate: string,
  newSlot: string,
): Promise<void> => {
  if (!env.MSG91_WHATSAPP_INTEGRATED_NUMBER || !env.MSG91_WHATSAPP_DIETITIAN_RESCHEDULE_TEMPLATE) {
    console.warn('[whatsapp] MSG91 WhatsApp not configured — skipping dietitian reschedule notification');
    return;
  }

  const mobile = normaliseMobile(whatsappNumber);
  if (!mobile) return;

  const payload = {
    integrated_number: env.MSG91_WHATSAPP_INTEGRATED_NUMBER,
    content_type: 'template',
    payload: {
      messaging_product: 'whatsapp',
      to: mobile,
      type: 'template',
      template: {
        name: env.MSG91_WHATSAPP_DIETITIAN_RESCHEDULE_TEMPLATE,
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: dietitianName },
              { type: 'text', text: patientName },
              { type: 'text', text: formatDate(previousDate) },
              { type: 'text', text: formatTime(previousSlot) },
              { type: 'text', text: formatDate(newDate) },
              { type: 'text', text: formatTime(newSlot) },
            ],
          },
        ],
      },
    },
  };

  const res = await fetch(MSG91_WA_URL, { method: 'POST', headers: MSG91_HEADERS, body: JSON.stringify(payload) });
  const body = (await res.json()) as { status?: string; hasError?: boolean; data?: { message_uuid?: string }; errors?: unknown };
  if (body.hasError) {
    console.error(`[whatsapp] Dietitian reschedule send failed for ${mobile}:`, JSON.stringify(body));
  } else {
    console.log(`[whatsapp] Dietitian reschedule queued for ${mobile} — uuid: ${body.data?.message_uuid}`);
  }
};

export const sendReminderWhatsApp = async (
  whatsappNumber: string,
  userName: string,
  appointmentDate: string,
  slot: string,
  type: '1h' | '10min',
  joinUrl?: string,
): Promise<void> => {
  const templateEnvKey = type === '1h'
    ? env.MSG91_WHATSAPP_REMINDER_1H_TEMPLATE
    : env.MSG91_WHATSAPP_REMINDER_10MIN_TEMPLATE;

  if (!env.MSG91_WHATSAPP_INTEGRATED_NUMBER || !templateEnvKey) {
    console.warn(`[whatsapp] MSG91 not configured — skipping ${type} reminder`);
    return;
  }

  const mobile = normaliseMobile(whatsappNumber);
  if (!mobile) return;

  const components: object[] = [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: userName },
        { type: 'text', text: formatDate(appointmentDate) },
        { type: 'text', text: formatTime(slot) },
      ],
    },
  ];

  if (joinUrl && env.APP_BASE_URL) {
    const urlSuffix = joinUrl.replace(`${env.APP_BASE_URL}/`, '');
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: urlSuffix }],
    });
  }

  const payload = {
    integrated_number: env.MSG91_WHATSAPP_INTEGRATED_NUMBER,
    content_type: 'template',
    payload: {
      messaging_product: 'whatsapp',
      to: mobile,
      type: 'template',
      template: {
        name: templateEnvKey,
        language: { code: 'en' },
        components,
      },
    },
  };

  const res = await fetch(MSG91_WA_URL, { method: 'POST', headers: MSG91_HEADERS, body: JSON.stringify(payload) });
  const body = (await res.json()) as { status?: string; hasError?: boolean; data?: { message_uuid?: string }; errors?: unknown };
  if (body.hasError) {
    console.error(`[whatsapp] ${type} reminder failed for ${mobile}:`, JSON.stringify(body));
  } else {
    console.log(`[whatsapp] ${type} reminder queued for ${mobile} — uuid: ${body.data?.message_uuid}`);
  }
};

export const sendDietitianReminderWhatsApp = async (
  whatsappNumber: string,
  dietitianName: string,
  patientName: string,
  slot: string,
): Promise<void> => {
  if (!env.MSG91_WHATSAPP_INTEGRATED_NUMBER || !env.MSG91_WHATSAPP_DIETITIAN_REMINDER_15MIN_TEMPLATE) {
    console.warn('[whatsapp] MSG91 not configured — skipping dietitian 15min reminder');
    return;
  }

  const mobile = normaliseMobile(whatsappNumber);
  if (!mobile) return;

  const payload = {
    integrated_number: env.MSG91_WHATSAPP_INTEGRATED_NUMBER,
    content_type: 'template',
    payload: {
      messaging_product: 'whatsapp',
      to: mobile,
      type: 'template',
      template: {
        name: env.MSG91_WHATSAPP_DIETITIAN_REMINDER_15MIN_TEMPLATE,
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: dietitianName },
              { type: 'text', text: patientName },
              { type: 'text', text: formatTime(slot) },
            ],
          },
        ],
      },
    },
  };

  const res = await fetch(MSG91_WA_URL, { method: 'POST', headers: MSG91_HEADERS, body: JSON.stringify(payload) });
  const body = (await res.json()) as { status?: string; hasError?: boolean; data?: { message_uuid?: string }; errors?: unknown };
  if (body.hasError) {
    console.error(`[whatsapp] Dietitian 15min reminder failed for ${mobile}:`, JSON.stringify(body));
  } else {
    console.log(`[whatsapp] Dietitian 15min reminder queued for ${mobile} — uuid: ${body.data?.message_uuid}`);
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

  const mobile = normaliseMobile(whatsappNumber);
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

  const res = await fetch(MSG91_WA_URL, { method: 'POST', headers: MSG91_HEADERS, body: JSON.stringify(payload) });
  const body = (await res.json()) as { status?: string; hasError?: boolean; data?: { message_uuid?: string }; errors?: unknown };
  if (body.hasError) {
    console.error(`[whatsapp] Diet-plan send failed for ${mobile}:`, JSON.stringify(body));
  } else {
    console.log(`[whatsapp] Diet-plan queued for ${mobile} — uuid: ${body.data?.message_uuid}`);
  }
};

// ── Appointment completed + rate your dietitian ────────────────────────────
// Template body (3 params): {{1}} name, {{2}} date, {{3}} time
// Button: static URL — https://meridiet.com/profile?tab=appointments (no dynamic param needed)
export const sendAppointmentCompletedWhatsApp = async (
  phone: string,
  name: string,
  appointmentDate: string,
  slot: string,
): Promise<void> => {
  if (!env.MSG91_WHATSAPP_INTEGRATED_NUMBER || !env.MSG91_WHATSAPP_COMPLETED_TEMPLATE) {
    console.warn('[whatsapp] completed template not configured — skipping');
    return;
  }

  const mobile = normaliseMobile(phone);
  if (!mobile) return;

  const payload = {
    integrated_number: env.MSG91_WHATSAPP_INTEGRATED_NUMBER,
    content_type: 'template',
    payload: {
      messaging_product: 'whatsapp',
      to: mobile,
      type: 'template',
      template: {
        name: env.MSG91_WHATSAPP_COMPLETED_TEMPLATE,
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: name },
              { type: 'text', text: formatDate(appointmentDate) },
              { type: 'text', text: formatTime(slot) },
            ],
          },
        ],
      },
    },
  };

  const res = await fetch(MSG91_WA_URL, { method: 'POST', headers: MSG91_HEADERS, body: JSON.stringify(payload) });
  const resBody = (await res.json()) as { status?: string; hasError?: boolean; data?: { message_uuid?: string }; errors?: unknown };
  if (resBody.hasError) {
    console.error(`[whatsapp] Completed notification failed for ${mobile}:`, JSON.stringify(resBody));
  } else {
    console.log(`[whatsapp] Completed notification queued for ${mobile} — uuid: ${resBody.data?.message_uuid}`);
  }
};
