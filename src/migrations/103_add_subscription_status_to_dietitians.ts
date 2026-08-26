export const up = `
  ALTER TABLE dietitians
    ADD COLUMN subscription_status ENUM('pending_approval','trial','active','expired') NOT NULL DEFAULT 'pending_approval' AFTER is_verified,
    ADD COLUMN trial_starts_at DATETIME NULL AFTER subscription_status,
    ADD COLUMN trial_ends_at DATETIME NULL AFTER trial_starts_at,
    ADD COLUMN activated_at DATETIME NULL AFTER trial_ends_at;

  UPDATE dietitians SET subscription_status = 'active' WHERE is_verified = 1;
`;

export const down = `
  ALTER TABLE dietitians
    DROP COLUMN activated_at,
    DROP COLUMN trial_ends_at,
    DROP COLUMN trial_starts_at,
    DROP COLUMN subscription_status;
`;
