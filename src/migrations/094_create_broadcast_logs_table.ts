export const up = `
  CREATE TABLE broadcast_logs (
    id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    admin_id         INT          NOT NULL,
    recipient_type   ENUM('all','users','dietitians','selected') NOT NULL,
    subject          VARCHAR(500) NOT NULL,
    message          TEXT         NOT NULL,
    total_recipients INT          NOT NULL DEFAULT 0,
    sent_count       INT          NOT NULL DEFAULT 0,
    failed_count     INT          NOT NULL DEFAULT 0,
    created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_bl_admin_id   (admin_id),
    INDEX idx_bl_created_at (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

export const down = `DROP TABLE IF EXISTS broadcast_logs;`;
