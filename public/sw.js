/**
 * @file public/sw.js
 * @description Service worker for the Cervos PWA — offline app-shell support.
 *
 * Served verbatim from `/sw.js` (public/ files are static), so this file is
 * NOT processed by the bundler: plain JavaScript only, no imports, no JSX.
 *
 * ─── Caching strategy ───────────────────────────────────────────────────────
 *   navigations      network-first  → cached copy → embedded offline page
 *   _next/static/*   cache-first    (content-hashed, therefore immutable)
 *   fonts / images   stale-while-revalidate (polish in background, never block)
 *   /api/*           network-only   (auth/session responses must never be
 *                                    persisted to disk)
 *
 * Everything cross-origin is passed straight through — notably the Supabase
 * host, which the web app talks to directly. Caching it would risk persisting
 * access tokens.
 *
 * Bump CACHE_VERSION whenever a precached entry changes so old copies are
 * dropped on activate.
 */
const CACHE_VERSION = "v2";
const CACHE_NAME = `cervos-shell-${CACHE_VERSION}`;

/** App shells and launch routes cached on install so offline boots open the real workspace UI. */
const PRECACHE_URLS = ["/", "/app", "/app/gate"];

/**
 * Routes that must never be served from cache.
 * `/api/` covers our own route handlers; `supabase` covers direct DB calls.
 */
function isNeverCacheable(url) {
  return url.pathname.startsWith("/api/") || url.hostname.includes("supabase");
}

/** Content-hashed build output — safe to keep forever. */
function isImmutableAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/fonts/") ||
    /\.(?:woff2?|ttf|otf|png|jpg|jpeg|svg|webp|ico)$/i.test(url.pathname)
  );
}

/**
 * Self-contained offline fallback. Inlined rather than precached as a route so
 * it renders even if its own hashed CSS/JS was never downloaded — a half-cached
 * Next.js page would paint unstyled or blank, which is exactly the moment a
 * user needs the UI most.
 */
const OFFLINE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Offline — Cervos</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         background:#fcf8ff; color:#1a1a2e; font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; padding:24px; }
  main { max-width:26rem; text-align:center; }
  .icon { width:64px; height:64px; margin:0 auto 20px; border-radius:16px; display:block; }
  h1 { font-size:1.35rem; margin:0 0 8px; }
  p { margin:0 0 6px; color:#444654; font-size:.95rem; line-height:1.5; }
  .hint { font-size:.85rem; color:#6B7280; margin-top:18px; }
  button { margin-top:20px; padding:11px 22px; font-size:.95rem; font-weight:600; color:#fff;
           background:#1039b9; border:0; border-radius:10px; cursor:pointer; }
  button:active { opacity:.9; }
</style>
</head>
<body>
<main>
  <img class="icon" src="/icon-192x192.png" alt="" width="64" height="64">
  <h1>You're offline</h1>
  <p>Cervos can't reach the server right now.</p>
  <p>Sales and stock changes you make are saved on this device and will sync automatically when the connection returns.</p>
  <button onclick="location.reload()">Try again</button>
  <p class="hint">No connection — this page is shown from the device cache.</p>
</main>
</body>
</html>`;

function offlineResponse() {
  return new Response(OFFLINE_HTML, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // addAll fails the whole install if any single URL 404s, so add
      // individually — a missing route must not block the worker entirely.
      await Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)));
      // The offline page is served from this embedded copy, not the network.
      await cache.put("/offline", offlineResponse());
      // Controls when a newly-installed worker takes over. Without this the
      // user keeps the old worker until every tab is closed.
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      // Drop every cache from a previous CACHE_VERSION.
      await Promise.all(
        names
          .filter((name) => name.startsWith("cervos-shell-") && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Cross-origin (Supabase, CDNs) and anything sensitive is network-only.
  if (url.origin !== self.location.origin || isNeverCacheable(url)) return;

  // Navigations: network-first so users always get fresh HTML when online,
  // then the last good copy, then the embedded offline page.
  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isImmutableAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

async function networkFirstNavigation(request) {
  try {
    const fresh = await fetch(request);
    if (fresh.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch {
    const cached = await caches.match(request);
    // The document may have been cached under a rewritten URL (trailing
    // slash / query string), so fall back to the cached root copy.
    if (cached) return cached;
    const root = await caches.match("/");
    if (root) return root;
    return offlineResponse();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    if (fresh.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch {
    // Immutable assets have no meaningful fallback; surface the real error.
    return Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) {
        return caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
      }
      return response;
    })
    // Background refresh failing is normal offline — never reject the outer
    // promise, or the caller would see an error despite having a cached copy.
    .catch(() => null);

  if (cached) {
    await network;
    return cached;
  }
  const fresh = await network;
  if (fresh) return fresh;
  return Response.error();
}
