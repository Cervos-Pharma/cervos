#!/usr/bin/env node
/** One-off: verify POS app (cervos-desktop) responsive layout via CDP. */
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import os from "node:os";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CDP_PORT = 9334;
const BASE = "http://localhost:1420";
const PROFILE = `${os.tmpdir()}/cervos-pos-audit-${Date.now()}`;

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
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300));
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
  await sleep(900);
}
await send("Page.enable");

const PROBE = `(() => {
  const aside = document.querySelector('aside') || document.querySelector('[class*="w-56"]');
  const burger = [...document.querySelectorAll('button')].find(b => (b.className||'').includes('lg:hidden'));
  const sb = aside ? aside.getBoundingClientRect() : null;
  return JSON.stringify({
    path: location.pathname,
    heading: (document.querySelector('h1,h2') || {}).textContent || '',
    sidebar: sb ? { x: Math.round(sb.x), w: Math.round(sb.width), visible: sb.width > 0 && sb.right > 0 } : null,
    burgerVisible: burger ? burger.offsetParent !== null : false,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  });
})()`;

// --- Desktop pass (1280px): permanent sidebar expected
await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
await navigate(BASE + "/");
console.log("DESKTOP 1280:", await evalJs(PROBE));

// --- Phone pass (390px): sidebar off-screen, hamburger visible
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await navigate(BASE + "/");
console.log("PHONE  390: ", await evalJs(PROBE));

// --- Open the drawer by clicking the hamburger
await evalJs(`(() => { const b = [...document.querySelectorAll('button')].find(b => (b.className||'').includes('lg:hidden')); if (b) b.click(); return !!b; })()`);
await sleep(500);
console.log("PHONE open: ", await evalJs(`(() => {
  const aside = document.querySelector('aside') || document.querySelector('[class*="w-56"]');
  const sb = aside ? aside.getBoundingClientRect() : null;
  const backdrop = [...document.querySelectorAll('div')].some(d => {
    const s = getComputedStyle(d);
    return s.position === 'fixed' && s.backgroundColor.includes('rgba(0, 0, 0');
  });
  return JSON.stringify({ sidebarX: sb ? Math.round(sb.x) : null, backdrop });
})()`));

ws.close();
chrome.kill();
console.log("done");
