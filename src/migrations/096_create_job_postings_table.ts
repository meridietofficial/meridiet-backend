export const up = `
  CREATE TABLE job_postings (
    id                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title                VARCHAR(150)  NOT NULL,
    department           VARCHAR(100)  NOT NULL,
    location             VARCHAR(100)  NOT NULL,
    job_type             ENUM('full_time','part_time','contract','internship') NOT NULL,
    experience_required  VARCHAR(50)   NOT NULL,
    description          TEXT          NOT NULL,
    responsibilities     JSON          NOT NULL,
    requirements         JSON          NOT NULL,
    salary_range         VARCHAR(50)   NULL,
    is_active            TINYINT(1)    NOT NULL DEFAULT 1,
    deadline             DATE          NULL,
    created_at           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_jp_is_active  (is_active),
    INDEX idx_jp_department (department),
    INDEX idx_jp_deadline   (deadline)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

export const down = `DROP TABLE IF EXISTS job_postings;`;
