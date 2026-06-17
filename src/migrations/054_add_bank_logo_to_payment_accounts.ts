export const up = `
  ALTER TABLE dietitian_payment_accounts
    ADD COLUMN bank_logo_url VARCHAR(500) NULL AFTER bank_name;
`;

export const down = `
  ALTER TABLE dietitian_payment_accounts
    DROP COLUMN bank_logo_url;
`;
