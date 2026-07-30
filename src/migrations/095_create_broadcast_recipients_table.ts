export const up = `
  CREATE TABLE broadcast_recipients (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    broadcast_id INT UNSIGNED  NOT NULL,
    user_id      INT           NULL,
    email        VARCHAR(255)  NOT NULL,
    full_name    VARCHAR(255)  NOT NULL,
    status       ENUM('sent','failed') NOT NULL,
    created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_br_broadcast_id (broadcast_id),
    INDEX idx_br_created_at   (created_at),
    CONSTRAINT fk_br_broadcast FOREIGN KEY (broadcast_id)
      REFERENCES broadcast_logs(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

export const down = `DROP TABLE IF EXISTS broadcast_recipients;`;
