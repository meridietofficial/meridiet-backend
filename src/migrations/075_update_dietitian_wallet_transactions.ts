export const up = `
  ALTER TABLE dietitian_wallet_transactions
    MODIFY COLUMN source ENUM(
      'appointment_completion',
      'withdrawal',
      'admin_credit',
      'admin_debit',
      'no_show_compensation'
    ) NOT NULL,
    ADD COLUMN approved_by INT NULL AFTER appointment_id;
`;

export const down = `
  ALTER TABLE dietitian_wallet_transactions
    DROP COLUMN approved_by,
    MODIFY COLUMN source ENUM(
      'appointment_completion',
      'withdrawal',
      'admin_credit',
      'admin_debit'
    ) NOT NULL;
`;
