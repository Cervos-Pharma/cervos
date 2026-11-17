# Cervos Pharma OS: React Native (Expo) Mobile App Plan & Scaffold Spec

This document defines the production architecture, workspace layout, navigation tree, API session adapter, offline sync engine, hardware bridges, and Android `.apk` EAS build pipeline for the native Cervos mobile application (`apps/mobile`).

It builds directly on the existing shared packages (`@cervos/core`, `@cervos/i18n`, `@cervos/ui` tokens), the Next.js workspace API routes (`/api/workspace/*`), and the local-first patterns proven in `cervos-desktop/`.

---

## 1. Monorepo & Workspace Layout (`apps/mobile`)

### 1.1 Recommended Workspace Structure

Add `apps/mobile` as a pnpm workspace member alongside `packages/*` and `cervos-desktop`:

```yaml
# pnpm-workspace.yaml
packages:
  - "packages/*"
  - "apps/*"
  - "cervos-desktop"
  - "cervos-supplier-desktop"
```

Directory tree for `apps/mobile`:

```text
apps/mobile/
  app.config.ts                 # Dynamic Expo config (package id, permissions, icons, splash)
  eas.json                      # EAS Build profiles (development, preview APK, production)
  metro.config.js               # Monorepo watchFolders + node_modules resolution for @cervos/*
  package.json                  # Expo SDK 52+, Expo Router v4, TypeScript 5
  tsconfig.json                 # Extends expo/tsconfig.base + path aliases for @cervos/*
  src/
    app/                        # Expo Router file-based navigation
      _layout.tsx               # Root providers (MMKV hydrate, SQLite init, I18n, Theme, Sync)
      index.tsx                 # Boot gate (Splash -> Lang/Onboarding or Auth or Gate or Tabs)
      (onboarding)/
        language.tsx            # EN / SW selector
        showcase.tsx            # 4-slide capability carousel (FEFO, Offline POS, Kasri, Reports)
      (auth)/
        fork.tsx                # Sign In vs Sign Up entry
        signin.tsx              # @username or email + password/PIN + biometric unlock
        signup-identity.tsx     # Name, @handle, email, sex, quiet GPS snap
        signup-workplace-check.tsx # "Is your workplace already on Cervos?" early fork
        signup-join-org.tsx     # Org search, role request, password -> Lounge
        signup-new-org.tsx      # Role type, branch scale, day-one priority, org name, password
        lounge.tsx              # Welcome Lounge (Pending / Approved + PIN reveal / Declined recovery)
      (gate)/
        security-question.tsx   # Account security challenge + "Remember this device 30d"
        centre-picker.tsx       # Multi-branch selection for Owners / multi-site staff
        pin-pad.tsx             # 4-6 digit offline-capable PIN pad + biometric unlock
      (owner)/
        _layout.tsx             # Owner bottom tabs + branch/All-Centres scope header
        index.tsx               # All-Centres 2x2 Cube + Action & HQ Trail
        branches.tsx            # Branch metrics, centre switcher, staff/join-request approvals
        reports.tsx             # P&L, Sales, Stock valuation, Staff league, CSV/PDF share
        billing.tsx             # 3-step subscription checkout (M-Pesa, Tigo, CRDB/NMB, Card)
        kasri.tsx               # Wholesale orders, Kasri escrow status, GRN verification
      (station)/
        _layout.tsx             # Pharmacist / Cashier / Clerk bottom tabs + 1-tap PIN lock
        pos.tsx                 # Counter POS + 70/30 split checkout + FEFO batch selector
        scanner.tsx             # Camera GS1/QR/EAN scanner modal + HID wedge listener
        receipts.tsx            # Immutable Receipts Vault + Bluetooth ESC/POS reprint
        inventory.tsx           # FEFO stock guard, expiry badges, quarantine, GRN intake
        shifts.tsx              # Shift clock-in/out & blind cash reconciliation
        reports.tsx             # Personal Shift Report (cashier) / Org Analytics (pharmacist)
    components/
      ui/                       # 48dp minimum touch targets, Noto/Outfit/Inter typography, tabular nums
      PosCheckoutSheet.tsx      # Phone bottom sheet / Tablet 70/30 side-by-side checkout preview
      PinKeypad.tsx             # Tactile 4-6 digit numeric keypad with haptic feedback
      FefoBatchPicker.tsx       # Earliest-expiry batch breakdown & Schedule IV Rx override modal
      ReceiptPreviewCard.tsx    # Thermal 58mm/80mm preview + Bluetooth print trigger
    lib/
      api/
        client.ts               # Fetch wrapper attaching Bearer + Profile + Trust headers
        endpoints.ts            # Typed calls to /api/workspace/{auth,gate,lounge,orgs,state,hq,onboarding}
      auth/
        secure-session.ts       # expo-secure-store adapter + biometric prompt wrapper
      db/
        sqlite.ts               # expo-sqlite (WAL) schema + migrations aligned with cervos-desktop
        mmkv.ts                 # react-native-mmkv synchronous store (lang, scope, lastSyncAt)
        sync-engine.ts          # Idempotent sync_queue flush + delta pull + NetInfo/AppState wakeup
      hardware/
        escpos.ts               # 58mm/80mm ESC/POS command builder from EscPosReceiptPayload
        bluetooth-printer.ts    # Paired thermal printer discovery, connection & print queue
        gs1-scanner.ts          # VisionCamera / CameraView barcode hook -> parseGs1Barcode()
      i18n/
        mobile-copy.ts          # Extends @cervos/i18n with mobile onboarding & hardware strings
```

