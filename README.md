# Workforce Analytics — cPanel / MySQL Edition

## Requirements
- PHP 7.4+ (PHP 8+ recommended)
- MySQL 5.7+ or MariaDB 10.2+
- Apache mod_rewrite (enabled by default on cPanel)

## Security notes (read before deploying)

- **`config.php` is gitignored.** Copy `config.sample.php` → `config.php` and fill in
  your own credentials. Never commit the real file.
- **Authentication is client-side only** (`js/auth.js`). The user list and password
  hashes ship to the browser, so anyone can read and brute-force them offline. It
  gates the UI; it is **not** an access-control boundary. Move auth into `api.php`
  with `password_hash()` before putting real data behind it.
- **`api.php` sends `Access-Control-Allow-Origin: *`.** Restrict this to your own
  origin for a non-public deployment.
- The staff roster in `js/data.js` is **synthetic demo data**. Replace it with your
  own; don't commit a real roster to a public repo.

## Setup (5 steps)

### 1. Create a MySQL database in cPanel
- cPanel → **MySQL Databases**
- Create a database (e.g. `username_workforce`)
- Create a user and assign **ALL PRIVILEGES** on that database
- Note the database name, username, and password

### 2. Create config.php
Copy the sample and fill in your credentials:

```bash
cp config.sample.php config.php
```
```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'username_workforce');
define('DB_USER', 'username_wfuser');
define('DB_PASS', 'your_password');
```

### 3. Import the schema
- cPanel → **phpMyAdmin** → select your database
- Click **Import** → choose `db/schema.sql` → click **Go**

### 4. Upload files
Upload the entire `workforce-analytics/` folder via cPanel → **File Manager**
or FTP to `public_html/workforce-analytics/`

### 5. Verify and launch
Visit: `https://yourdomain.com/workforce-analytics/db/init.php`
Confirms connection and tables exist. **Delete init.php after confirming.**

Then open: `https://yourdomain.com/workforce-analytics/`

## File structure
```
workforce-analytics/
├── index.html
├── api.php          All REST API endpoints (MySQL)
├── config.sample.php  Template — copy to config.php (gitignored)
├── .htaccess        Routes /api/* to api.php
├── css/main.css
├── js/
│   ├── db.js        API client
│   ├── app.js
│   ├── data.js
│   ├── parse.js
│   ├── compute.js
│   ├── render-home.js
│   ├── render-analysis.js
│   ├── render-compare.js
│   ├── staff.js
│   ├── upload.js
│   └── settings.js
└── db/
    ├── schema.sql   Import this in phpMyAdmin
    └── init.php     Connection checker (delete after use)
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| 500 error on any page | Check `config.php` credentials |
| API calls return HTML | mod_rewrite not working — check `.htaccess` |
| "Table not found" | Import `db/schema.sql` in phpMyAdmin |
| `#1064` syntax error in phpMyAdmin | You imported the wrong schema — use the MySQL version |
| Blank app, no data | Open browser DevTools → Network → check `/api/weeks` response |
"# HR-Attendance-Visualization" 
