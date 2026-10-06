export const up = `
  ALTER TABLE appointments
    MODIFY COLUMN appointment_source ENUM('platform', 'dietitian', 'admin') NOT NULL DEFAULT 'platform';
`;

export const down = `
  ALTER TABLE appointments
    MODIFY COLUMN appointment_source ENUM('platform', 'dietitian') NOT NULL DEFAULT 'platform';
`;