### 1.2 Shared Package Reuse (`@cervos/core`, `@cervos/i18n`, Design Tokens)

The Next.js app and `apps/mobile` share pure TypeScript business logic without duplication:

| Shared Package | Exports Reused in `apps/mobile` | Why It Matters |
|---|---|---|
| `@cervos/core` (`packages/core/src/fefo.ts`) | `allocateFefoBatches()` | Blocks expired and quarantined lots, splits demand across earliest-expiring batches, enforces Rx & Schedule IV pharmacist override on mobile POS offline. |
| `@cervos/core` (`packages/core/src/gs1.ts`) | `parseGs1Barcode()` | Parses `(01)` GTIN, `(17)` expiry, `(10)` batch, `(21)` serial from camera scans and Bluetooth/USB HID wedges. |
| `@cervos/core` (`packages/core/src/money.ts`) | `formatTzs()`, `clampDiscount()`, `computeOrderSubtotalAndTax()`, `deduplicateSalesRevenue()` | Consistent `TZS 12,500` formatting, 18% VAT calculation, and revenue deduplication. |
| `@cervos/core` (`packages/core/src/shifts.ts`) | `reconcileCashShift()` | Blind cash shift close variance calculation (`balanced`, `shortage`, `overage`). |
| `@cervos/core` (`packages/core/src/roles.ts`) | `normalizeCervosRole()`, `resolvePermissions()`, `COMMERCIAL_PLAN_CATALOG` | Canonical role permissions and TZS subscription tiers. |
| `@cervos/core` (`packages/core/src/workspace-contracts.ts`) | `WorkspaceAuthSignInPayload`, `WorkspaceAuthResponse`, `LoungeJoinRequestSummary`, `MobileSyncQueueEntry`, `EscPosReceiptPayload` | Shared API, offline queue, and thermal printer TypeScript contracts. |
| `@cervos/i18n` (`packages/i18n/src/index.ts`) | `CervosLocale`, `CERVOS_DICTIONARIES`, `getCervosText()` | Bilingual `en` / `sw` labels for FEFO blocks, Rx prompts, shift close, GRN, and accounting. |
| `packages/ui/src/tokens.ts` & `DESIGN.md` | Color palette (`#1039B9` Royal primary, `#006875` Clinical teal, `#00542C` Safe green, `#BA1A1A` Alert red, `#FCF8FF` / `#F8FAFC` surfaces) | Consistent clinical light/dark theme across Web, Tauri Desktop, and React Native. |

Note on `metro.config.js`: Because the repo uses `pnpm`, configure `watchFolders` to include the monorepo root (`../..`) and set `resolver.unstable_enableSymlinks = true` and `resolver.nodeModulesPaths` to resolve both `apps/mobile/node_modules` and root `node_modules`.

---

## 2. Screen-by-Screen Navigation Tree & User Flows

### 2.1 First-Run Initialization & Onboarding Flow

