// account_number now stores AES-256-GCM encrypted values in iv:tag:cipher hex format.
// Max length: 32 (iv) + 1 + 32 (tag) + 1 + ~36 (cipher for 18-digit number) = ~103 chars.
// Using 500 for comfortable headroom.

export const up = `
  ALTER TABLE dietitian_payment_accounts
    MODIFY COLUMN account_number VARCHAR(500) NULL;
`;

export const down = `
  ALTER TABLE dietitian_payment_accounts
    MODIFY COLUMN account_number VARCHAR(50) NULL;
`;
