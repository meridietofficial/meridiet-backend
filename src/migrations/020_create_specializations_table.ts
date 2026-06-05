export const up = `
  CREATE TABLE IF NOT EXISTS specializations (
    id          INT          NOT NULL AUTO_INCREMENT,
    value       VARCHAR(200) NOT NULL,            -- full canonical name (DB value + filter value)
    label       VARCHAR(100) NOT NULL,            -- short display name for filter tabs
    slug        VARCHAR(120) NOT NULL,            -- url-friendly key
    icon        VARCHAR(100)          DEFAULT NULL, -- icon key/name (frontend maps to an icon)
    image_url   VARCHAR(500)          DEFAULT NULL, -- optional image
    sort_order  INT          NOT NULL DEFAULT 0,
    is_active   TINYINT(1)   NOT NULL DEFAULT 1,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_value (value),
    UNIQUE KEY uq_slug (slug)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

  INSERT IGNORE INTO specializations (value, label, slug, icon, sort_order) VALUES
    ('Weight Management',              'Weight',          'weight-management',         'scale',            1),
    ('Sports Nutrition',              'Sports',          'sports-nutrition',          'dumbbell',         2),
    ('Clinical Nutrition',            'Clinical',        'clinical-nutrition',        'stethoscope',      3),
    ('Pediatric Nutrition',           'Pediatric',       'pediatric-nutrition',       'baby',             4),
    ('PCOS / Hormonal Imbalance',     'PCOS',            'pcos-hormonal-imbalance',   'venus',            5),
    ('Diabetes Care',                 'Diabetes',        'diabetes-care',             'droplet',          6),
    ('Gut Health & IBS',              'Gut Health',      'gut-health-ibs',            'wheat',            7),
    ('General Wellness',              'Wellness',        'general-wellness',          'sparkles',         8),
    ('Thyroid Management',            'Thyroid',         'thyroid-management',        'activity',         9),
    ('Renal / Kidney Nutrition',      'Kidney',          'renal-kidney-nutrition',    'droplets',         10),
    ('Cardiac Nutrition',             'Cardiac',         'cardiac-nutrition',         'heart-pulse',      11),
    ('Oncology Nutrition',            'Oncology',        'oncology-nutrition',        'ribbon',           12),
    ('Pre & Postnatal Nutrition',     'Prenatal',        'pre-postnatal-nutrition',   'flower-2',         13),
    ('Geriatric Nutrition',           'Geriatric',       'geriatric-nutrition',       'person-standing',  14),
    ('Eating Disorders',              'Eating Disorders','eating-disorders',          'utensils-crossed', 15),
    ('Food Allergy & Intolerance',    'Allergies',       'food-allergy-intolerance',  'shield-alert',     16),
    ('Vegan / Plant-Based Nutrition', 'Vegan',           'vegan-plant-based-nutrition','sprout',          17),
    ('Bariatric Nutrition',           'Bariatric',       'bariatric-nutrition',       'activity',         18),
    ('Immune & Functional Nutrition', 'Immunity',        'immune-functional-nutrition','shield-check',    19),
    ('Keto / Low-Carb Nutrition',     'Keto',            'keto-low-carb-nutrition',   'egg',              20),
    ('Fatty Liver & Liver Health',    'Liver Health',    'fatty-liver-liver-health',  'flask-conical',    21),
    ('Cholesterol & Lipid Management','Cholesterol',     'cholesterol-lipid-management','heart',          22),
    ('Hypertension & Heart Health',   'Hypertension',    'hypertension-heart-health', 'heart-pulse',      23),
    ('Anaemia & Iron Deficiency',     'Anaemia',         'anaemia-iron-deficiency',   'pill',             24),
    ('Bone Health & Osteoporosis',    'Bone Health',     'bone-health-osteoporosis',  'bone',             25),
    ('Skin & Hair Nutrition',         'Skin & Hair',     'skin-hair-nutrition',       'sparkle',          26),
    ('Mental Health & Nutrition',     'Mental Health',   'mental-health-nutrition',   'brain',            27);
`;

export const down = `DROP TABLE IF EXISTS specializations;`;
