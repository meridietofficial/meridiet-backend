export const up = `
  ALTER TABLE dietitian_wallet_transactions
    ADD COLUMN wallet ENUM('earnings','plan') NOT NULL DEFAULT 'earnings' AFTER type,
    MODIFY COLUMN source ENUM(
      'appointment_completion',
      'withdrawal',
      'admin_credit',
      'admin_debit',
      'no_show_compensation',
      'diet_plan_generation',
      'no_show_penalty',
      'recharge',
      'admin_plan_credit'
    ) NOT NULL;

  UPDATE dietitian_wallet_transactions
  SET wallet = 'plan'
  WHERE source IN ('diet_plan_generation', 'recharge');
`;

export const down = `
  UPDATE dietitian_wallet_transactions SET wallet = 'earnings' WHERE wallet = 'plan';

  ALTER TABLE dietitian_wallet_transactions
    DROP COLUMN wallet,
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
