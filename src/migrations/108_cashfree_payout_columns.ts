// Replace RazorpayX columns with Cashfree equivalents
export const up = `
  ALTER TABLE dietitian_withdrawals
    ADD COLUMN cashfree_transfer_id VARCHAR(100) NULL AFTER amount;

  ALTER TABLE dietitian_payment_accounts
    ADD COLUMN cashfree_bene_id VARCHAR(100) NULL AFTER bank_logo_url;
`;

export const down = `
  ALTER TABLE dietitian_withdrawals
    DROP COLUMN cashfree_transfer_id;

  ALTER TABLE dietitian_payment_accounts
    DROP COLUMN cashfree_bene_id;
`;
