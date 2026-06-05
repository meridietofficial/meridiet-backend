export const up = `
  CREATE TABLE IF NOT EXISTS appointments (
    id               INT          NOT NULL AUTO_INCREMENT,
    dietitian_id     INT          NOT NULL,
    user_id          INT                   DEFAULT NULL,

    -- Contact details (supports guest booking without a user account)
    name             VARCHAR(150) NOT NULL,
    email            VARCHAR(255)          DEFAULT NULL,
    phone            VARCHAR(20)           DEFAULT NULL,

    -- Slot
    appointment_date DATE         NOT NULL,
    slot             VARCHAR(20)  NOT NULL,

    -- Money (snapshot of the fee at the time of booking)
    fee              DECIMAL(10,2) NOT NULL DEFAULT 0,
    currency         VARCHAR(10)  NOT NULL DEFAULT 'INR',

    -- Status
    status           ENUM('pending','confirmed','cancelled','completed') NOT NULL DEFAULT 'pending',
    payment_status   ENUM('unpaid','paid','refunded')                    NOT NULL DEFAULT 'unpaid',
    payment_id       VARCHAR(100)          DEFAULT NULL,
    order_id         VARCHAR(100)          DEFAULT NULL,

    notes            TEXT                  DEFAULT NULL,

    created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_dietitian (dietitian_id),
    INDEX idx_user (user_id),
    INDEX idx_date (appointment_date),
    -- Prevents the same slot being booked twice for a dietitian
    UNIQUE KEY uq_slot (dietitian_id, appointment_date, slot),
    FOREIGN KEY (dietitian_id) REFERENCES dietitians(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

export const down = `DROP TABLE IF EXISTS appointments;`;
