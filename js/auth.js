// auth.js — authentication module
// Passwords are SHA-256 hashed. To generate a hash: echo -n "yourpassword" | sha256sum
// Then add the user object to USER_DB below.

const USER_DB = [
  // DEMO ACCOUNTS - replace before any real deployment.
  //
  // SECURITY NOTE: this is client-side auth. The user list ships to the
  // browser, so anyone can read the hashes and brute-force them offline.
  // It gates the UI only; it is not a real access control boundary.
  // For anything sensitive, move authentication server-side (api.php) and
  // use a slow hash (password_hash / bcrypt / argon2).
  //
  // Generate a hash: echo -n "yourpassword" | sha256sum
  {
    username: 'admin@example.com',
    passwordHash: 'REPLACE_WITH_SHA256_HASH',
    role: 'admin',
    displayName: 'Administrator'
  },
  {
    username: 'viewer@example.com',
    passwordHash: 'REPLACE_WITH_SHA256_HASH',
    role: 'viewer',
    displayName: 'Viewer'
  }
];

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function authLogin(username, password) {
  const hash = await sha256(password);
  const user = USER_DB.find(u =>
    u.username === username.toLowerCase().trim() && u.passwordHash === hash
  );
  if (!user) return false;
  sessionStorage.setItem('wf_user', JSON.stringify({
    username: user.username,
    role: user.role,
    displayName: user.displayName
  }));
  return true;
}

function authLogout() {
  sessionStorage.removeItem('wf_user');
  window.location.href = 'login.html';
}

function authGetUser() {
  try { return JSON.parse(sessionStorage.getItem('wf_user')); } catch { return null; }
}

function authRequire() {
  const user = authGetUser();
  if (!user) { window.location.href = 'login.html'; return null; }
  return user;
}

function authIsAdmin() {
  const u = authGetUser();
  return u && u.role === 'admin';
}

// Call after DOM ready — hides [data-role="admin"] elements for non-admins,
// and fills in the nav user/role display.
function authApplyRoleUI() {
  const isAdmin = authIsAdmin();
  document.querySelectorAll('[data-role="admin"]').forEach(el => {
    el.style.display = isAdmin ? '' : 'none';
  });
  const u = authGetUser();
  const userEl = document.getElementById('nav-user');
  if (userEl && u) userEl.textContent = u.displayName;
  const roleEl = document.getElementById('nav-role');
  if (roleEl && u) {
    roleEl.textContent = u.role.toUpperCase();
    roleEl.className = 'nav-role-badge role-' + u.role;
  }
}
