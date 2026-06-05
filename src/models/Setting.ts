import { query, execute } from '../config/database';

// Generic key/value app settings (consultation fee, currency, ...)
export const getSetting = async (key: string): Promise<string | null> => {
  const rows = await query<{ value: string }>(
    'SELECT value FROM app_settings WHERE `key` = ? LIMIT 1',
    [key],
  );
  return rows[0]?.value ?? null;
};

export const setSetting = async (key: string, value: string) => {
  await execute(
    'INSERT INTO app_settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
    [key, value],
  );
};

// The single global consultation fee used across the whole site
export const getConsultationFee = async () => {
  const [feeRaw, currency] = await Promise.all([
    getSetting('consultation_fee'),
    getSetting('currency'),
  ]);
  return {
    amount: feeRaw != null ? Number(feeRaw) : 0,
    currency: currency ?? 'INR',
  };
};
