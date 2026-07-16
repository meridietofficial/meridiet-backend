export const up = `
  ALTER TABLE appointments
    MODIFY COLUMN missed_type ENUM(
      'patient_no_show',
      'dietitian_no_show',
      'technical_issue',
      'network_issue',
      'other',
      'both_no_show'
    ) NULL;

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

  ALTER TABLE dietitians
    ADD COLUMN wallet_suspended TINYINT(1) NOT NULL DEFAULT 0;
`;

export const down = `
  ALTER TABLE dietitians
    DROP COLUMN wallet_suspended;

  ALTER TABLE dietitian_wallet_transactions
    MODIFY COLUMN source ENUM(
      'appointment_completion',
      'withdrawal',
      'admin_credit',
      'admin_debit',
      'no_show_compensation',
      'diet_plan_generation'
    ) NOT NULL;

  ALTER TABLE appointments
    MODIFY COLUMN missed_type ENUM(
      'patient_no_show',
      'dietitian_no_show',
      'technical_issue',
      'network_issue',
      'other'
    ) NULL;
`;
