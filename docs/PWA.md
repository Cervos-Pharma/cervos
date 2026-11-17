# Progressive Web App (PWA)

Cervos' web app is installable and works offline. This matters most for
**iPhone users**: the Tauri endpoint (`cervos-desktop/`) cannot be installed
on iOS, so Safari + Add to Home Screen is how pharmacists get Cervos on an
iPhone.

---

## 1. What was added

| File | Purpose |
|---|---|
| `src/app/manifest.ts` | Web App Manifest → served at `/manifest.webmanifest`. Next.js injects the `<link rel="manifest">` automatically — **do not add that link by hand**. |
| `public/sw.js` | Service worker: offline app-shell caching. |
| `src/components/PwaRegister.tsx` | Registers the worker, offers a reload when a new version lands, shows the iOS install hint. Rendered once from the root layout. |
| `public/icon-192x192.png` | Android/Chrome install icon |
| `public/icon-512x512.png` | Android splash + install icon |
| `public/icon-maskable-512.png` | Android adaptive icon (logo inset to 80% so the system mask can't clip it) |
| `public/apple-touch-icon.png` | iOS home-screen icon, 180×180, **no transparency** (iOS composites transparent PNGs onto black) |
| `scripts/generate-pwa-icons.mjs` | Regenerates the four icons from `public/logo.png` |

### Metadata in `src/app/layout.tsx`

```ts
export const viewport: Viewport = {
  themeColor: "#1039b9",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};
```

> ⚠️ **`themeColor` belongs on `viewport`, not `metadata`.** The
> `metadata.themeColor` option was **deprecated in Next.js 14** and warns if
> used. Same for `colorScheme`.

```ts
appleWebApp: { capable: true, title: "Cervos", statusBarStyle: "default" },
other: { "apple-mobile-web-app-capable": "yes" },
```

> ⚠️ Next.js emits only the **standard** `mobile-web-app-capable`. It never
> emits Apple's `apple-mobile-web-app-capable`, which older iOS needs for
> standalone display — hence the `other` entry. **Don't remove it**, or older
> iPhones will open in Safari's chrome instead of full-screen.

---

## 2. Service worker caching strategy

| Request type | Strategy | Why |
|---|---|---|
| Navigations (`mode: navigate`) | **network-first** → cached copy → embedded offline page | Users always get fresh HTML when online |
| `/_next/static/*`, fonts, images | **cache-first** | Content-hashed, therefore immutable |
| Everything else same-origin | **stale-while-revalidate** | Never block on a background refresh |
| `/api/*`, any `supabase` host | **network-only** | Auth/session responses must never be written to disk |
| Cross-origin (anything) | passthrough | Same reason |

**Never cache:** every cross-origin request is skipped, notably the Supabase
host — caching it could persist access tokens.

### Offline fallback

The offline page is **inlined in `sw.js`**, not precached as a route. A
half-cached Next.js page can paint unstyled or blank (its hashed CSS/JS was
never downloaded) — exactly when the user needs the UI most. The embedded
version is self-contained and always renders.

It tells the user what matters: *sales and stock changes are saved on this
device and will sync automatically when the connection returns.*

### Updating

- `CACHE_VERSION` in `sw.js` is bumped whenever a precached entry changes;
  old caches are dropped on `activate`.
- `skipWaiting()` + `clients.claim()` take over immediately, and
  `PwaRegister` shows a **"New version ready → Reload"** toast on
  `controllerchange`, so the page never keeps running old assets against a
  new worker.
- `/sw.js` is served with `Cache-Control: no-cache, no-store, must-revalidate`
  and `Service-Worker-Allowed: /` (see `next.config.ts`). Without this, browsers
  keep a stale worker for up to 24h after a deploy.

---

## 3. iOS specifics

iOS ignores the manifest entirely. It relies on:

1. `<link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180">`
2. `apple-mobile-web-app-capable` / `-title` / `-status-bar-style` metadata

Safari fires **no `beforeinstallprompt` event**, so there is no way to show an
automatic install button on iPhone. `PwaRegister` instead shows a dismissible
hint (once per session, only when not already installed):

> Tap the **Share** button in Safari, then choose **Add to Home Screen**.

iPadOS 13+ reports a desktop user-agent, so `isIOS()` also probes
`platform === 'MacIntel' && maxTouchPoints > 1`.

`viewportFit: "cover"` + `statusBarStyle: "default"` keep the status bar
readable over the app's light (`#fcf8ff`) background.

---

## 4. Regenerating icons

The four PNGs are **committed**, so nothing needs re-running unless the source
logo changes:

```bash
npm run pwa:icons        # node scripts/generate-pwa-icons.mjs
```

Requires `sharp`. It is currently a transitive dependency; if it ever goes
missing: `npm i -D sharp`.

Sizes are verified after generation — re-check with:

```powershell
foreach ($f in 'icon-192x192.png','icon-512x512.png','apple-touch-icon.png','icon-maskable-512.png') {
  $b = [System.IO.File]::ReadAllBytes("public\$f")
  "{0} -> {1}x{2}" -f $f, [BitConverter]::ToUInt32($b[19..16],0), [BitConverter]::ToUInt32($b[23..20],0)
}
```

Expected: `192x192`, `512x512`, `180x180`, `512x512`.

---

## 5. Verifying a deployment

```bash
npm run build && npm run start
```

Then check:

| Check | Expected |
|---|---|
| `GET /manifest.webmanifest` | `200`, `Content-Type: application/manifest+json` |
| `GET /sw.js` | `200`, `application/javascript`, `Cache-Control: no-cache`, `Service-Worker-Allowed: /` |
| `GET /icon-192x192.png` | `200`, `image/png` |
| `GET /` source | contains `rel="manifest"`, `apple-touch-icon`, `mobile-web-app-capable`, `apple-mobile-web-app-capable`, `theme-color` |
| Devtools → Application → Service Workers | `activated` |
| Devtools → Application → Manifest | name, icons, `display: standalone` all valid |
| Network offline → reload | offline fallback page, not a browser error |

### Install test on iPhone

1. Open the deployed URL in Safari.
2. Share → **Add to Home Screen**.
3. Launch from the home screen — it should open full-screen (no Safari
   address bar) with the Cervos icon.

---

## 6. Gotchas

- **`NEXT_PUBLIC_*` is inlined at build time.** Changing one requires a rebuild.
- **Service worker only registers in production.** In dev,
  `PwaRegister` returns early — a worker would cache dev-server output and
  break hot reload.
- **`metadataBase`** must be set (it is, from `NEXT_PUBLIC_APP_URL`) or Next
  builds Open Graph image URLs against `http://localhost:3000` and social
  share cards break in production.
- **The manifest route and static files must bypass auth middleware.** See
  `config.matcher` in `src/proxy.ts` — if `.js`/`.txt`/`.xml`/`.webmanifest`
  are missing from the exclusion list, `/sw.js` runs through
  `createServerClient()` and 500s whenever Supabase env is absent.
