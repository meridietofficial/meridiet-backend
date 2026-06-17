export const up = `
  INSERT IGNORE INTO app_settings (\`key\`, value, description) VALUES
    ('platform_commission_pct', '20', 'Percentage Meridiet charges on every completed booking');
`;

export const down = `
  DELETE FROM app_settings WHERE \`key\` = 'platform_commission_pct';
`;