```text
[App Launch / Splash]
  |-- Hydrate MMKV (lang, onboardingSeen, lastCentreId) + open SQLite + read SecureStore
  |-- If valid profileToken + accountToken -> check Gate/Role -> [(owner)] or [(station)]
  |-- If valid accountToken only (no profileToken) -> [(gate)]
  |-- If joinreq token in SecureStore -> [lounge]
  '-- If unauthenticated:
        |
        v
  [1. Language Selector]  (EN | SW)  -- skipped on subsequent boots if already chosen
        |
        v
  [2. Cervos Capability Showcase Carousel]  (4 swipeable cards + Skip/Next)
        |-- Card 1: FEFO Safety Counter (auto-picks earliest expiry, blocks expired lots)
        |-- Card 2: Offline-First POS & Thermal Receipts (works with zero signal, syncs later)
        |-- Card 3: Kasri Escrow Wholesale & GRN (verify supplier lots before funds release)
        '-- Card 4: Multi-Branch Owner Cube & Bilingual Reports (live margin + shift trail)
        |
        v
  [3. Auth Fork: Sign In | Sign Up]
```

Design guardrails for mobile buttons and spacing (matching the PWA audit):
- Every interactive button, pill, segmented toggle, and list row uses at least `minHeight: 48` (exceeding the 44px WCAG/Apple HIG minimum).
- Horizontal button rows always allow wrapping or stack cleanly below `380dp` width with `gap: 10`.
- Safe-area insets (`react-native-safe-area-context`) guard top status bars, camera cutouts, and Android gesture navigation bars.

### 2.2 Sign In Flow (`(auth)/signin.tsx`)

1. Single identifier field accepting global `@username` (e.g. `@amani`, `@baraka.mwenge`) or `email`, plus password or 4-6 digit PIN.
2. Optional **Biometric / Passkey Quick Unlock** button if `expo-local-authentication` is enrolled and a local credential is bound.
3. Calls `POST /api/workspace/auth` with `{ action: "signin", identifier, password, clientMode: "bearer" }`.
4. Response routing parity with `src/app/api/workspace/auth/route.ts` and `destinationForProfileRole()`:
   - **Join Request Pending/Approved/Declined (`redirectTo: "/app/lounge"`)** -> `(auth)/lounge`.
   - **Incomplete Owner Setup (`redirectTo: "/app/onboarding"`)** -> `(auth)/signup-org-finish` (or web-parity 4-step finish).
   - **Security Gate Required (`redirectTo: "/app/gate?stage=security"`)** -> `(gate)/security-question`.
   - **Owner (`pharmacy_owner` / `supplier_admin`, `redirectTo: "/app?scope=all"`)** -> `(owner)/index` (All-Centres 2x2 Cube + Action Trail).
   - **Superintendent Pharmacist (`redirectTo: "/app?tab=inventory"`)** -> `(station)/inventory` tab inside `(station)`.
   - **Cashier / Dispatcher / Hospital Pharmacist (`redirectTo: "/app?tab=operations"`)** -> `(station)/pos` tab inside `(station)`.

### 2.3 Sign Up Flow with Early Workplace Fork

1. **Identity & Context (`(auth)/signup-identity.tsx`)**:
   - Fields: `Full Name`, `@username` (auto-suggested or custom), `Email`, `Sex` (`Female` / `Male` / `Prefer not`), and quiet background location snap via `expo-location` (`getCurrentPositionAsync` with low-accuracy fast timeout, falling back silently to manual `Region` picker: Dar es Salaam, Arusha, Mwanza, Dodoma, Zanzibar, etc.).
2. **Early Workplace Check (`(auth)/signup-workplace-check.tsx`)**:
   - Prompt: *"Is your workplace already on Cervos Pharma?"* / *"Je, duka au shirika lako tayari lipo kwenye Cervos?"*
   - **YES -> Existing Workplace (`(auth)/signup-join-org.tsx`)**:
     - Live search via `GET /api/workspace/orgs?q=...&region=...&roleType=...&preferredRegion=...`.
     - Select target organization, enter requested role (e.g. `Counter Cashier`, `Pharmacist`), optional shift/branch note, and password (8+ chars).
     - Submits `POST /api/workspace/auth` (`action: "request_join"`, `clientMode: "bearer"`) -> routes directly to **Welcome Lounge** (`(auth)/lounge`).
   - **NO -> New Organization Setup (`(auth)/signup-new-org.tsx`)**:
     - Step A: Role category (`Pharmacy`, `Supplier`, `Dispensary / Clinic`, `Researcher`, `Investor`, `Other`).
     - Step B: Counter/branch scale + Day-one priority (`Offline counter checkout`, `Stop expired stock losses`, `Wholesale via Kasri`, `Shift cash tracking`).
     - Step C: Organization name, Region, Street Address, Phone, Security Question + Answer, Master 4-6 digit PIN, and optional skippable Regulatory License capture (`expo-image-picker` / `expo-document-picker`).
     - Submits `signup` + `onboarding` -> sets `accountToken` + `profileToken` + `trustToken` -> lands in `(owner)/index`.

