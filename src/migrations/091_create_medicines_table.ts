export const up = `
  CREATE TABLE IF NOT EXISTS medicines (
    id             INT           NOT NULL AUTO_INCREMENT,
    medicine_key   VARCHAR(50)   NOT NULL,
    label          VARCHAR(150)  NOT NULL,
    category       VARCHAR(50)            DEFAULT NULL COMMENT 'e.g. diabetes, thyroid, bp, cholesterol, supplements, hormonal, digestive, steroids, pain, psychiatric, other',
    description    VARCHAR(255)           DEFAULT NULL,
    display_order  TINYINT       NOT NULL DEFAULT 0,
    is_active      TINYINT(1)    NOT NULL DEFAULT 1,
    is_deleted     TINYINT(1)    NOT NULL DEFAULT 0,
    created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_medicine_key (medicine_key)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Common medicines shown during onboarding for diet personalisation. Managed via admin panel.';

  INSERT IGNORE INTO medicines (medicine_key, label, category, description, display_order, is_active, is_deleted) VALUES
    -- Diabetes
    ('metformin',        'Metformin (Glycomet / Glucophage)',     'diabetes',     'Most common Type 2 diabetes medicine — affects B12 absorption',          1,  1, 0),
    ('insulin',          'Insulin (all types)',                   'diabetes',     'Carb timing and meal planning is critical with insulin use',              2,  1, 0),
    ('glimepiride',      'Glimepiride (Amaryl)',                  'diabetes',     'Sulphonylurea — taken with meals to avoid hypoglycemia',                  3,  1, 0),
    ('sitagliptin',      'Sitagliptin (Januvia)',                 'diabetes',     'DPP-4 inhibitor — can be taken with or without food',                     4,  1, 0),
    ('dapagliflozin',    'Dapagliflozin (Forxiga)',               'diabetes',     'SGLT-2 inhibitor — increases urine glucose, needs good hydration',        5,  1, 0),
    ('pioglitazone',     'Pioglitazone (Actos)',                  'diabetes',     'Insulin sensitiser — may cause weight gain and water retention',           6,  1, 0),

    -- Thyroid
    ('levothyroxine',    'Levothyroxine (Thyronorm / Eltroxin)',  'thyroid',      'Take on empty stomach — avoid calcium, iron and soy within 4 hours',      7,  1, 0),
    ('carbimazole',      'Carbimazole (Neomercazole)',            'thyroid',      'For hyperthyroidism — monitor iodine intake in diet',                     8,  1, 0),

    -- Blood Pressure
    ('amlodipine',       'Amlodipine (Stamlo / Amlokind)',        'bp',           'Calcium channel blocker — avoid grapefruit juice',                        9,  1, 0),
    ('telmisartan',      'Telmisartan (Telma)',                   'bp',           'ARB — low-sodium diet recommended alongside',                             10,  1, 0),
    ('atenolol',         'Atenolol (Tenormin)',                   'bp',           'Beta-blocker — take at same time daily, avoid abrupt stop',               11,  1, 0),
    ('ramipril',         'Ramipril (Cardace)',                    'bp',           'ACE inhibitor — limit high-potassium foods like bananas and oranges',     12,  1, 0),
    ('losartan',         'Losartan (Losar)',                      'bp',           'ARB — low-sodium and low-potassium diet recommended',                     13,  1, 0),

    -- Cholesterol
    ('atorvastatin',     'Atorvastatin (Lipitor / Atorva)',       'cholesterol',  'Statin — avoid grapefruit, take at night for best effect',                14,  1, 0),
    ('rosuvastatin',     'Rosuvastatin (Crestor / Rozavel)',      'cholesterol',  'Statin — low-fat diet enhances effectiveness',                            15,  1, 0),
    ('fenofibrate',      'Fenofibrate',                           'cholesterol',  'For high triglycerides — take with food, limit alcohol',                  16,  1, 0),

    -- Heart
    ('aspirin_low',      'Aspirin Low Dose (Ecosprin 75)',        'heart',        'Blood thinner — take with food to reduce stomach irritation',             17,  1, 0),
    ('clopidogrel',      'Clopidogrel (Clopilet / Plavix)',       'heart',        'Antiplatelet — avoid foods that increase bleeding risk',                  18,  1, 0),
    ('warfarin',         'Warfarin / Acenocoumarol',              'heart',        'Blood thinner — Vitamin K foods (greens) affect dosage significantly',    19,  1, 0),

    -- Vitamins & Supplements
    ('vitamin_d3',       'Vitamin D3 (Calcirol / Uprise-D3)',     'supplements',  'Take with a fatty meal for better absorption',                            20,  1, 0),
    ('vitamin_b12',      'Vitamin B12 / Methylcobalamin',         'supplements',  'Often deficient in vegetarians — affects energy and nerves',              21,  1, 0),
    ('iron_folic',       'Iron + Folic Acid (Ferrous Sulphate)',  'supplements',  'Take on empty stomach — avoid calcium and tea within 1 hour',             22,  1, 0),
    ('calcium_d3',       'Calcium + Vitamin D3 (Shelcal)',        'supplements',  'Take with food — avoid iron supplements at the same time',                23,  1, 0),
    ('omega_3',          'Omega-3 / Fish Oil',                    'supplements',  'Take with meals — reduces inflammation and triglycerides',                24,  1, 0),
    ('multivitamin',     'Multivitamin / Multimineral',           'supplements',  'General nutritional support — take with food',                            25,  1, 0),

    -- Hormonal / Women''s Health
    ('ocp',              'Oral Contraceptive Pills (OCP)',         'hormonal',     'May affect B6, B12, folate and magnesium levels',                         26,  1, 0),
    ('progesterone',     'Progesterone (Duphaston / Susten)',      'hormonal',     'Hormonal support — may cause bloating and appetite changes',              27,  1, 0),
    ('myoinositol',      'Myoinositol (for PCOS)',                 'hormonal',     'Improves insulin sensitivity in PCOS — take with meals',                  28,  1, 0),
    ('hrt',              'Hormone Replacement Therapy (HRT)',      'hormonal',     'Post-menopause hormone support — affects weight and appetite',             29,  1, 0),

    -- Digestive
    ('pantoprazole',     'Pantoprazole / Omeprazole (Pan-D)',      'digestive',    'PPI for acidity — take 30 min before meals, affects B12 absorption',     30,  1, 0),
    ('domperidone',      'Domperidone (Domstal)',                  'digestive',    'For nausea and slow digestion — take 30 min before meals',               31,  1, 0),
    ('laxatives',        'Laxatives / Stool Softeners',            'digestive',    'For constipation — high fibre and fluid diet works alongside',           32,  1, 0),

    -- Steroids
    ('prednisolone',     'Prednisolone / Corticosteroids',         'steroids',     'Increases blood sugar and appetite — low-sodium, low-sugar diet needed', 33,  1, 0),

    -- Uric Acid
    ('allopurinol',      'Allopurinol (Zyloric)',                  'uric_acid',    'For gout — low-purine diet and high hydration needed alongside',         34,  1, 0),
    ('febuxostat',       'Febuxostat (Febustat)',                   'uric_acid',    'For chronic gout — avoid red meat, alcohol and fructose',                35,  1, 0),

    -- Pain / Anti-inflammatory
    ('nsaids',           'NSAIDs (Ibuprofen / Diclofenac)',        'pain',         'Take with food — long-term use affects gut and kidney health',            36,  1, 0),

    -- Psychiatric
    ('antidepressants',  'Antidepressants (SSRIs)',                'psychiatric',  'May affect appetite, weight and gut motility',                            37,  1, 0),
    ('anti_anxiety',     'Anti-Anxiety Medication (Benzodiazepines)','psychiatric','May increase appetite and cause weight gain',                             38,  1, 0),

    -- General
    ('antibiotics',      'Antibiotics (current course)',           'other',        'Disrupts gut flora — probiotics and light diet recommended',              39,  1, 0),
    ('other_medicine',   'Other Medicine',                         'other',        'Any other medicine not listed above',                                     99,  1, 0);
`;

export const down = `DROP TABLE IF EXISTS medicines;`;
