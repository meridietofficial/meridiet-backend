export const up = `
  CREATE TABLE IF NOT EXISTS phone_otps (
    id           INT          NOT NULL AUTO_INCREMENT,
    phone_code   VARCHAR(10)  NOT NULL,
    phone_number VARCHAR(20)  NOT NULL,
    otp          VARCHAR(10)  NOT NULL,
    expires_at   DATETIME     NOT NULL,
    verified     TINYINT(1)   NOT NULL DEFAULT 0,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_phone (phone_code, phone_number),
    INDEX idx_expires_at (expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

export const down = `DROP TABLE IF EXISTS phone_otps;`;
