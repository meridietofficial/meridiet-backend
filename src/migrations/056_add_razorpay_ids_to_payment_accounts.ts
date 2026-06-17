// Store Razorpay X contact + fund account IDs to avoid creating duplicates on repeat withdrawals
export const up = `
  ALTER TABLE dietitian_payment_accounts
    ADD COLUMN razorpay_contact_id     VARCHAR(100) NULL AFTER bank_logo_url,
    ADD COLUMN razorpay_fund_account_id VARCHAR(100) NULL AFTER razorpay_contact_id;
`;

export const down = `
  ALTER TABLE dietitian_payment_accounts
    DROP COLUMN razorpay_contact_id,
    DROP COLUMN razorpay_fund_account_id;
`;
