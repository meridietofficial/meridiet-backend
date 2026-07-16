export const up = `
  CREATE TABLE IF NOT EXISTS course_enquiries (
    id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name           VARCHAR(150)  NOT NULL,
    email          VARCHAR(254)  NOT NULL,
    phone          VARCHAR(20)   NOT NULL,
    qualification  VARCHAR(200)  NULL,
    message        TEXT          NULL,
    status         ENUM('new','contacted','closed') NOT NULL DEFAULT 'new',
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

export const down = `DROP TABLE IF EXISTS course_enquiries;`;
