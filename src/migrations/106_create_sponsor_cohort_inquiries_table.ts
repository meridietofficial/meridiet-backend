export const up = `
  CREATE TABLE IF NOT EXISTS sponsor_cohort_inquiries (
    id           INT          NOT NULL AUTO_INCREMENT,
    org          VARCHAR(255) NOT NULL,
    designation  VARCHAR(150)          DEFAULT NULL,
    contact      VARCHAR(150) NOT NULL,
    org_type     VARCHAR(100) NOT NULL,
    email        VARCHAR(255) NOT NULL,
    phone        VARCHAR(30)  NOT NULL,
    city         VARCHAR(100) NOT NULL,
    state        VARCHAR(100) NOT NULL,
    cohort_size  VARCHAR(100) NOT NULL,
    message      TEXT                  DEFAULT NULL,
    is_read      TINYINT(1)   NOT NULL DEFAULT 0,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_is_read    (is_read),
    INDEX idx_created_at (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

export const down = `DROP TABLE IF EXISTS sponsor_cohort_inquiries;`;