### 2.4 Welcome Lounge (`(auth)/lounge.tsx`)

Polls or refreshes `GET /api/workspace/lounge` and renders three states matching `src/app/app/lounge/page.tsx`:
- **Pending**: Shows target org name, requested role, region, `"Check Approval Status"` button, and Cervos HQ updates feed.
- **Approved**: Highlights assigned branch (`allocatedCentreName`), role (`allocatedRole`), `@username`, and one-time **Counter PIN reveal** (`allocatedPinPreview`). Tapping `"Accept Allocation & Enter Workspace"` calls `POST /api/workspace/lounge` (`action: "accept_allocation"`, `clientMode: "bearer"`), exchanges the `joinreq:` token for full `accountToken` + `profileToken`, caches the operator hash locally for offline PIN unlock, and routes straight into `(station)/pos` or `(station)/inventory`.
- **Declined**: Shows reason + in-screen org search to resubmit (`resubmit_request`) or one-tap `"Start Your Own Organization Instead"` (`convert_to_create_org`).

### 2.5 Security Gate & Offline PIN Pad (`(gate)/*`)

1. **Security Question (`security-question.tsx`)**: Shown when `browserTrusted === false` or `requireSecurityEveryTime === true`. Calls `POST /api/workspace/gate` (`action: "verify_security"`, `rememberBrowser`, `directUnlock: true`, `clientMode: "bearer"`). Stores returned `trustToken` in `expo-secure-store` (valid 30 days).
2. **Centre Picker (`centre-picker.tsx`)**: Shown when the account has `>1` centre and user is switching branches.
3. **Offline-Capable PIN Pad (`pin-pad.tsx`)**:
   - 1-second lock/switch screen (`action: "lock_profile"` clears `profileToken` from active memory/SecureStore while keeping `accountToken` and background sync alive).
   - Online: verifies via `POST /api/workspace/gate` (`action: "unlock_profile"`).
   - Offline: verifies 4-6 digit PIN against locally cached `operators.pin_hash` in SQLite (using matching scrypt/SHA-256 verifier) or device biometrics (`expo-local-authentication`) if enabled for that profile.

### 2.6 Role-Routed Workspaces

#### A. Owner Mode (`(owner)/*`)
- **Overview (`index.tsx`)**:
  - Top scope switcher: `All Branches` (`scope=all`) vs individual branch selector.
  - **2x2 Analytics Cube**:
    1. `Gross Revenue` (TZS + Rx count + GM%) -> drills into Sales Report
    2. `Net Profit` (TZS + OPEX) -> drills into Billing / P&L
    3. `Stock Valuation` (Retail TZS + `<=30d` near-expiry alert count) -> drills into Stock Report
    4. `Kasri Escrow` (Held TZS + active branch count) -> drills into Wholesale / Kasri tab
  - **Action Trail & Direct HQ Desk**: Pending Lounge join requests (approve with centre/role/PIN assignment or decline), unacknowledged HQ directives (`POST /api/workspace/state` `ack_hq_message`), and recent audit events.
- **Branches (`branches.tsx`)**: Per-branch revenue/stock comparison, add/edit branch, and quick switch into a branch's POS station.
- **Kasri Wholesale (`kasri.tsx`)**: Supplier catalog browse, PO placement into Kasri escrow, ASN tracking, and GRN delivery confirmation.
- **Billing (`billing.tsx`)**: Subscription status badge (`15-Day Trial Active`, `Active Paid Plan`, or `Locked - Payment Needed`), 3-step plan selector (`COMMERCIAL_PLAN_CATALOG`), payment channel (`M-Pesa Paybill`, `Tigo Lipa`, `CRDB / NMB Bank`, `Card / Visa`), and `423` lock recovery.
- **Reports (`reports.tsx`)**: Bilingual EN/SW executive reports with native `expo-print` + `expo-sharing` PDF/CSV export.

