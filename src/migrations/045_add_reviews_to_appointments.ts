export const up = `
  ALTER TABLE appointments
    ADD COLUMN user_rating        TINYINT  DEFAULT NULL AFTER missed_type,
    ADD COLUMN user_review        TEXT     DEFAULT NULL AFTER user_rating,
    ADD COLUMN user_reviewed_at   DATETIME DEFAULT NULL AFTER user_review,
    ADD COLUMN dietitian_rating   TINYINT  DEFAULT NULL AFTER user_reviewed_at,
    ADD COLUMN dietitian_review   TEXT     DEFAULT NULL AFTER dietitian_rating,
    ADD COLUMN dietitian_reviewed_at DATETIME DEFAULT NULL AFTER dietitian_review;
`;

export const down = `
  ALTER TABLE appointments
    DROP COLUMN user_rating,
    DROP COLUMN user_review,
    DROP COLUMN user_reviewed_at,
    DROP COLUMN dietitian_rating,
    DROP COLUMN dietitian_review,
    DROP COLUMN dietitian_reviewed_at;
`;
