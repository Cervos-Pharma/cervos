#!/usr/bin/env node
/**
 * Responsive audit for the Cervos *web* app (Next.js on :5000) — the web
 * sibling of scripts/check-pos-responsive.mjs.
 *
 * For every portal route it checks, at phone (390px) and desktop (1280px):
 *   - no horizontal overflow  (scrollWidth - clientWidth <= tolerance)
 *   - the permanent sidebar is visible at lg+, hidden below it
 *   - a hamburger exists below lg and actually opens the drawer
 *   - the route did not bounce to /auth (i.e. the role cookie worked)
 *
 * Usage:  node scripts/check-web-responsive.mjs [--base http://localhost:5000]
 * Requires a running mock-mode dev server (`npm run dev:mock`) and Chrome.
 * Mock sessions come from the `mock_user` cookie, set per route group.
 */
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import os from "node:os";

const CHROME =
  process.env.CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CDP_PORT = 9335;
const baseFlag = process.argv.indexOf("--base");
const BASE = baseFlag > -1 ? process.argv[baseFlag + 1] : "http://localhost:5000";
/** `--only <substring>` limits the sweep to matching routes (faster iteration). */
const onlyFlag = process.argv.indexOf("--only");
const ONLY = onlyFlag > -1 ? process.argv[onlyFlag + 1] : null;
/** `--dump` prints the raw measurement for every route it visits. */
const DUMP = process.argv.includes("--dump");
const PROFILE = `${os.tmpdir()}/cervos-web-audit-${Date.now()}`;

/** Portal routes grouped by the `mock_user` cookie they need. */
const GROUPS = {
  pharmacy: [
    "/dashboard",
    "/dashboard/inventory",
    "/dashboard/orders",
    "/dashboard/branches",
    "/dashboard/operators",
    "/dashboard/reports",
    "/dashboard/alerts",
    "/dashboard/billing",
    "/dashboard/marketplace",
    "/dashboard/network",
    "/dashboard/settings",
  ],
  supplier: [
    "/supplier",
    "/supplier/catalog",
    "/supplier/orders",
    "/supplier/storefront",
    "/supplier/analytics",
    "/supplier/connections",
    "/supplier/subscription",
    "/supplier/activity",
    "/supplier/alerts",
    "/supplier/settings",
  ],
  public: ["/", "/download", "/auth"],
};

const PHONE = { width: 390, height: 844, deviceScaleFactor: 2, mobile: true };
const DESKTOP = { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false };

