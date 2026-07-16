export const up = `
  ALTER TABLE dietitian_wallet_transactions
    MODIFY COLUMN source ENUM(
      'appointment_completion',
      'withdrawal',
      'admin_credit',
      'admin_debit',
      'no_show_compensation',
      'diet_plan_generation'
    ) NOT NULL;

  ALTER TABLE dietitians
    ADD COLUMN logo_url VARCHAR(500) NULL AFTER profile_photo;
`;

export const down = `
  ALTER TABLE dietitians
    DROP COLUMN logo_url;

  ALTER TABLE dietitian_wallet_transactions
    MODIFY COLUMN source ENUM(
      'appointment_completion',
      'withdrawal',
      'admin_credit',
      'admin_debit',
      'no_show_compensation'
    ) NOT NULL;
`;