#### B. Station / Operator Mode (`(station)/*`)
- **Counter POS (`pos.tsx`) with 70/30 Checkout**:
  - On tablets (`width >= 768dp`): true 70% left pane (search bar, barcode scan button, category chips, FEFO-ordered product cards with remaining batch days badge) and 30% right pane (cart lines, quantity steppers, discount clamp, Rx/Schedule IV override, payment method selector, tender/change, Complete Sale).
  - On phones (`< 768dp`): full-width 70% catalog & fast-add list with a persistent bottom checkout bar showing item count + `formatTzs(total)` that expands a smooth 30%-height-anchored / full-checkout modal sheet with tender keypad, payment channels (`Cash`, `M-Pesa`, `Tigo`, `Halopesa`, `Card`), and instant print toggle.
  - Every cart add runs `allocateFefoBatches()` from `@cervos/core` before committing to local SQLite and `sync_queue`.
- **Camera GS1 / QR Scanner (`scanner.tsx`)**:
  - Full-screen viewfinder with torch toggle, frame reticle, manual barcode input fallback, and continuous HID Bluetooth/USB scanner input capture.
  - Feeds scanned payload into `parseGs1Barcode()` (`@cervos/core`), auto-matching GTIN/SKU and highlighting batch + expiry date for both POS checkout and GRN receiving.
- **Receipts Vault (`receipts.tsx`)**:
  - Non-deletable station receipt log searchable by receipt number, customer name/phone, or medicine.
  - One-tap `"Reprint Thermal Receipt"` via Bluetooth ESC/POS or `"Share PDF"` via `expo-print`.
- **Inventory & FEFO Guard (`inventory.tsx`)**:
  - Live search, Expiry Badges (`Expired`, `Expiring <=30d`, `Verified Safe`, `Quarantined`), add batch, quarantine toggle (permission-gated by `canEditInventory`), and GRN intake.
- **Shifts & Reports (`shifts.tsx`, `reports.tsx`)**:
  - Clock In / Clock Out (`shift_clock`), Blind Cash Count (`reconcileCashShift()`), and role-scoped reports (`canViewOwnReports` vs `canViewOrgReports`).

---

## 3. Token/Cookie vs Bearer Session Adapter for Next.js API Routes

### 3.1 Current State & Gap

Inspection of `src/lib/security/session.ts`, `src/lib/workspace/cookies.ts`, and the `/api/workspace/*` handlers confirms:
- `src/app/api/workspace/auth/route.ts`, `gate/route.ts`, `lounge/route.ts`, `state/route.ts`, `onboarding/route.ts`, and `hq/route.ts` currently read sessions exclusively from `request.cookies.get(WS_ACCOUNT_COOKIE | WS_PROFILE_COOKIE | WS_TRUSTED_COOKIE)` and write them via `setHttpCookie(...)`.
- React Native `fetch()` does not reliably persist `HttpOnly; SameSite=Lax` cookies across app restarts or share them cleanly with background tasks and `expo-secure-store`.

### 3.2 Backward-Compatible Dual-Transport Adapter

Create a single helper module `src/lib/workspace/request-auth.ts` in the Next.js app that preserves 100% existing browser/PWA cookie behavior while enabling stateless Bearer/header authentication for `apps/mobile`:

| Credential | Web / PWA (Cookie) | React Native (Header) | Signing & Payload (`src/lib/security/session.ts`) |
|---|---|---|---|
| Account session | `cervos_ws_acct` | `Authorization: Bearer <token>` | `createAccountCookieValue` / `readAccountCookieValue` (`accountId`, `email`, `exp`, 12h TTL; or `joinreq:<id>`) |
| Profile session | `cervos_ws_prof` | `X-Cervos-Profile: <token>` | `createProfileCookieValue` / `readProfileCookieValue` (`accountId`, `centreId`, `profileId`, `role`, `exp`, 8h TTL) |
| Trusted device | `cervos_trusted_browser` | `X-Cervos-Trust: <token>` | `createTrustedBrowserCookieValue` / `isTrustedBrowserCookieValid` (30d TTL; mobile sends deterministic device ID in `X-Cervos-Device` or `User-Agent`) |

