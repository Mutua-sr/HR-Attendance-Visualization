<?php
/**
 * config.php - Database credentials for Workforce Analytics
 *
 * Copy config.sample.php to config.php and fill in your own values.
 * Find these in cPanel -> MySQL Databases.
 *
 * IMPORTANT: config.php is gitignored. Never commit real credentials.
 */

define('DB_HOST', 'localhost');            // Usually 'localhost' on cPanel
define('DB_NAME', 'CHANGE_ME_DB_NAME');    // e.g. cpaneluser_workforce
define('DB_USER', 'CHANGE_ME_DB_USER');    // e.g. cpaneluser_wfuser
define('DB_PASS', 'CHANGE_ME_DB_PASSWORD');
define('DB_CHARSET', 'utf8mb4');
