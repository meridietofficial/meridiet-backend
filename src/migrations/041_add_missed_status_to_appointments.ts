export const up = `
  ALTER TABLE appointments
    MODIFY COLUMN status ENUM('pending','confirmed','completed','cancelled','missed') NOT NULL DEFAULT 'pending';
`;

export const down = `
  ALTER TABLE appointments
    MODIFY COLUMN status ENUM('pending','confirmed','completed','cancelled') NOT NULL DEFAULT 'pending';
`;