Implementation rules for `src/lib/workspace/request-auth.ts`:
1. `readAccountToken(request)`: check `request.cookies.get(WS_ACCOUNT_COOKIE)?.value`; if absent, parse `request.headers.get("authorization")` starting with `Bearer `.
2. `readProfileToken(request)`: check `request.cookies.get(WS_PROFILE_COOKIE)?.value`; if absent, read `request.headers.get("x-cervos-profile")`.
3. `readTrustContext(request)`: check `request.cookies.get(WS_TRUSTED_COOKIE)?.value` or `request.headers.get("x-cervos-trust")`; compute fingerprint from `request.headers.get("x-cervos-device") || request.headers.get("user-agent") || ""`.
4. **Opt-in Token Echo (`clientMode: "bearer"`)**:
   - In `/api/workspace/auth` (`signin`, `signup`, `request_join`), `/api/workspace/gate` (`verify_security`, `unlock_profile`), `/api/workspace/lounge` (`accept_allocation`, `convert_to_create_org`), and `/api/workspace/onboarding`:
   - Always set HTTP-only cookies as today (so web/PWA never changes).
   - When `body.clientMode === "bearer"`, also include `tokens: { accountToken, profileToken?, trustToken?, expiresInSec }` in the JSON response matching `WorkspaceAuthResponse` in `packages/core/src/workspace-contracts.ts`.
5. **No-Regression Guarantee**: Browsers never send `clientMode: "bearer"`, so cookies remain `HttpOnly` and inaccessible to browser JavaScript.

### 3.3 Endpoint Mapping for Mobile Client

- `POST /api/workspace/auth`: `signin`, `signup`, `request_join`, `signout`
- `GET /api/workspace/orgs`: public organization directory search (`q`, `region`, `roleType`, `preferredRegion`)
- `GET / POST /api/workspace/lounge`: load pending/approved/declined status; `accept_allocation`, `resubmit_request`, `convert_to_create_org`
- `POST /api/workspace/gate`: `verify_security`, `unlock_profile`, `lock_profile`
- `POST /api/workspace/onboarding`: complete first-run setup (branch address/phone, security question, Master PIN, optional certificate)
- `GET / POST /api/workspace/state`: hydrate full workspace snapshot (`account`, `centres`, `profiles`, `batches`, `sales`, `wholesaleOrders`, `shiftLogs`, `joinRequests`, `hqMessages`, `stockAlerts`) and execute mutations (`record_sale`, `add_batch`, `adjust_batch`, `shift_clock`, `review_join_request`, `activate_subscription`, `ack_hq_message`, `update_lang`)
- `GET / POST /api/workspace/hq`: lock status polling (`423` access lock enforcement) and HQ messages

---

## 4. Offline Storage & Sync Queue Strategy (`SQLite` + `MMKV`)

### 4.1 Split of Responsibilities

| Storage Layer | Library | Contents | Why |
|---|---|---|---|
| **Secrets** | `expo-secure-store` | `accountToken`, `profileToken`, `trustToken`, device UUID | Encrypted in Android Keystore / iOS Keychain. |
| **Fast KV State** | `react-native-mmkv` | `lang` (`EN`/`SW`), `onboardingSeen`, `themePref`, `activeCentreId`, `lastSyncAt`, `selectedPrinterMac` | Synchronous reads (`<1ms`) prevent splash flicker and render cached UI before network responds. |
| **Transactional Store** | `expo-sqlite` (WAL mode) | `products`, `batches`, `sales`, `sale_items`, `operators`, `centres`, `shift_logs`, `app_settings`, `sync_queue` | ACID local POS checkout, FEFO lot decrement, offline PIN check, and durable outbound queue. |

### 4.2 Local SQLite Schema Parity

Mirror the proven schema from `cervos-desktop/src/lib/database.ts` (`runMigrations()`) using idempotent `CREATE TABLE IF NOT EXISTS` statements and `PRAGMA journal_mode = WAL;`:
- `batches`: includes `id, account_id, centre_id, product_id, generic_name, brand_name, category, batch_number, quantity, cost_price_tzs, sale_price_tzs, expiry_date, low_stock_threshold, requires_prescription, is_controlled, quarantined, updated_at`.
- `sales` & `sale_items`: stores `id, receipt_number, centre_id, profile_id, actor_name, customer_name, customer_phone, total_tzs, payment_method, prescription_ref, lines_json, created_at, sync_status`.
- `operators`: stores `id, centre_id, username, display_name, role, pin_hash, capabilities_json, is_master_admin` for instant offline PIN validation and 1-second cashier shift switching.
- `sync_queue`: stores `id, idempotency_key, entity, centre_id, profile_id, payload_json, created_at, attempts, last_error, status`.

