export const up = `
  INSERT IGNORE INTO app_settings (\`key\`, value, description)
  VALUES ('video_recording_enabled', '0', 'Auto-record video calls: 1 = yes, 0 = no');
`;

export const down = `
  DELETE FROM app_settings WHERE \`key\` = 'video_recording_enabled';
`;
