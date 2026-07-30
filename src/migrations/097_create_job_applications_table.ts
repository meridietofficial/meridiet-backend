export const up = `
  CREATE TABLE job_applications (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    job_id              INT UNSIGNED  NOT NULL,
    full_name           VARCHAR(150)  NOT NULL,
    email               VARCHAR(150)  NOT NULL,
    phone               VARCHAR(20)   NOT NULL,
    current_location    VARCHAR(100)  NOT NULL,
    total_experience    VARCHAR(50)   NOT NULL,
    current_company     VARCHAR(150)  NULL,
    current_ctc         VARCHAR(50)   NULL,
    expected_ctc        VARCHAR(50)   NULL,
    notice_period       VARCHAR(50)   NULL,
    resume_url          VARCHAR(500)  NOT NULL,
    cover_letter        TEXT          NULL,
    linkedin_url        VARCHAR(300)  NULL,
    status              ENUM('new','reviewing','shortlisted','rejected','hired') NOT NULL DEFAULT 'new',
    admin_notes         TEXT          NULL,
    created_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_ja_job_id FOREIGN KEY (job_id) REFERENCES job_postings(id) ON DELETE CASCADE,
    INDEX idx_ja_job_id    (job_id),
    INDEX idx_ja_status    (status),
    INDEX idx_ja_email     (email),
    INDEX idx_ja_created_at(created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

export const down = `DROP TABLE IF EXISTS job_applications;`;