### 4.3 Outbound Queue & Inbound Delta Sync Loop

1. **Zero-Block Boot**: On launch, `expo-sqlite` opens and MMKV hydrates synchronously; the user sees their POS or Owner Cube in `<150ms` even with airplane mode enabled.
2. **Write Path (Local-First)**:
   - Cashier completes a sale -> SQLite transaction decrements `batches.quantity` using `allocateFefoBatches()`, inserts `sales` + `sale_items`, and appends a `MobileSyncQueueEntry` with a UUID `idempotency_key` to `sync_queue`.
   - Receipt prints immediately over Bluetooth ESC/POS without waiting for the server.
3. **Flush & Reconnect Runner**:
   - Triggered on boot, on every queue write, on `@react-native-community/netinfo` `isConnected && isInternetReachable` transition, and on `AppState` `"active"` foregrounding.
   - Exponential backoff on failure: `[2500, 5000, 10000, 20000, 45000, 90000]` ms (matching `docs/MOBILE_ONBOARDING_SYNC.md`).
   - Sends queued mutations idempotently; captures and surfaces HTTP `401` (re-auth prompt), `403` (permission/RLS error), `423` (HQ/billing lock screen), or `409` (conflict) instead of swallowing errors (avoiding Cause F from `docs/ENDPOINT_SYNC.md`).
4. **Inbound Delta Refresh**:
   - Pulls `GET /api/workspace/state` (or Supabase direct delta pull when linked to a cloud branch) to refresh `batches`, `joinRequests`, `hqMessages`, and `account.accessLock`.
   - If `account.accessLock.locked === true`, presents the Billing/HQ Lock modal with direct jump to `(owner)/billing` (for owners) or lock notice (for operators).

---

## 5. Hardware Bridges (Thermal ESC/POS Printers & Camera/HID Scanners)

### 5.1 Thermal Bluetooth ESC/POS Printing

- **Target Hardware**: Standard 58mm (32 chars/line) and 80mm (48 chars/line) Bluetooth thermal receipt printers commonly used in East African pharmacies (Xprinter, Sunmi built-in/BT, Goojprt, Rongta).
- **Library Choice**:
  - `react-native-bluetooth-classic` for SPP (Serial Port Profile) paired printers (most reliable for cheap 58mm ESC/POS printers on Android).
  - Optional Sunmi / Android Print Service fallback via `expo-print` for PDF receipts.
- **ESC/POS Formatter (`src/lib/hardware/escpos.ts`)**:
  - Consumes `EscPosReceiptPayload` from `@cervos/core` (`paperWidthMm: 58 | 80`, `lang: "EN" | "SW"`).
  - Pure TypeScript `Uint8Array` builder:
    - `ESC @` (0x1B 0x40): Initialize printer
    - `ESC a 1` / `ESC a 0`: Center header (`orgName`, `branchName`, `branchPhone`) / Left-align items
    - `ESC E 1/0`: Bold emphasis on Receipt #, Total `TZS`, and Thank You footer
    - Strict fixed-width column pad (`padItemLine(name, qty, lineTotal, cols)`) so prices align cleanly on 32-column 58mm paper
    - `GS V 66 0`: Partial paper cut (ignored safely by tear-bar printers)
  - Saves `selectedPrinterMac` + `paperWidthMm` in MMKV and supports a one-tap **"Print Test Slip"** in Station Settings.

### 5.2 Camera GS1 / QR / EAN Scanner & HID Wedge

- **Camera Scanner**:
  - Use `expo-camera` (`CameraView` with `onBarcodeScanned`) or `react-native-vision-camera` (`useCodeScanner`) supporting `code128`, `ean13`, `ean8`, `qr`, `datamatrix` (GS1 DataMatrix is standard on East African pharma packs).
  - Debounce identical scans for `1500ms` + trigger `expo-haptics` (`NotificationFeedbackType.Success`) on capture.
  - Pass raw `barcode.rawValue` directly to `parseGs1Barcode()` from `@cervos/core` to extract GTIN, Batch `(10)`, Expiry `(17)`, and Serial `(21)`.
