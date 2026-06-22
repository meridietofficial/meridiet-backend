export const up = `
  CREATE TABLE IF NOT EXISTS nutrition_calorie_floors (
    id            INT          NOT NULL AUTO_INCREMENT,
    gender        VARCHAR(20)  NOT NULL COMMENT 'Matches gender values in diet_forms table: male, female, other',
    min_calories  INT          NOT NULL COMMENT 'Absolute minimum daily calories. Plan will never go below this regardless of TDEE or goal',
    description   VARCHAR(255)          DEFAULT NULL COMMENT 'Clinical reason for this floor value',
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_gender (gender)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Minimum safe daily calorie intake per gender. Applied as a hard floor after all goal-based calorie calculations. No plan can go below this value.';

  INSERT IGNORE INTO nutrition_calorie_floors (gender, min_calories, description) VALUES
    ('male',   1500, 'Clinical minimum for adult males. Going below causes muscle loss, fatigue and nutritional deficiency'),
    ('female', 1200, 'Clinical minimum for adult females. Going below causes hormonal disruption and nutrient deficiency'),
    ('other',  1200, 'Conservative minimum applied when gender is not specified');
`;

export const down = `DROP TABLE IF EXISTS nutrition_calorie_floors;`;
