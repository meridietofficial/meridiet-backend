export const up = `
  CREATE TABLE IF NOT EXISTS food_allergies (
    id            INT           NOT NULL AUTO_INCREMENT,
    allergy_key   VARCHAR(50)   NOT NULL,
    label         VARCHAR(100)  NOT NULL,
    description   VARCHAR(255)           DEFAULT NULL,
    display_order TINYINT       NOT NULL DEFAULT 0,
    is_active     TINYINT(1)    NOT NULL DEFAULT 1,
    is_deleted    TINYINT(1)    NOT NULL DEFAULT 0,
    created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_allergy_key (allergy_key)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Common food allergies and intolerances shown during onboarding. Managed via admin panel.';

  INSERT IGNORE INTO food_allergies (allergy_key, label, description, display_order, is_active, is_deleted) VALUES
    ('none',          'None',                  'No known food allergies or intolerances',                           1,  1, 0),
    ('gluten',        'Gluten / Wheat',        'Found in wheat, rye, barley — causes issues in celiac/sensitivity', 2,  1, 0),
    ('dairy',         'Dairy / Lactose',       'Milk, cheese, paneer, butter, curd',                               3,  1, 0),
    ('eggs',          'Eggs',                  'Egg whites or yolks trigger reaction',                              4,  1, 0),
    ('peanuts',       'Peanuts',               'One of the most common and severe allergens',                       5,  1, 0),
    ('tree_nuts',     'Tree Nuts',             'Almonds, cashews, walnuts, pistachios, etc.',                       6,  1, 0),
    ('soy',           'Soy',                   'Soy milk, tofu, soy sauce, edamame',                               7,  1, 0),
    ('fish',          'Fish',                  'All types of fish including tuna, salmon, rohu, etc.',              8,  1, 0),
    ('shellfish',     'Shellfish / Seafood',   'Prawns, crabs, lobster, mussels',                                  9,  1, 0),
    ('sesame',        'Sesame',                'Sesame seeds and oil — common in Indian cooking',                  10,  1, 0),
    ('corn',          'Corn / Maize',          'Corn flour, cornstarch, corn syrup',                               11,  1, 0),
    ('mustard',       'Mustard',               'Mustard seeds and oil — widely used in Indian cooking',            12,  1, 0),
    ('onion_garlic',  'Onion & Garlic',        'Avoided by Jains and those with fructan sensitivity',             13,  1, 0),
    ('msg',           'MSG',                   'Monosodium glutamate — found in processed and Chinese foods',      14,  1, 0),
    ('sulfites',      'Sulfites',              'Preservatives in dried fruits, pickles, packaged foods',           15,  1, 0),
    ('nightshades',   'Nightshades',           'Tomato, potato, eggplant — causes inflammation in some people',   16,  1, 0);
`;

export const down = `DROP TABLE IF EXISTS food_allergies;`;
