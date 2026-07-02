export const up = `
  ALTER TABLE diet_forms
    ADD COLUMN breakfast_time      VARCHAR(10) DEFAULT NULL,
    ADD COLUMN lunch_time          VARCHAR(10) DEFAULT NULL,
    ADD COLUMN evening_snack_time  VARCHAR(10) DEFAULT NULL,
    ADD COLUMN dinner_time         VARCHAR(10) DEFAULT NULL,
    ADD COLUMN whey_protein        ENUM('yes_using', 'open_to_trying', 'no_food_only') DEFAULT NULL;
`;

export const down = `
  ALTER TABLE diet_forms
    DROP COLUMN breakfast_time,
    DROP COLUMN lunch_time,
    DROP COLUMN evening_snack_time,
    DROP COLUMN dinner_time,
    DROP COLUMN whey_protein;
`;
