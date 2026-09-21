#!/usr/bin/env node
/**
 * One-off: seed the POS app's local sql.js DB (same shape as its migrations),
 * inject it into the running vite app's localStorage over CDP, sign in via the
 * real PIN flow, then probe the responsive layout at desktop + phone widths.
 */
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const POS = path.join(ROOT, "cervos-desktop");
const require2 = createRequire(path.join(POS, "package.json"));

// ---- 1. Build the seeded DB ------------------------------------------------
const initSqlJs = require2("sql.js");
const SQL = await initSqlJs();
const db = new SQL.Database();

const BRANCH = "branch-seed-001";
const now = new Date().toISOString();
const pin = "1234";
const pinHash = createHash("sha256").update(pin).digest("hex");

db.run(`
  CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT);
  CREATE TABLE branches (
    id TEXT PRIMARY KEY, account_id TEXT, name TEXT NOT NULL, lat REAL, lng REAL,
    subscription_status TEXT DEFAULT 'trial', subscription_tier TEXT DEFAULT 'free',
    trial_ends_at TEXT, payment_due_at TEXT, grace_ends_at TEXT,
    last_synced_at TEXT, updated_at TEXT
  );
  CREATE TABLE operators (
    id TEXT PRIMARY KEY, branch_id TEXT, name TEXT NOT NULL,
    pin_hash TEXT, role TEXT DEFAULT 'operator', created_at TEXT
  );
  CREATE TABLE products (
    id TEXT PRIMARY KEY, generic_name TEXT NOT NULL, brand_name TEXT, category TEXT,
    formulation TEXT, requires_prescription INTEGER DEFAULT 0, barcode TEXT,
    updated_at TEXT, default_expiry TEXT, default_cost_price REAL,
    default_sale_price REAL, low_stock_threshold INTEGER DEFAULT 10,
    notify_threshold INTEGER DEFAULT 5
  );
  CREATE TABLE batches (
    id TEXT PRIMARY KEY, branch_id TEXT, product_id TEXT NOT NULL, batch_number TEXT,
    quantity INTEGER DEFAULT 0, cost_price REAL DEFAULT 0, sale_price REAL DEFAULT 0,
    expiry_date TEXT, sync_version INTEGER DEFAULT 1, updated_at TEXT
  );
`);
for (const [k, v] of [
  ["branch_id", JSON.stringify(BRANCH)],
  ["centre_name", JSON.stringify("Uhuru Pharmacy — Ilala")],
  ["centre_address", JSON.stringify("Ilala, Dar es Salaam")],
  ["pharmacy_name", JSON.stringify("Uhuru Pharmacy")],
  ["account_name", JSON.stringify("Uhuru Pharmacy")],
  ["tax_rate", JSON.stringify("0")],
]) {
  db.run("INSERT INTO app_settings (key, value) VALUES (?, ?)", [k, v]);
}
db.run("INSERT INTO branches (id, name, subscription_status, subscription_tier) VALUES (?,?,?,?)",
  [BRANCH, "Uhuru Pharmacy — Ilala", "active", "free"]);
db.run("INSERT INTO operators (id, branch_id, name, pin_hash, role, created_at) VALUES (?,?,?,?,?,?)",
  ["op-seed-admin-001", BRANCH, "Asha Mwinyi", pinHash, "admin", now]);

const products = [
  ["prod-001", "Paracetamol", "Panadol", "500mg tablets", "PAN-500", "1234567890123", 500, 1500, 40, "2027-06-30"],
  ["prod-002", "Amoxicillin", "Amoxil", "250mg capsules", "AMX-250", "1234567890456", 900, 2500, 60, "2027-01-15"],
  ["prod-003", "Oral Rehydration Salts", "ORS-Zinc", "sachets", "ORS-20", "1234567890789", 300, 800, 200, "2026-10-05"],
];
products.forEach(([id, gen, brand, form, _n, barcode, cost, sale, qty, exp], i) => {
  db.run(
    "INSERT INTO products (id, generic_name, brand_name, formulation, barcode, default_cost_price, default_sale_price) VALUES (?,?,?,?,?,?,?)",
    [id, gen, brand, form, barcode, cost, sale]
  );
  db.run(
    "INSERT INTO batches (id, branch_id, product_id, batch_number, quantity, cost_price, sale_price, expiry_date) VALUES (?,?,?,?,?,?,?,?)",
    [`batch-00${i + 1}`, BRANCH, id, `BX-10${i}${i + 1}A`, qty, cost, sale, exp]
  );
});

const seedB64 = Buffer.from(db.export()).toString("base64");
console.log(`seed built: ${seedB64.length} chars`);

