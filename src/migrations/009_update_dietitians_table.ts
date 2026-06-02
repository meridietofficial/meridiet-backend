export const up = `
  ALTER TABLE dietitians
    MODIFY COLUMN specialization   JSON            DEFAULT NULL,
    ADD COLUMN date_of_birth       DATE            DEFAULT NULL AFTER specialization,
    ADD COLUMN gender              VARCHAR(20)     DEFAULT NULL AFTER date_of_birth,
    ADD COLUMN bio                 TEXT            DEFAULT NULL AFTER gender,
    ADD COLUMN languages           JSON            DEFAULT NULL AFTER bio,
    ADD COLUMN services            JSON            DEFAULT NULL AFTER languages,
    ADD COLUMN degrees             JSON            DEFAULT NULL AFTER services,
    ADD COLUMN awards              JSON            DEFAULT NULL AFTER degrees,
    ADD COLUMN availability        JSON            DEFAULT NULL AFTER awards,
    ADD COLUMN experience_certificate VARCHAR(500) DEFAULT NULL AFTER id_proof;
`;

export const down = `
  ALTER TABLE dietitians
    MODIFY COLUMN specialization   VARCHAR(200)    DEFAULT NULL,
    DROP COLUMN date_of_birth,
    DROP COLUMN gender,
    DROP COLUMN bio,
    DROP COLUMN languages,
    DROP COLUMN services,
    DROP COLUMN degrees,
    DROP COLUMN awards,
    DROP COLUMN availability,
    DROP COLUMN experience_certificate;
`;
