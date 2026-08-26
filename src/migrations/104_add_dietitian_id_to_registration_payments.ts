export const up = `
  ALTER TABLE dietitian_registration_payments
    ADD COLUMN dietitian_id INT UNSIGNED NULL AFTER email,
    ADD INDEX idx_dietitian_id (dietitian_id);
`;

export const down = `
  ALTER TABLE dietitian_registration_payments
    DROP INDEX idx_dietitian_id,
    DROP COLUMN dietitian_id;
`;
