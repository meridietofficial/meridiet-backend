export const up = `
  CREATE TABLE IF NOT EXISTS nutrition_goal_settings (
    id                   INT           NOT NULL AUTO_INCREMENT,
    goal_key             VARCHAR(50)   NOT NULL COMMENT 'Internal key used in code to identify this goal',
    label                VARCHAR(100)  NOT NULL COMMENT 'Human-readable goal name shown in admin panel',
    calorie_min_offset   INT           NOT NULL COMMENT 'Added to TDEE for lower bound. Negative = deficit (e.g. -500). Positive = surplus (e.g. +200)',
    calorie_max_offset   INT           NOT NULL COMMENT 'Added to TDEE for upper bound. Negative = deficit (e.g. -300). Positive = surplus (e.g. +350)',
    protein_per_kg       DECIMAL(4,2)  NOT NULL COMMENT 'Grams of protein per kg of body weight per day',
    description          VARCHAR(255)           DEFAULT NULL COMMENT 'Explains the clinical reasoning behind these numbers',
    display_order        TINYINT       NOT NULL DEFAULT 0,
    is_active            TINYINT(1)    NOT NULL DEFAULT 1,
    created_at           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_goal_key (goal_key)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Calorie offset range and protein target per client goal. Calorie range = TDEE + offset. Example: weight_loss offset of -500/-300 means range is TDEE-500 to TDEE-300.';

  INSERT IGNORE INTO nutrition_goal_settings (goal_key, label, calorie_min_offset, calorie_max_offset, protein_per_kg, description, display_order) VALUES
    ('weight_loss',  'Weight Loss',     -500,  -300, 1.60, 'Moderate deficit to lose fat while preserving muscle mass',                          1),
    ('muscle_gain',  'Muscle Building',  200,   350, 2.00, 'Caloric surplus with high protein to support muscle growth',                         2),
    ('weight_gain',  'Weight Gain',      300,   500, 1.80, 'Gentle surplus for underweight clients who need to gain healthy mass',               3),
    ('maintenance',  'Maintenance',     -150,   150, 1.20, 'Near-TDEE range to maintain current weight and support general health',              4);
`;

export const down = `DROP TABLE IF EXISTS nutrition_goal_settings;`;
