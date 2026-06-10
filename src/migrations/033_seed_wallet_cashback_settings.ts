export const up = `
  INSERT IGNORE INTO app_settings (\`key\`, value, description) VALUES
    ('wallet_cashback_enabled', '1',  'Enable wallet cashback on diet plan generation: 1 = yes, 0 = no'),
    ('wallet_cashback_percent', '10', 'Cashback percentage credited to wallet on diet plan generation (e.g. 10 = 10%)');
`;

export const down = `
  DELETE FROM app_settings WHERE \`key\` IN ('wallet_cashback_enabled', 'wallet_cashback_percent');
`;
