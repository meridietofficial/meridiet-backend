/**
 * Migration: 002 — Create diet_forms table
 * Stores the onboarding questionnaire filled by users (logged-in or guest)
 * to generate a personalised diet plan
 */

export const up = `
  CREATE TABLE IF NOT EXISTS diet_forms (
    id                    INT           NOT NULL AUTO_INCREMENT,
    user_id               INT                    DEFAULT NULL,

    -- Step 1: Basic Details
    full_name             VARCHAR(100)           DEFAULT NULL,
    age                   INT                    DEFAULT NULL,
    gender                ENUM('male','female','other','prefer_not_to_say') DEFAULT NULL,
    dob                   DATE                   DEFAULT NULL,
    height_unit           ENUM('cm','ft_in')     DEFAULT NULL,
    height                VARCHAR(20)            DEFAULT NULL,
    weight_unit           ENUM('kg','lbs')       DEFAULT NULL,
    weight                DECIMAL(5,2)           DEFAULT NULL,
    body_type             ENUM('slim','average','overweight','obese','athletic') DEFAULT NULL,
    basic_notes           TEXT                   DEFAULT NULL,

    -- Step 2: Goals (multi-select stored as JSON)
    goals                 JSON                   DEFAULT NULL,

    -- Step 3: Lifestyle
    activity_level        ENUM('sedentary','lightly_active','moderately_active','very_active','super_active') DEFAULT NULL,
    sleep_duration        ENUM('less_than_5','5_6','6_7','7_8','more_than_8') DEFAULT NULL,
    water_intake          ENUM('less_than_1l','1_2l','2_3l','3_4l','more_than_4l') DEFAULT NULL,
    work_type             ENUM('desk_job','standing_job','physical_job') DEFAULT NULL,
    workout_frequency     ENUM('never','1x','2_3x','4_5x','daily') DEFAULT NULL,
    workout_type          ENUM('none','gym','yoga','running','sports','mixed') DEFAULT NULL,
    daily_steps           ENUM('less_2k','2k_5k','5k_8k','8k_12k','more_12k') DEFAULT NULL,

    -- Step 4: Food Preferences
    diet_type             ENUM('vegetarian','non_vegetarian','eggetarian') DEFAULT NULL,
    cuisine_preference    JSON                   DEFAULT NULL,
    preferred_meals       ENUM('home_cooked','restaurant','meal_prep','no_preference') DEFAULT NULL,
    food_allergies        JSON                   DEFAULT NULL,
    foods_dislike         TEXT                   DEFAULT NULL,
    favorite_foods        TEXT                   DEFAULT NULL,
    breakfast_time        TIME                   DEFAULT '08:00:00',
    mid_morning_time      TIME                   DEFAULT '11:00:00',
    lunch_time            TIME                   DEFAULT '13:30:00',
    evening_snack_time    TIME                   DEFAULT '17:00:00',
    dinner_time           TIME                   DEFAULT '20:30:00',

    -- Step 5: Health & Medical
    medical_conditions    JSON                   DEFAULT NULL,
    other_condition       TEXT                   DEFAULT NULL,
    on_medication         ENUM('yes_regularly','yes_occasionally','no') DEFAULT NULL,
    medications           TEXT                   DEFAULT NULL,
    food_intolerances     JSON                   DEFAULT NULL,
    other_intolerance     TEXT                   DEFAULT NULL,
    digestive_health      ENUM('excellent','good','average','poor') DEFAULT NULL,
    smoke_alcohol         ENUM('neither','smoke','alcohol','both') DEFAULT NULL,
    health_notes          TEXT                   DEFAULT NULL,

    -- Step 6: Budget & Convenience
    budget                ENUM('under_500','500_1k','1k_2k','2k_3k','above_3k') DEFAULT NULL,
    meal_preference       ENUM('home_cooked','meal_prep','ready_to_eat','food_delivery') DEFAULT NULL,
    prep_time             ENUM('less_30min','30_60min','1_2hrs','more_2hrs') DEFAULT NULL,
    grocery_shopping      ENUM('online','local_market','both') DEFAULT NULL,
    cooking_support       ENUM('self','someone_helps','full_time_help') DEFAULT NULL,
    other_preferences     TEXT                   DEFAULT NULL,

    -- Step 7: Contact Details
    contact_name          VARCHAR(100)           DEFAULT NULL,
    whatsapp              VARCHAR(20)            DEFAULT NULL,
    email                 VARCHAR(150)           DEFAULT NULL,
    delivery_method       ENUM('whatsapp','email') DEFAULT NULL,
    city                  VARCHAR(100)           DEFAULT NULL,
    state                 VARCHAR(100)           DEFAULT NULL,
    final_notes           TEXT                   DEFAULT NULL,

    created_at            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_user_id (user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

export const down = `
  DROP TABLE IF EXISTS diet_forms;
`;
