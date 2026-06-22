export const up = `
  CREATE TABLE IF NOT EXISTS nutrition_activity_multipliers (
    id             INT           NOT NULL AUTO_INCREMENT,
    activity_key   VARCHAR(50)   NOT NULL COMMENT 'Must match activity_level values in diet_forms table',
    label          VARCHAR(100)  NOT NULL COMMENT 'Human-readable name shown in admin panel',
    multiplier     DECIMAL(6,4)  NOT NULL COMMENT 'PAL value: TDEE = BMR x multiplier',
    description    VARCHAR(255)           DEFAULT NULL COMMENT 'Explains what this activity level means in real life',
    display_order  TINYINT       NOT NULL DEFAULT 0,
    is_active      TINYINT(1)    NOT NULL DEFAULT 1,
    created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_activity_key (activity_key)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='PAL multipliers for TDEE calculation. TDEE = BMR x multiplier. Each row maps to one activity_level option in the diet form.';

  INSERT IGNORE INTO nutrition_activity_multipliers (activity_key, label, multiplier, description, display_order) VALUES
    ('sedentary',         'Sedentary',         1.2000, 'Desk job, no exercise or very little movement throughout the day',         1),
    ('lightly_active',    'Lightly Active',    1.3750, 'Light exercise 1-3 days per week or a daily 30 min walk',                 2),
    ('moderately_active', 'Moderately Active', 1.5500, 'Moderate exercise 3-5 days per week such as gym or yoga',                 3),
    ('very_active',       'Very Active',       1.7250, 'Hard exercise 6-7 days per week or a physically demanding job',           4),
    ('super_active',      'Super Active',      1.9000, 'Intense training twice a day or a very heavy labour job every day',       5);
`;

export const down = `DROP TABLE IF EXISTS nutrition_activity_multipliers;`;
