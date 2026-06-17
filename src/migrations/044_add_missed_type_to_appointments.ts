export const up = `
  ALTER TABLE appointments
    ADD COLUMN missed_type ENUM('patient_no_show','dietitian_no_show','technical_issue','network_issue','other')
      DEFAULT NULL AFTER missed_reason;
`;

export const down = `
  ALTER TABLE appointments
    DROP COLUMN missed_type;
`;
