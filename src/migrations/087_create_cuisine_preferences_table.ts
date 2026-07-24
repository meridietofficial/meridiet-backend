export const up = `
  CREATE TABLE IF NOT EXISTS cuisine_preferences (
    id            INT           NOT NULL AUTO_INCREMENT,
    cuisine_key   VARCHAR(50)   NOT NULL,
    label         VARCHAR(100)  NOT NULL,
    description   VARCHAR(255)           DEFAULT NULL,
    display_order TINYINT       NOT NULL DEFAULT 0,
    is_active     TINYINT(1)    NOT NULL DEFAULT 1,
    is_deleted    TINYINT(1)    NOT NULL DEFAULT 0,
    created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_cuisine_key (cuisine_key)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Cuisine preferences shown to users during onboarding. Managed via admin panel.';

  INSERT IGNORE INTO cuisine_preferences (cuisine_key, label, description, display_order, is_active, is_deleted) VALUES
    ('north_indian',    'North Indian',       'Roti, dal, sabzi, paneer-based meals',                    1,  1, 0),
    ('south_indian',    'South Indian',       'Rice, idli, dosa, sambar, coconut-based dishes',          2,  1, 0),
    ('bengali',         'Bengali',            'Fish, rice, mustard-based curries',                       3,  1, 0),
    ('gujarati',        'Gujarati',           'Dal-bati, thepla, khichdi, sweet-salty flavours',         4,  1, 0),
    ('punjabi',         'Punjabi',            'Butter-rich dishes, dal makhani, parathas',               5,  1, 0),
    ('maharashtrian',   'Maharashtrian',      'Bhakri, misal, poha, coastal seafood',                    6,  1, 0),
    ('rajasthani',      'Rajasthani',         'Dal baati churma, gatte ki sabzi, dry spiced dishes',     7,  1, 0),
    ('kerala',          'Kerala',             'Coconut, seafood, appam, stew, sadya meals',              8,  1, 0),
    ('hyderabadi',      'Hyderabadi',         'Biryani, haleem, rich Mughal-influenced dishes',          9,  1, 0),
    ('odia',            'Odia',               'Rice, dalma, light oil-based coastal dishes',            10,  1, 0),
    ('bihari',          'Bihari',             'Litti chokha, sattu, simple earthy dishes',              11,  1, 0),
    ('kashmiri',        'Kashmiri',           'Wazwan, rogan josh, lotus stem dishes',                  12,  1, 0),
    ('goan',            'Goan',               'Seafood, vinegar-based curries, xacuti',                 13,  1, 0),
    ('chettinad',       'Chettinad',          'Bold spices, pepper-heavy South Indian cuisine',         14,  1, 0),
    ('mughlai',         'Mughlai',            'Rich gravies, kebabs, korma, biryani',                   15,  1, 0),
    ('north_eastern',   'North Eastern',      'Fermented foods, bamboo shoots, light broths',           16,  1, 0),
    ('continental',     'Continental',        'Salads, grills, pasta, baked dishes',                    17,  1, 0),
    ('mediterranean',   'Mediterranean',      'Olive oil, legumes, whole grains, lean protein',         18,  1, 0),
    ('indo_chinese',    'Indo-Chinese',       'Fried rice, noodles, Manchurian — Indian-Chinese fusion',19,  1, 0),
    ('no_preference',   'No Preference',      'Open to any cuisine',                                    20,  1, 0);
`;

export const down = `DROP TABLE IF EXISTS cuisine_preferences;`;
