-- schema.sql — Workforce Analytics (MySQL / MariaDB)
-- Import via cPanel → phpMyAdmin → your database → Import tab
-- Requires MySQL 5.7+ or MariaDB 10.2+

SET NAMES utf8mb4;

-- ── Weeks ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `weeks` (
  `id`          VARCHAR(64)   NOT NULL,
  `label`       VARCHAR(128)  NOT NULL,
  `dates`       VARCHAR(128)  NOT NULL DEFAULT '',
  `sched_days`  TINYINT       NOT NULL DEFAULT 5,
  `created_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `data`        LONGTEXT      NOT NULL,
  `exclusions`  LONGTEXT      NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_label`      (`label`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Settings ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `settings` (
  `key`   VARCHAR(64)  NOT NULL,
  `value` LONGTEXT     NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed defaults (ignored if row already exists)
INSERT IGNORE INTO `settings` (`key`, `value`) VALUES (
  'thresholds',
  '{"full":100,"good":80,"mod":60,"schedMins":{"Head Office":600,"Plant Office":570,"Region A Sites":540,"Region B Sites":540,"Overseas Site":600,"Hybrid":600,"_default":600}}'
);

-- ── Staff register ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `staff_register` (
  `key`   VARCHAR(64)  NOT NULL,
  `value` LONGTEXT     NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