// ---- 2. CDP plumbing --------------------------------------------------------
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CDP_PORT = 9334;
const BASE = "http://localhost:1420";
const PROFILE = `${os.tmpdir()}/cervos-pos-seed-${Date.now()}`;

const chrome = spawn(CHROME, [
  `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${PROFILE}`,
  "--headless=new", "--no-first-run", "--no-default-browser-check",
  "--disable-gpu", "--window-size=1280,800", "about:blank",
], { stdio: "ignore" });

let ws;
try {
  let list = null;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
      list = await res.json();
      if (list.length) break;
    } catch {}
    await sleep(250);
  }
  const page = list.find((t) => t.type === "page");
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
} catch (e) {
  console.error("CDP failed:", String(e).slice(0, 150));
  chrome.kill();
  process.exit(1);
}

let msgId = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
  }
};
const send = (method, params = {}) => {
  const id = ++msgId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
};
async function evalJs(expression) {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400));
  return r.result.value;
}
async function navigate(url) {
  await send("Page.navigate", { url });
  await Promise.race([
    new Promise((res) => {
      const onMsg = (ev) => { if (JSON.parse(ev.data).method === "Page.loadEventFired") { ws.removeEventListener("message", onMsg); res(); } };
      ws.addEventListener("message", onMsg);
    }),
    sleep(15000),
  ]);
  await sleep(1200);
}
await send("Page.enable");

// ---- 3. Inject seed + land on login ----------------------------------------
await navigate(BASE + "/");
await evalJs(`localStorage.setItem('cervos_db', ${JSON.stringify(seedB64)}); localStorage.removeItem('cervos-auth'); 'seeded'`);
await navigate(BASE + "/");
await sleep(1500); // allow onboarding check → redirect to /login
const where = await evalJs("location.pathname + ' | ' + document.body.innerText.slice(0, 80).replace(/\\n/g, ' ')");
console.log("after seed:", where);

// ---- 4. Sign in via the real PIN flow ---------------------------------------
await evalJs(`(() => {
  const adminTab = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Admin'));
  if (adminTab) adminTab.click();
  return !!adminTab;
})()`);
await sleep(800);
const selResult = await evalJs(`(() => {
  const sel = document.querySelector('select');
  if (!sel) return 'NO_SELECT';
  const opt = [...sel.options].find(o => o.value);
  if (!opt) return 'NO_OPTION';
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
  setter.call(sel, opt.value);
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  return 'selected:' + opt.textContent;
})()`);
console.log("operator:", selResult);
await sleep(400);
await evalJs(`(() => {
  const input = document.querySelector('input[type="password"]');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(input, '1234');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`);
await sleep(300);
await evalJs(`(() => { const b = [...document.querySelectorAll('button[type="submit"]')].find(b => b.textContent.includes('Sign In as Admin')); if (b) b.click(); return !!b; })()`);
await sleep(2500);
console.log("after login:", await evalJs("location.pathname + ' | sidebar=' + !!(document.querySelector('aside') || document.querySelector('[class*=w-56]'))"));

// ---- 5. Layout probes --------------------------------------------------------
const PROBE = `(() => {
  const aside = document.querySelector('aside') || document.querySelector('[class*="w-56"]');
  const sb = aside ? aside.getBoundingClientRect() : null;
  const burger = [...document.querySelectorAll('button')].find(b => (b.className||'').includes('lg:hidden'));
  return JSON.stringify({
    path: location.pathname,
    sidebar: sb ? { x: Math.round(sb.x), w: Math.round(sb.width) } : null,
    burgerVisible: burger ? burger.offsetParent !== null : false,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  });
})()`;

await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
await sleep(400);
console.log("DESKTOP 1280:", await evalJs(PROBE));

await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await sleep(400);
console.log("PHONE  390: ", await evalJs(PROBE));

// drawer open
await evalJs(`(() => { const b = [...document.querySelectorAll('button')].find(b => (b.className||'').includes('lg:hidden')); if (b) b.click(); return !!b; })()`);
await sleep(600);
console.log("PHONE open:  ", await evalJs(`(() => {
  const aside = document.querySelector('aside') || document.querySelector('[class*="w-56"]');
  const sb = aside ? aside.getBoundingClientRect() : null;
  const backdrop = [...document.querySelectorAll('div')].some(d => {
    const s = getComputedStyle(d);
    return s.position === 'fixed' && s.backgroundColor.startsWith('rgba(0, 0, 0');
  });
  return JSON.stringify({ drawerX: sb ? Math.round(sb.x) : null, backdrop });
})()`));

// POS page at phone width
await navigate(BASE + "/pos");
console.log("POS phone:   ", await evalJs(PROBE));

ws.close();
chrome.kill();
console.log("done");