- **Bluetooth / USB-C HID Scanner Support**:
  - POS search input auto-focuses on `(station)/pos` and listens for rapid keystroke bursts terminated by `\n` / `Enter` so physical handheld barcode guns work seamlessly alongside the phone camera.

---

## 6. EAS Build & Android `.apk` Distribution Pipeline

### 6.1 `app.config.ts` Essentials

- `name`: `"Cervos Pharma"`
- `slug`: `"cervos-pharma"`
- `android.package`: `"online.cervos.pharma"`
- `ios.bundleIdentifier`: `"online.cervos.pharma"`
- `android.permissions`:
  - `android.permission.CAMERA` (GS1/QR scanning + compliance license photo)
  - `android.permission.BLUETOOTH_SCAN` (with `neverForLocation` flag on Android 12+)
  - `android.permission.BLUETOOTH_CONNECT`
  - `android.permission.ACCESS_COARSE_LOCATION` / `ACCESS_FINE_LOCATION` (optional signup location snap, requested only with user consent)
  - `android.permission.INTERNET` & `android.permission.ACCESS_NETWORK_STATE`
- `plugins`: `expo-router`, `expo-sqlite`, `expo-secure-store`, `expo-camera`, `expo-location`, `expo-local-authentication`.

### 6.2 `eas.json` Configuration

```json
{
  "cli": {
    "version": ">= 14.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk",
        "gradleCommand": ":app:assembleRelease"
      },
      "env": {
        "EXPO_PUBLIC_API_BASE_URL": "https://cervos.online"
      }
    },
    "production": {
      "autoIncrement": true,
      "android": {
        "buildType": "app-bundle"
      },
      "env": {
        "EXPO_PUBLIC_API_BASE_URL": "https://cervos.online"
      }
    }
  }
}
```

### 6.3 Build & Verification Commands

1. **Local Prebuild & Typecheck**:
   ```bash
   cd apps/mobile
   npx tsc --noEmit
   npx expo-doctor
   ```
2. **Cloud or Local APK Build (Internal Pharmacy Distribution)**:
   ```bash
   # Cloud EAS APK (signed automatically with EAS keystore)
   eas build --platform android --profile preview

   # Or local EAS build on Windows/Linux with Android SDK + JDK 17/21
   eas build --platform android --profile preview --local
   ```
3. **Web Download Portal Integration**:
   - Host the signed `cervos-pharma-vX.Y.Z.apk` artifact and point `/app/download` and `/api/downloads/[id]` to the latest React Native APK release alongside the Windows NSIS installer (`cervos-desktop/`).
   - Keep `cervos-desktop/` (`docs/ANDROID_APK_SETUP.md`) focused on Windows/Linux branch desktop terminals and legacy Tauri builds until pharmacies migrate mobile phones to the native Expo APK.

---

## 7. Phased Delivery Milestones

1. **Phase 1 (Backend Adapter & Shared Contracts)**:
   - Shared types added in `packages/core/src/workspace-contracts.ts` (completed).
   - Implement `src/lib/workspace/request-auth.ts` and `clientMode: "bearer"` support in `/api/workspace/{auth,gate,lounge,onboarding,state,hq}` with Vitest integration tests covering both cookie and Bearer flows.
2. **Phase 2 (Expo Scaffold, Onboarding, Auth & Lounge)**:
   - Initialize `apps/mobile` with Expo Router, MMKV, SecureStore, and `@cervos/core` + `@cervos/i18n`.
   - Build Language -> 4-card Capability Showcase -> Sign In / Sign Up fork -> Early Workplace Check -> Welcome Lounge -> Security Gate & Offline PIN Pad.
3. **Phase 3 (Offline SQLite POS, Scanner & Thermal Printing)**:
   - Port local SQLite tables + `sync_queue` runner.
   - Build Station POS (70/30 layout), Camera GS1/QR scanner, Receipts Vault, Bluetooth ESC/POS 58mm/80mm printer bridge, Inventory FEFO Guard, and Shift Close.
4. **Phase 4 (Owner Command, Kasri, Billing & APK Release)**:
   - Build Owner All-Centres 2x2 Cube + Action/HQ Trail, Lounge Join Approval modal (with branch/role/PIN assignment), 3-step Billing Checkout, and signed EAS `preview` `.apk` build + field test on physical Android devices and 58mm thermal printers.
