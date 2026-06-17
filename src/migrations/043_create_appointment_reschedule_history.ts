export const up = `
  CREATE TABLE appointment_reschedule_history (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    appointment_id    INT          NOT NULL,
    rescheduled_by    INT          NOT NULL,
    previous_date     DATE         NOT NULL,
    previous_slot     TIME         NOT NULL,
    new_date          DATE         NOT NULL,
    new_slot          TIME         NOT NULL,
    reason            TEXT         DEFAULT NULL,
    created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_rh_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
    CONSTRAINT fk_rh_user        FOREIGN KEY (rescheduled_by) REFERENCES users(id)
  );
`;

export const down = `
  DROP TABLE IF EXISTS appointment_reschedule_history;
`;
