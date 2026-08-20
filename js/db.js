// db.js — API client for XAMPP/PHP backend
// Routes are handled by api.php via .htaccess PATH_INFO rewrite.
// Function signatures are identical to the IndexedDB version so the
// rest of the app is completely unchanged.

const API = 'api.php';

async function apiFetch(path, opts = {}) {
  // Map /weeks/id → api.php?path=/weeks/id
  const url = `${API}?path=${encodeURIComponent(path)}`;
  const res  = await fetch(url, {
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API ${path} → ${res.status}: ${err}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ── Week operations ────────────────────────────────────────────────────
async function loadWeeks() {
  allWeeks = (await apiFetch('/weeks')) || [];
  allWeeks.sort((a, b) => a.id.localeCompare(b.id));
}

async function dbPut(store, val) {
  if (store === 'weeks') {
    await apiFetch('/weeks/' + encodeURIComponent(val.id), {
      method: 'PUT',
      body:   JSON.stringify(val),
    });
    const idx = allWeeks.findIndex(w => w.id === val.id);
    if (idx >= 0) allWeeks[idx] = val; else allWeeks.push(val);
    allWeeks.sort((a, b) => a.id.localeCompare(b.id));
    return;
  }
  if (store === 'settings') {
    await apiFetch('/settings', { method: 'PUT', body: JSON.stringify(val) });
    return;
  }
  if (store === 'staff_register') {
    await apiFetch('/staff', { method: 'PUT', body: JSON.stringify(val) });
    return;
  }
}

async function dbDelete(store, key) {
  if (store === 'weeks')
    await apiFetch('/weeks/' + encodeURIComponent(key), { method: 'DELETE' });
}

async function dbClear(store) {
  if (store === 'weeks')
    await apiFetch('/weeks', { method: 'DELETE' });
}

async function dbGet(store, key) {
  try {
    if (store === 'settings')      return await apiFetch('/settings');
    if (store === 'staff_register') return await apiFetch('/staff');
  } catch (e) { return null; }
  return null;
}

async function dbGetAll(store) {
  if (store === 'weeks') return (await apiFetch('/weeks')) || [];
  return [];
}

// ── Stubs kept for compatibility ───────────────────────────────────────
let db = null;
function openDB() { return Promise.resolve(); }
