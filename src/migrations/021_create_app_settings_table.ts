export const up = `
  CREATE TABLE IF NOT EXISTS app_settings (
    id          INT          NOT NULL AUTO_INCREMENT,
    \`key\`       VARCHAR(100) NOT NULL,
    value       VARCHAR(255) NOT NULL,
    description VARCHAR(255)          DEFAULT NULL,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_key (\`key\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

  INSERT IGNORE INTO app_settings (\`key\`, value, description) VALUES
    ('consultation_fee', '499', 'Global consultation fee charged per appointment'),
    ('currency',         'INR', 'Default currency code');
`;

export const down = `DROP TABLE IF EXISTS app_settings;`;
