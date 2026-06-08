export const up = `
  ALTER TABLE appointments
    ADD COLUMN duration     SMALLINT                          NOT NULL DEFAULT 30 AFTER slot,
    ADD COLUMN session_type ENUM('video_call', 'in_person')  NOT NULL DEFAULT 'video_call' AFTER duration;
`;

export const down = `
  ALTER TABLE appointments
    DROP COLUMN duration,
    DROP COLUMN session_type;
`;
