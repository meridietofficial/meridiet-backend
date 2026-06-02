export const up = `
  ALTER TABLE dietitians MODIFY COLUMN registration_number VARCHAR(100) DEFAULT NULL;
`;

export const down = `
  ALTER TABLE dietitians MODIFY COLUMN registration_number VARCHAR(100) NOT NULL;
`;