const chrome = spawn(
  CHROME,
  [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${PROFILE}`,
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--window-size=1280,800",
    "about:blank",
  ],
  { stdio: "ignore" },
);

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
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });
} catch (e) {
  console.error("CDP failed:", String(e).slice(0, 150));
  chrome.kill();
  process.exit(1);
}

let msgId = 0;
const pending = new Map();
let consoleErrors = new Set();
let capturing = false;
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error" && capturing) {
    const text = (msg.params.args || [])
      .map((a) => a.value ?? a.description ?? "")
      .join(" ")
      .split("\n")[0]
      .slice(0, 120);
    if (text) consoleErrors.add(text);
  }
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
  const r = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300));
  return r.result.value;
}
async function navigate(url) {
  await send("Page.navigate", { url });
  await Promise.race([
    new Promise((res) => {
      const onMsg = (ev) => {
        if (JSON.parse(ev.data).method === "Page.loadEventFired") {
          ws.removeEventListener("message", onMsg);
          res();
        }
      };
      ws.addEventListener("message", onMsg);
    }),
    sleep(15000),
  ]);
  await sleep(400);
}

/** Reads layout facts off the current page. */
const PROBE = `(() => {
  // A portal "sidebar" is a fixed, full-height rail hugging the left edge.
  // (The marketing pages also have a fixed top nav — that is not a sidebar.)
  const fixeds = [...document.querySelectorAll('nav,aside')].filter((el) => {
    const r = el.getBoundingClientRect();
    const fullHeight = r.height > window.innerHeight * 0.8;
    const rail = r.width > 0 && r.width < window.innerWidth * 0.5;
    return getComputedStyle(el).position === 'fixed' && fullHeight && rail;
  });
  const burger = [...document.querySelectorAll('button')].find((b) =>
    /open navigation menu|toggle menu/i.test(b.getAttribute('aria-label') || '') ||
    ((b.className || '').includes('lg:hidden') && /menu/.test(b.textContent || '')),
  );
  // A left rail pinned to the viewport's left edge and spanning the full
  // height. Catches sidebars *and* non-responsive loading skeletons — a loader
  // aside is fixed but wider than the 50% rail heuristic above, so it used to
  // slip through unnoticed.
  const leftRails = [...document.querySelectorAll('nav,aside,div')].filter((el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return s.position === 'fixed' && r.height > window.innerHeight * 0.8 &&
      r.width >= 100 && r.x <= 2 && r.right > 0 && s.display !== 'none' &&
      s.visibility !== 'hidden';
  });
  // The scroll container that wraps a page's client component, e.g.
  // the shell, e.g. <div className="pt-16 flex-1 flex">. Its own width tells us
  // whether the flex item inside managed to shrink (min-w-0) or blew past the
  // viewport.
  const shell = document.querySelector('[class*="pt-16"]');
  const root = document.querySelector('[class*="max-w-[1"]');
  const doc = document.documentElement;
  const metrics = (el) =>
    el ? { cls: (el.className || '').toString().slice(0, 120), w: Math.round(el.getBoundingClientRect().width), sw: el.scrollWidth } : null;
  return JSON.stringify({
    path: location.pathname,
    heading: (document.querySelector('h1,h2') || {}).textContent || '',
    sidebarFixed: fixeds.length > 0,
    leftRails: leftRails.length,
    burger: burger ? burger.offsetParent !== null : false,
    overflow: doc.scrollWidth - doc.clientWidth,
    viewport: doc.clientWidth,
    shell: metrics(shell),
    root: metrics(root),
  });
})()`;

/**
 * Waits until the streamed page has stopped changing shape: two consecutive
 * identical readings 350ms apart, with the document fully loaded. Without this
 * the probe sometimes measured a suspended route (skeleton chrome still on
 * screen), which produced phantom overflow reports.
 */
async function waitForSettled(timeoutMs = 8000) {
  const started = Date.now();
  let last = null;
  let stable = 0;
  while (Date.now() - started < timeoutMs) {
    // The heading check matters: a suspended route has already fired `load`
    // while a skeleton is still on screen, and a skeleton is perfectly stable —
    // it would otherwise be measured (and pass) instead of the real page.
    const snap = await evalJs(
      `JSON.stringify([document.readyState, !!document.querySelector('h1,h2'), document.documentElement.scrollWidth])`,
    );
    stable = snap === last ? stable + 1 : 0;
    last = snap;
    if (stable >= 2 && /^\["complete",true/.test(snap)) return;
    await sleep(250);
  }
}

/**
 * Innermost elements that stick out past the viewport's right edge. Elements
 * inside a horizontally-scrollable ancestor are skipped — those are intended,
 * they do not make the *document* scroll.
 */
const OFFENDERS = `(() => {
  const doc = document.documentElement;
  const scrollable = (el) => {
    for (let p = el.parentElement; p && p !== doc.body; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') return true;
    }
    return false;
  };
  // Fixed overlays (the mock bar) reproduce the viewport's own width, so they
  // are symptoms, not causes.
  const overflowing = [...document.querySelectorAll('body *')].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.right > doc.clientWidth + 1 && !scrollable(el);
  });
  // Leaves = nothing inside them sticks out further, i.e. the actual culprit.
  const leaves = overflowing.filter(
    (el) => !overflowing.some((other) => other !== el && el.contains(other)),
  );
  const out = leaves
    .filter((el) => getComputedStyle(el).position !== 'fixed')
    .map((el) => {
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        cls: (el.className || '').toString().slice(0, 60),
        right: Math.round(r.right),
        text: (el.textContent || '').trim().slice(0, 24),
      };
    });
  out.sort((a, b) => b.right - a.right);
  return JSON.stringify(out.slice(0, 3));
})()`;

const OPEN_DRAWER = `(() => {
  const burger = [...document.querySelectorAll('button')].find((b) =>
    /open navigation menu|toggle menu/i.test(b.getAttribute('aria-label') || '') ||
    ((b.className || '').includes('lg:hidden') && /menu/.test(b.textContent || '')),
  );
  if (!burger) return JSON.stringify({ opened: false });
  burger.click();
  return JSON.stringify({ opened: true });
})()`;

const DRAWER_STATE = `(() => {
  const panel = [...document.querySelectorAll('div')].find((d) =>
    getComputedStyle(d).position === 'absolute' &&
    (d.className || '').includes('left-0') && (d.className || '').includes('w-64'),
  );
  const aside = document.querySelector('nav');
  const r = (panel || aside)?.getBoundingClientRect();
  return JSON.stringify({
    drawerX: r ? Math.round(r.x) : null,
    drawerVisible: r ? r.x >= -2 && r.right > 0 && r.width > 0 : false,
    backdrop: [...document.querySelectorAll('div')].some((d) => {
      const s = getComputedStyle(d);
      return s.position === 'fixed' && s.backgroundColor.startsWith('rgba(0, 0, 0');
    }),
  });
})()`;

await send("Page.enable");
await send("Runtime.enable");
await send("Network.enable");

const findings = [];
let matched = 0;
const record = (level, group, route, mode, detail) =>
  findings.push({ level, group, route, mode, detail });

async function setMode({ width, height, deviceScaleFactor, mobile }) {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor,
    mobile,
  });
}

for (const [group, routes] of Object.entries(GROUPS)) {
  // Public/marketing routes are checked as a signed-out visitor, otherwise
  // /auth would just bounce to the portal and never get measured.
  await send("Network.setCookie", {
    name: "mock_user",
    value: group === "public" ? "none" : group,
    url: BASE,
  });

  for (const rawRoute of routes) {
    if (ONLY && !rawRoute.toLowerCase().includes(ONLY.toLowerCase())) continue;
    matched++;
    const route = rawRoute;
    for (const [mode, metrics] of [
      ["phone", PHONE],
      ["desktop", DESKTOP],
    ]) {
      await setMode(metrics);
      await navigate(BASE + route);
      await waitForSettled();
      const probe = JSON.parse(await evalJs(PROBE));
      if (DUMP) record("info", group, route, mode, JSON.stringify(probe));

      if (probe.path !== route && !route.startsWith("/dashboard")) {
        record("warn", group, route, mode, `redirected to ${probe.path}`);
        continue;
      }
      const isPortal = group === "pharmacy" || group === "supplier";
      if (probe.overflow > 1) {
        const worst = JSON.parse(await evalJs(OFFENDERS))
          .map((o) => `${o.tag}(right=${o.right}).${o.cls}${o.text ? ` "${o.text}"` : ""}`)
          .join(" | ");
        const diag = `shell=${JSON.stringify(probe.shell)} root=${JSON.stringify(probe.root)}`;
        record(
          "FAIL",
          group,
          route,
          mode,
          `horizontal overflow ${probe.overflow}px (viewport ${probe.viewport}) → ${worst} || ${diag}`,
        );
      }
      // Public/marketing pages have no portal sidebar or drawer, so overflow is
      // the only layout rule that applies to them.
      if (!isPortal) continue;
      if (mode === "desktop" && !probe.sidebarFixed) {
        record("FAIL", group, route, mode, "no fixed sidebar at 1280px");
      }
      if (mode === "phone") {
        if (probe.sidebarFixed || probe.leftRails > 0) {
          record(
            "FAIL",
            group,
            route,
            mode,
            `fixed left rail still visible at 390px (${probe.leftRails} element(s))`,
          );
        }
        if (!probe.burger) {
          record("warn", group, route, mode, "no reachable hamburger");
          continue;
        }
        await evalJs(OPEN_DRAWER);
        await sleep(450);
        const drawer = JSON.parse(await evalJs(DRAWER_STATE));
        if (!drawer.drawerVisible || !drawer.backdrop) {
          record("FAIL", group, route, mode, `drawer did not open (${JSON.stringify(drawer)})`);
        }
        await evalJs(`document.querySelectorAll('div[aria-hidden]')[0]?.click(); 'ok'`);
        await sleep(200);
      }
    }
  }
}

// Console noise, reported once (not per route). Re-establish the pharmacy
// session first — the public group above left `mock_user=none` behind, which
// would bounce /dashboard to /auth and check the wrong page.
capturing = true;
await send("Network.setCookie", { name: "mock_user", value: "pharmacy", url: BASE });
await setMode(PHONE);
await navigate(`${BASE}/dashboard`);
await waitForSettled();
await sleep(1200);
capturing = false;
for (const err of consoleErrors) {
  record("warn", "pharmacy", "/dashboard", "phone", `console error: ${err}`);
}

// A filter that matches nothing must be loud: Git Bash rewrites a leading-slash
// argument (`--only /supplier/catalog`) into a Windows path, which silently
// matched zero routes and reported a vacuous pass.
if (ONLY && matched === 0) {
  console.error(`\nNo route matched --only "${ONLY}". Pass a substring without a leading slash.`);
  ws.close();
  chrome.kill();
  process.exit(2);
}

const fails = findings.filter((f) => f.level === "FAIL");
const warns = findings.filter((f) => f.level === "warn");
const infos = findings.filter((f) => f.level === "info");

const total = Object.values(GROUPS).flat().length;
console.log(`\nChecked ${matched} of ${total} routes × 2 widths`);
if (!fails.length && !warns.length) console.log("✅ no layout problems found");
if (DUMP) {
  for (const f of infos) console.log(`ℹ️  [${f.group}${f.route} @ ${f.mode}] ${f.detail}`);
}
for (const f of [...fails, ...warns]) {
  console.log(`${f.level === "FAIL" ? "❌" : "⚠️ "} [${f.group}${f.route} @ ${f.mode}] ${f.detail}`);
}
console.log(`\n${fails.length} failure(s), ${warns.length} warning(s)`);

ws.close();
chrome.kill();
process.exit(fails.length ? 1 : 0);
