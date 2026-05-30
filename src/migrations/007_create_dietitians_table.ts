export const up = `
  CREATE TABLE IF NOT EXISTS dietitians (
    id                       INT           NOT NULL AUTO_INCREMENT,
    user_id                  INT           NOT NULL UNIQUE,
    state                    VARCHAR(100)  NOT NULL,
    city                     VARCHAR(100)  NOT NULL,
    highest_degree           VARCHAR(200)  NOT NULL,
    registration_number      VARCHAR(100)  NOT NULL UNIQUE,
    experience               VARCHAR(50)   NOT NULL,
    specialization           VARCHAR(200)  NOT NULL,
    profile_photo            VARCHAR(500)  DEFAULT NULL,
    degree_certificate       VARCHAR(500)  DEFAULT NULL,
    registration_certificate VARCHAR(500)  DEFAULT NULL,
    id_proof                 VARCHAR(500)  DEFAULT NULL,
    is_verified              TINYINT(1)    NOT NULL DEFAULT 0,
    created_at               DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

export const down = `DROP TABLE IF EXISTS dietitians;`;
