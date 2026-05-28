/**
 * Migration: 001 — Create users table
 */

export const up = `
  CREATE TABLE IF NOT EXISTS users (
    id           INT           NOT NULL AUTO_INCREMENT,
    full_name    VARCHAR(100)  NOT NULL,
    email        VARCHAR(150)           DEFAULT NULL UNIQUE,
    password     VARCHAR(255)  NOT NULL,
    phone_code   VARCHAR(10)            DEFAULT NULL,
    phone_number VARCHAR(20)            DEFAULT NULL,
    role         ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    is_active    TINYINT(1)    NOT NULL DEFAULT 1,
    is_delete    TINYINT(1)    NOT NULL DEFAULT 0,
    avatar_url   VARCHAR(500)           DEFAULT NULL,
    created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_email (email),
    INDEX idx_role  (role)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

export const down = `
  DROP TABLE IF EXISTS users;
`;
