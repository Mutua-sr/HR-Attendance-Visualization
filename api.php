<?php
/**
 * api.php — Workforce Analytics REST API (cPanel / PHP + MySQL)
 *
 * All requests arrive as: api.php?path=/resource[/id]
 * .htaccess rewrites /api/weeks → api.php?path=/weeks
 *
 * Requirements: PHP 7.4+, PDO with pdo_mysql (standard on cPanel)
 */

require_once __DIR__ . '/config.php';

// ── Headers ───────────────────────────────────────────────────────────
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, PUT, DELETE, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204); exit;
}

// ── Database connection (MySQL via PDO) ───────────────────────────────
function getDb() {
    static $db = null;
    if ($db) return $db;
    $dsn = 'mysql:host=' . DB_HOST
         . ';dbname=' . DB_NAME
         . ';charset=' . DB_CHARSET;
    $db = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
    return $db;
}

// ── Helpers ───────────────────────────────────────────────────────────
function respond($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
function respondError($msg, $code = 400) {
    respond(['error' => $msg], $code);
}
function parseWeek($row) {
    $row['data']       = json_decode($row['data']       ?? '{}', true) ?: [];
    $row['exclusions'] = json_decode($row['exclusions'] ?? '[]', true) ?: [];
    if (isset($row['sched_days']))  { $row['schedDays']  = (int)$row['sched_days'];  unset($row['sched_days']); }
    if (isset($row['created_at']))  { $row['createdAt']  = $row['created_at'];  unset($row['created_at']); }
    return $row;
}
// PHP 7 compat: replace str_starts_with
function startsWith($str, $prefix) {
    return strpos($str, $prefix) === 0;
}

// ── Route ─────────────────────────────────────────────────────────────
$method   = $_SERVER['REQUEST_METHOD'];
$path     = trim($_GET['path'] ?? '/', '/');
$parts    = explode('/', $path);
$resource = $parts[0] ?? '';
$id       = isset($parts[1]) && $parts[1] !== '' ? urldecode($parts[1]) : null;

$body = [];
if (in_array($method, ['PUT', 'POST'])) {
    $raw  = file_get_contents('php://input');
    $body = $raw ? (json_decode($raw, true) ?? []) : [];
}

try {
    $db = getDb();

    // ── /api/weeks ──────────────────────────────────────────────────
    if ($resource === 'weeks') {

        if ($method === 'GET' && !$id) {
            $rows = $db->query(
                "SELECT id, label, dates, sched_days, created_at, data, exclusions
                 FROM weeks ORDER BY created_at ASC"
            )->fetchAll();
            respond(array_map('parseWeek', $rows));
        }

        if ($method === 'GET' && $id) {
            $stmt = $db->prepare("SELECT * FROM weeks WHERE id=?");
            $stmt->execute([$id]);
            $row = $stmt->fetch();
            if (!$row) respondError('Week not found', 404);
            respond(parseWeek($row));
        }

        if ($method === 'PUT' && $id) {
            $label      = $body['label']      ?? $id;
            $dates      = $body['dates']      ?? '';
            $schedDays  = (int)($body['schedDays'] ?? $body['sched_days'] ?? 5);
            $data       = json_encode($body['data']       ?? [], JSON_UNESCAPED_UNICODE);
            $exclusions = json_encode($body['exclusions'] ?? [], JSON_UNESCAPED_UNICODE);
            $createdAt  = $body['createdAt']  ?? $body['created_at'] ?? date('Y-m-d H:i:s');

            // MySQL: INSERT ... ON DUPLICATE KEY UPDATE (replaces SQLite ON CONFLICT)
            $db->prepare(
                "INSERT INTO weeks (id, label, dates, sched_days, data, exclusions, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                   label=VALUES(label), dates=VALUES(dates),
                   sched_days=VALUES(sched_days), data=VALUES(data),
                   exclusions=VALUES(exclusions)"
            )->execute([$id, $label, $dates, $schedDays, $data, $exclusions, $createdAt]);
            respond(['ok' => true]);
        }

        if ($method === 'DELETE' && $id) {
            $db->prepare("DELETE FROM weeks WHERE id=?")->execute([$id]);
            respond(['ok' => true]);
        }

        if ($method === 'DELETE' && !$id) {
            $db->exec("DELETE FROM weeks");
            respond(['ok' => true]);
        }

        respondError('Method not allowed', 405);
    }

    // ── /api/settings ────────────────────────────────────────────────
    if ($resource === 'settings') {
        if ($method === 'GET') {
            $row = $db->query("SELECT `key`, value FROM settings WHERE `key`='thresholds'")->fetch();
            if (!$row) respond(null);
            respond(['key' => $row['key'], 'value' => json_decode($row['value'], true)]);
        }
        if ($method === 'PUT') {
            $key   = $body['key']   ?? 'thresholds';
            $value = json_encode($body['value'] ?? $body, JSON_UNESCAPED_UNICODE);
            $db->prepare(
                "INSERT INTO settings (`key`, value) VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE value=VALUES(value)"
            )->execute([$key, $value]);
            respond(['ok' => true]);
        }
        respondError('Method not allowed', 405);
    }

    // ── /api/staff ───────────────────────────────────────────────────
    if ($resource === 'staff') {
        if ($method === 'GET') {
            $row = $db->query("SELECT `key`, value FROM staff_register WHERE `key`='list'")->fetch();
            if (!$row) respond(null);
            respond(['key' => $row['key'], 'value' => json_decode($row['value'], true)]);
        }
        if ($method === 'PUT') {
            $key   = $body['key']   ?? 'list';
            $value = json_encode($body['value'] ?? [], JSON_UNESCAPED_UNICODE);
            $db->prepare(
                "INSERT INTO staff_register (`key`, value) VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE value=VALUES(value)"
            )->execute([$key, $value]);
            respond(['ok' => true]);
        }
        respondError('Method not allowed', 405);
    }

    // ── /api/backup ──────────────────────────────────────────────────
    if ($resource === 'backup' && $method === 'GET') {
        $weeks = array_map('parseWeek', $db->query("SELECT * FROM weeks")->fetchAll());
        $settings = [];
        foreach ($db->query("SELECT `key`, value FROM settings")->fetchAll() as $r) {
            $settings[$r['key']] = json_decode($r['value'], true);
        }
        $staff = $db->query("SELECT value FROM staff_register WHERE `key`='list'")->fetch();
        respond([
            'version'    => 2,
            'exportedAt' => date('c'),
            'weeks'      => $weeks,
            'settings'   => $settings,
            'staffList'  => $staff ? json_decode($staff['value'], true) : [],
        ]);
    }

    // ── /api/restore ─────────────────────────────────────────────────
    if ($resource === 'restore' && $method === 'POST') {
        $weeks     = $body['weeks']     ?? [];
        $settings  = $body['settings']  ?? [];
        $staffList = $body['staffList'] ?? [];

        $db->beginTransaction();
        try {
            $putWeek = $db->prepare(
                "INSERT INTO weeks (id,label,dates,sched_days,data,exclusions,created_at)
                 VALUES (?,?,?,?,?,?,?)
                 ON DUPLICATE KEY UPDATE
                   label=VALUES(label), dates=VALUES(dates),
                   sched_days=VALUES(sched_days), data=VALUES(data),
                   exclusions=VALUES(exclusions)"
            );
            foreach ($weeks as $w) {
                $putWeek->execute([
                    $w['id'],
                    $w['label'] ?? $w['id'],
                    $w['dates'] ?? '',
                    (int)($w['schedDays'] ?? $w['sched_days'] ?? 5),
                    json_encode($w['data']       ?? [], JSON_UNESCAPED_UNICODE),
                    json_encode($w['exclusions'] ?? [], JSON_UNESCAPED_UNICODE),
                    $w['createdAt'] ?? $w['created_at'] ?? date('Y-m-d H:i:s'),
                ]);
            }
            foreach ($settings as $key => $value) {
                $db->prepare(
                    "INSERT INTO settings (`key`,value) VALUES (?,?)
                     ON DUPLICATE KEY UPDATE value=VALUES(value)"
                )->execute([$key, json_encode($value, JSON_UNESCAPED_UNICODE)]);
            }
            if (!empty($staffList)) {
                $db->prepare(
                    "INSERT INTO staff_register (`key`,value) VALUES ('list',?)
                     ON DUPLICATE KEY UPDATE value=VALUES(value)"
                )->execute([json_encode($staffList, JSON_UNESCAPED_UNICODE)]);
            }
            $db->commit();
            respond(['ok' => true, 'weeksRestored' => count($weeks)]);
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }

    respondError("Unknown route: /$resource", 404);

} catch (Exception $e) {
    respondError($e->getMessage(), 500);
}
