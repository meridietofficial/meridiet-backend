export const up = `
  ALTER TABLE appointments
    ADD COLUMN parent_appointment_id INT NULL DEFAULT NULL AFTER notes,
    ADD COLUMN is_follow_up          TINYINT(1) NOT NULL DEFAULT 0 AFTER parent_appointment_id,
    ADD CONSTRAINT fk_parent_appointment
      FOREIGN KEY (parent_appointment_id) REFERENCES appointments(id)
      ON DELETE SET NULL;
`;

export const down = `
  ALTER TABLE appointments
    DROP FOREIGN KEY fk_parent_appointment,
    DROP COLUMN parent_appointment_id,
    DROP COLUMN is_follow_up;
`;
