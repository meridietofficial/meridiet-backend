export const up = `
  CREATE TABLE IF NOT EXISTS partnership_inquiries (
    id          INT          NOT NULL AUTO_INCREMENT,
    org         VARCHAR(255) NOT NULL,
    name        VARCHAR(150) NOT NULL,
    email       VARCHAR(255) NOT NULL,
    phone       VARCHAR(30)  NOT NULL,
    city        VARCHAR(100)          DEFAULT NULL,
    state       VARCHAR(100)          DEFAULT NULL,
    area        VARCHAR(100)          DEFAULT NULL,
    message     TEXT                  DEFAULT NULL,
    is_read     TINYINT(1)   NOT NULL DEFAULT 0,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_is_read    (is_read),
    INDEX idx_created_at (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

export const down = `DROP TABLE IF EXISTS partnership_inquiries;`;
