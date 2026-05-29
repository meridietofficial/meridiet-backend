/**
 * Migration: 004 — Update diet_forms to match revised frontend form
 * - Drops removed fields (body_type, basic_notes, sleep_duration, water_intake,
 *   workout_frequency, daily_steps, food_intolerances, other_intolerance,
 *   budget, meal_preference, prep_time, grocery_shopping, cooking_support,
 *   other_preferences)
 * - Converts preferred_meals and delivery_method from ENUM → JSON (multi-select)
 * - Adds state_code column
 */

export const up = `
  UPDATE diet_forms SET preferred_meals = NULL WHERE preferred_meals = '' OR preferred_meals IS NOT NULL;
  UPDATE diet_forms SET delivery_method = NULL WHERE delivery_method = '' OR delivery_method IS NOT NULL;
  ALTER TABLE diet_forms
    DROP COLUMN body_type,
    DROP COLUMN basic_notes,
    DROP COLUMN sleep_duration,
    DROP COLUMN water_intake,
    DROP COLUMN workout_frequency,
    DROP COLUMN daily_steps,
    DROP COLUMN food_intolerances,
    DROP COLUMN other_intolerance,
    DROP COLUMN budget,
    DROP COLUMN meal_preference,
    DROP COLUMN prep_time,
    DROP COLUMN grocery_shopping,
    DROP COLUMN cooking_support,
    DROP COLUMN other_preferences,
    MODIFY COLUMN preferred_meals JSON DEFAULT NULL,
    MODIFY COLUMN delivery_method JSON DEFAULT NULL,
    ADD COLUMN state_code VARCHAR(10) DEFAULT NULL AFTER state;
`;

export const down = `
  ALTER TABLE diet_forms
    ADD COLUMN body_type ENUM('slim','average','overweight','obese','athletic') DEFAULT NULL,
    ADD COLUMN basic_notes TEXT DEFAULT NULL,
    ADD COLUMN sleep_duration ENUM('less_than_5','5_6','6_7','7_8','more_than_8') DEFAULT NULL,
    ADD COLUMN water_intake ENUM('less_than_1l','1_2l','2_3l','3_4l','more_than_4l') DEFAULT NULL,
    ADD COLUMN workout_frequency ENUM('never','1x','2_3x','4_5x','daily') DEFAULT NULL,
    ADD COLUMN daily_steps ENUM('less_2k','2k_5k','5k_8k','8k_12k','more_12k') DEFAULT NULL,
    ADD COLUMN food_intolerances JSON DEFAULT NULL,
    ADD COLUMN other_intolerance TEXT DEFAULT NULL,
    ADD COLUMN budget ENUM('under_500','500_1k','1k_2k','2k_3k','above_3k') DEFAULT NULL,
    ADD COLUMN meal_preference ENUM('home_cooked','meal_prep','ready_to_eat','food_delivery') DEFAULT NULL,
    ADD COLUMN prep_time ENUM('less_30min','30_60min','1_2hrs','more_2hrs') DEFAULT NULL,
    ADD COLUMN grocery_shopping ENUM('online','local_market','both') DEFAULT NULL,
    ADD COLUMN cooking_support ENUM('self','someone_helps','full_time_help') DEFAULT NULL,
    ADD COLUMN other_preferences TEXT DEFAULT NULL,
    MODIFY COLUMN preferred_meals ENUM('home_cooked','restaurant','meal_prep','no_preference') DEFAULT NULL,
    MODIFY COLUMN delivery_method ENUM('whatsapp','email') DEFAULT NULL,
    DROP COLUMN state_code;
`;
