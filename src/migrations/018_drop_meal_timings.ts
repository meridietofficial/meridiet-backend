export const up = `
  ALTER TABLE diet_forms
    DROP COLUMN breakfast_time,
    DROP COLUMN mid_morning_time,
    DROP COLUMN lunch_time,
    DROP COLUMN evening_snack_time,
    DROP COLUMN dinner_time;
`;

export const down = `
  ALTER TABLE diet_forms
    ADD COLUMN breakfast_time     TIME DEFAULT NULL,
    ADD COLUMN mid_morning_time   TIME DEFAULT NULL,
    ADD COLUMN lunch_time         TIME DEFAULT NULL,
    ADD COLUMN evening_snack_time TIME DEFAULT NULL,
    ADD COLUMN dinner_time        TIME DEFAULT NULL;
`;
