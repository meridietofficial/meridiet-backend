export const up = `
  ALTER TABLE dietitians
    ADD COLUMN is_under_offer TINYINT(1) NOT NULL DEFAULT 0 AFTER wallet_suspended;

  INSERT INTO app_settings (\`key\`, value, description) VALUES
    ('is_offer', '0', 'Global offer toggle: 1 = offer active, 0 = off'),
    ('appointment_offer_price', '99', 'Offer price (INR) charged for dietitians under the nutrition month offer')
  ON DUPLICATE KEY UPDATE value = VALUES(value);
`;

export const down = `
  ALTER TABLE dietitians DROP COLUMN is_under_offer;

  DELETE FROM app_settings WHERE \`key\` IN ('is_offer', 'appointment_offer_price');
`;
