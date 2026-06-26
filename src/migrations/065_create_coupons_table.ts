export const up = `
  CREATE TABLE IF NOT EXISTS coupons (
    id                   INT             NOT NULL AUTO_INCREMENT,
    code                 VARCHAR(50)     NOT NULL,
    type                 ENUM('discount','promotional') NOT NULL,
    discount_type        ENUM('percentage','flat')      NOT NULL,
    discount_value       DECIMAL(10,2)   NOT NULL,
    max_discount_amount  DECIMAL(10,2)   NULL COMMENT 'Cap on discount for percentage type (e.g. max ₹500 off)',
    min_order_amount     DECIMAL(10,2)   NULL COMMENT 'Minimum cart value required to apply this coupon',
    applicable_on        ENUM('diet_plan','appointment','both') NOT NULL DEFAULT 'both',
    applicable_plans     VARCHAR(100)    NULL COMMENT 'NULL means all plans. Comma-separated plan keys e.g. "1_week,1_month"',
    max_uses             INT             NULL COMMENT 'Total uses allowed across all users. NULL = unlimited',
    max_uses_per_user    INT             NOT NULL DEFAULT 1,
    valid_from           DATETIME        NULL COMMENT 'NULL = active immediately',
    valid_until          DATETIME        NULL COMMENT 'NULL = never expires',
    is_active            TINYINT(1)      NOT NULL DEFAULT 1,
    influencer_name      VARCHAR(100)    NULL,
    influencer_phone     VARCHAR(20)     NULL,
    campaign_name        VARCHAR(100)    NULL,
    description          VARCHAR(255)    NULL COMMENT 'Internal admin note',
    created_at           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_code (code),
    INDEX idx_type (type),
    INDEX idx_is_active (is_active)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

export const down = `DROP TABLE IF EXISTS coupons;`;
