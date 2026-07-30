export const up = `
  ALTER TABLE dietitian_wallet_transactions
    MODIFY COLUMN source ENUM(
      'appointment_completion',
      'withdrawal',
      'admin_credit',
      'admin_debit',
      'no_show_compensation',
      'diet_plan_generation',
      'no_show_penalty',
      'recharge'
    ) NOT NULL;
`;

export const down = `
  ALTER TABLE dietitian_wallet_transactions
    MODIFY COLUMN source ENUM(
      'appointment_completion',
      'withdrawal',
      'admin_credit',
      'admin_debit',
      'no_show_compensation',
      'diet_plan_generation',
      'no_show_penalty'
    ) NOT NULL;
`;
