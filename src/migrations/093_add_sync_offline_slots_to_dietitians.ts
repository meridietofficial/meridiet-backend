export const up = `
  ALTER TABLE dietitians
    ADD COLUMN sync_offline_slots TINYINT(1) NOT NULL DEFAULT 0
      COMMENT 'When 1, offline bookings block online slots and vice versa'
      AFTER is_online;
`;

export const down = `
  ALTER TABLE dietitians
    DROP COLUMN sync_offline_slots;
`;
