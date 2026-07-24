export const up = `
  CREATE TABLE IF NOT EXISTS health_goals (
    id            INT           NOT NULL AUTO_INCREMENT,
    goal_key      VARCHAR(50)   NOT NULL,
    label         VARCHAR(100)  NOT NULL,
    description   VARCHAR(255)           DEFAULT NULL,
    display_order TINYINT       NOT NULL DEFAULT 0,
    is_active     TINYINT(1)    NOT NULL DEFAULT 1,
    is_deleted    TINYINT(1)    NOT NULL DEFAULT 0,
    created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_goal_key (goal_key)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Health goals shown to users during onboarding. Managed via admin panel.';

  INSERT IGNORE INTO health_goals (goal_key, label, description, display_order, is_active, is_deleted) VALUES
    ('weight_loss',          'Weight Loss',            'Lose excess body fat in a healthy and sustainable way',               1, 1, 0),
    ('weight_gain',          'Weight Gain',            'Gain healthy mass for underweight individuals',                        2, 1, 0),
    ('muscle_gain',          'Muscle Building',        'Build lean muscle mass with high-protein nutrition',                   3, 1, 0),
    ('maintenance',          'Maintain Weight',        'Stay at current weight while improving overall health',               4, 1, 0),
    ('diabetes_management',  'Diabetes Management',    'Control blood sugar levels through a balanced diet plan',             5, 1, 0),
    ('thyroid_management',   'Thyroid Management',     'Support thyroid health with targeted nutrition',                      6, 1, 0),
    ('pcod_pcos',            'PCOD / PCOS',            'Manage hormonal imbalance and symptoms through diet',                 7, 1, 0),
    ('heart_health',         'Heart Health',           'Reduce cholesterol and support cardiovascular health',                8, 1, 0),
    ('gut_health',           'Gut Health',             'Improve digestion and gut microbiome through diet',                   9, 1, 0),
    ('energy_fitness',       'Energy & Fitness',       'Boost daily energy levels and improve overall fitness',              10, 1, 0),
    ('sports_performance',   'Sports Performance',     'Optimise nutrition for athletic training and recovery',              11, 1, 0),
    ('pregnancy_nutrition',  'Pregnancy Nutrition',    'Meet nutritional needs during pregnancy and postpartum',             12, 1, 0),
    ('child_nutrition',      'Child Nutrition',        'Support healthy growth and development in children',                 13, 1, 0),
    ('senior_nutrition',     'Senior / Elderly',       'Address nutritional needs for healthy ageing',                       14, 1, 0),
    ('immunity_boost',       'Immunity Boost',         'Strengthen immunity through micronutrient-rich meal plans',          15, 1, 0);
`;

export const down = `DROP TABLE IF EXISTS health_goals;`;
