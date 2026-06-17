export const up = `
  ALTER TABLE dietitian_wallet_transactions
    ADD CONSTRAINT uq_dwt_appointment_source UNIQUE (appointment_id, source);
`;

export const down = `
  ALTER TABLE dietitian_wallet_transactions
    DROP INDEX uq_dwt_appointment_source;
`;
