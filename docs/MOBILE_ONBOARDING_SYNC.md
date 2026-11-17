# Cervos Mobile POS: Standalone Onboarding & Background Reconnect Architecture

## 1. Executive Summary & Problem Analysis

Historically, the Cervos Point of Sale (POS) client application was architected under a **"Fixed Client Terminal"** paradigm. Under that assumption:
1. Business owners were required to first visit the `cervos.online` web portal to register an organization.
2. The owner had to configure headquarters details, create physical branches, and provision operators with PINs on the web.
3. Only afterwards could an Android APK or desktop client download and link to an already-configured branch.

If a new user installed the APK directly from the Google Play Store or APK distribution link, the app immediately halted with hard blocking errors or kicked the user out to an external web browser (`open("cervos.online/auth?tab=signup")`). Furthermore, on APK boot, network session restoration could block the initial dashboard render for up to 60 seconds on flaky 2G/3G mobile connections, or leave the app in a permanently unsynced state if launched while offline.

### The Objectives Achieved
- **100% Standalone In-APK Onboarding:** New pharmacy operators can download the APK, register their account, provision their pharmacy branch, establish an offline PIN, and launch their POS without ever touching a web browser.
- **Zero-Block Boot & Instant Dashboard:** The POS dashboard renders immediately (<100ms) from local SQLite, showing all cached sales, products, and metrics with zero network blocking.
- **Reactive Background Reconnect Runner:** If the app launches offline, session restoration and data sync run quietly in the background on an aggressive retry schedule (`[2.5s, 5s, 10s, 20s, 45s, 90s]`), auto-recovering on network reconnection and dynamically refreshing the live UI without user intervention.
- **Enterprise-Grade UI/UX:** A streamlined, HUD glassmorphic mobile interface with real-time provisioning progress indicators, numeric PIN styling, and full bilingual support (English and Swahili).

---

## 2. End-to-End System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Cervos Mobile APK (Tauri 2)                    │
│                                                                        │
│  ┌────────────────────────┐            ┌────────────────────────────┐  │
│  │   Onboarding Wizard    │            │     Local SQLite Engine    │  │
│  │  (Multi-step HUD card) │            │         (sql.js)           │  │
│  └───────────┬────────────┘            └─────────────▲──────────────┘  │
│              │                                       │                 │
│              │ registerAndScaffoldPharmacy()         │ upsertLocal()   │
│              │                                       │                 │
│  ┌───────────▼────────────┐            ┌─────────────┴──────────────┐  │
│  │  Sync & Reconnect Bus  │◄───────────┤   Instant Dashboard View   │  │
│  │  (startAutoSync runner)│  subscribes│  (Zero-latency local read) │  │
│  └───────────┬────────────┘  lastSyncAt└────────────────────────────┘  │
└──────────────┼─────────────────────────────────────────────────────────┘
               │
               │ HTTPS / WebSocket (TLS)
               ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Supabase Cloud Platform                         │
│                                                                        │
│  ┌────────────────────────┐            ┌────────────────────────────┐  │
│  │      Auth Service      │───────────►│   auth.users insert trigger│  │
│  │    (JWT Management)    │            │  (auto-populates accounts) │  │
│  └────────────────────────┘            └─────────────┬──────────────┘  │
│                                                      ▼                 │
│  ┌────────────────────────┐            ┌────────────────────────────┐  │
│  │  operators (pin_hash)  │◄───────────┤     branches (exclusive)   │  │
│  └────────────────────────┘            └────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Standalone Mobile Onboarding (`registerAndScaffoldPharmacy`)

### 3.1 The Scaffolding Pipeline
When a user submits the in-app registration wizard, `registerAndScaffoldPharmacy()` executes an orchestrated atomic-like provisioning sequence directly against Supabase:

1. **User Authentication (`Ie.auth.signUp`)**:
   - Creates the Supabase Auth user with credentials and user metadata:
     ```ts
     {
       full_name: params.fullName,
       phone: params.phone,
       account_type: 'pharmacy',
       entity_name: params.pharmacyName
     }
     ```
   - Checks if session is returned immediately (standard for configured mobile environments) or if email confirmation is required.

2. **Accounts Record Fallback Verification**:
   - While an SQL trigger (`handle_new_auth_user()`) typically copies the new user into the `public.accounts` table, client-side latency or unconfigured environments could historically cause `"No pharmacy account found for this login"`.
   - The APK includes an idempotent check-and-insert fallback:
     ```ts
     let { data: account } = await Ie.from('accounts').select('id').eq('auth_user_id', authData.user.id).maybeSingle();
     if (!account) {
       const { data: created } = await Ie.from('accounts').insert({
         auth_user_id: authData.user.id,
         name: params.pharmacyName,
         type: 'pharmacy',
         email: authData.user.email
       }).select('id').maybeSingle();
       account = created;
     }
     ```

3. **Branch Creation**:
   - Provisions an active branch tied directly to the newly verified `account.id`.
   - Automatically marks `pos_activated_at = new Date().toISOString()` to claim the branch exclusively for this physical APK installation.

4. **Operator Provisioning with SHA-256 PIN Hashing**:
   - **Bug Resolved:** Previous shelled implementations passed `{ pin: managerPin }`, but the Supabase database schema and offline POS auth validator expect `pin_hash` matching the SHA-256 digest:
     ```ts
     export async function hashPin(pin: string): Promise<string> {
       const encoder = new TextEncoder()
       const data = encoder.encode(pin)
       const hashBuffer = await crypto.subtle.digest('SHA-256', data)
       const hashArray = Array.from(new Uint8Array(hashBuffer))
       return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
     }
     ```
   - The operator is inserted into Supabase with `{ name, role: 'admin', pin_hash: pinHash }`.
   - Crucially, the operator is **also written directly into local SQLite** immediately. This guarantees that even if cellular data drops right after signup, the manager can unlock and operate the POS terminal immediately without internet.

5. **Terminal Configuration & Background Sync**:
   - Writes the hardware configuration to local SQLite `app_settings` (`branch_id`, `account_id`, `account_name`, `centre_name`, `centre_address`).
   - Kicks off an asynchronous background sync cycle (`runSyncCycle()`) to download medicine catalogs, batches, and system settings.

---

## 4. Background Retry & Instant Boot Architecture

### 4.1 The Offline Boot Problem in Mobile
Mobile Android devices frequently experience transient network conditions on application start:
- Wi-Fi authentication can take 2–5 seconds after application launch.
- Cellular connections in retail shops often suffer latency spikes or intermittent drops.
- A blocking call (e.g. `await ensureLinked()`) freezes the UI thread or displays an indefinite spinner.

### 4.2 Decoupled Boot Lifecycle
In `cervos-desktop/src/App.tsx`:
1. SQLite database initialization (`initDb()`) executes immediately.
2. As soon as `dbReady === true`, `setSessionRestored(true)` is committed synchronously.
3. The UI router mounts instantly. `Dashboard.tsx` queries the local SQLite table for `sales`, `batches`, and cached branch settings, displaying revenue and inventory stats in sub-100ms.
4. `startAutoSync()` is invoked **unconditionally**. It does not wait for a network call to complete before mounting the scheduler.

### 4.3 Reactive Reconnect Runner (`startAutoSync`)
The sync runner in `cervos-desktop/src/lib/sync.ts` implements a multi-tiered recovery strategy:

```ts
const NORMAL_INTERVAL = 3 * 60 * 1000 // 3 minutes when healthy
const RETRY_INTERVALS = [2500, 5000, 10000, 20000, 45000, 90000] // Fast backoff
const FIRST_DELAY = 1200 // Initial attempt shortly after boot
```

- **Fast Backoff on Disconnect:** When offline or unlinked, the scheduler retries in 2.5s, then 5s, 10s, 20s, up to 90s max (replacing the previous 5-to-30 minute static delay).
- **Event-Driven Wakeup:** Event listeners hook into OS and browser lifecycle events:
  - `window.addEventListener('online', triggerImmediateSync)`: Detects Wi-Fi / cellular reconnection immediately.
  - `window.addEventListener('focus', triggerImmediateSync)`: Detects app foregrounding from the Android task switcher.
  - `document.addEventListener('visibilitychange', triggerImmediateSync)`: Resumes sync as soon as the screen turns on.
- **Reactive UI Update:** When a background sync succeeds, it updates `useSyncStore.getState().setLastSyncAt(nowIso)`. `Dashboard.tsx` subscribes to this state, automatically re-querying SQLite and refreshing subscription status, seamlessly clearing any temporary "Offline" warning banners without requiring a page reload.

---

## 5. Mobile UI & UX Specifications

### 5.1 HUD Cyber-Clinical Aesthetics
The onboarding experience in `cervos-desktop/src/pages/Onboarding.tsx` uses custom CSS utility components defined in `index.css`:
- `.hud-panel`: Glassmorphic translucent panel (`rgba(255, 255, 255, 0.92)` with `backdrop-filter: blur(16px)` and angled notched corner clip-path).
- `.hud-border`: Crisp boundary ring conforming to the geometry.
- `.hud-notch-line`: Visual alignment marker rotated at 45 degrees.

### 5.2 Responsive Mobile Ergonomics
- Safe-area insets (`env(safe-area-inset-top)`) prevent cutouts and status-bar overlap on edge-to-edge Android displays.
- Large touch targets (minimum 48px height) for all primary form inputs and action buttons.
- Monospaced numeric PIN inputs with prominent character spacing and password mask toggles.
- Real-time provisioning indicators displaying current phase:
  - *"Creating secure cloud account..."*
  - *"Configuring pharmacy branch..."*
  - *"Setting up offline manager PIN..."*
  - *"Synchronizing catalog..."*

### 5.3 Bilingual Localization (English & Kiswahili)
All screens, error messages, and progress states are fully localized in `cervos-desktop/src/lib/i18n.ts`. A persistent toggle in the top-right header allows pharmacy staff in East Africa to switch seamlessly between English and Swahili with a single tap.

---

## 6. Build, Verification & Release Guidelines

### 6.1 Compiling the Production Web Bundle
Inside `cervos-desktop/`:
```bash
npm run build
```
Validates TypeScript typings (`tsc`) and bundles optimized static assets with Vite.

### 6.2 Generating the Android APK via Tauri 2
Ensure prerequisite Android tools (JDK 21, Android SDK platform-tools 36.0.0, NDK) are present in the environment:
```powershell
cd cervos-desktop
# Debug build (generates unsigned arm64 APK for quick device testing)
npm run android:build:debug

# Release production build
npm run android:build
```
The output APK is generated at:
`cervos-desktop/src-tauri/gen/android/app/build/outputs/apk/release/app-release-unsigned.apk`

---

## 7. Change Log Reference

| File | Change Scope |
| :--- | :--- |
| `cervos-desktop/src/lib/sync.ts` | Added `registerAndScaffoldPharmacy()`, fixed SHA-256 PIN hashing in `scaffoldAccount()`, overhauled `startAutoSync()` with fast reconnect backoff and reactive event wakeups. |
| `cervos-desktop/src/pages/Onboarding.tsx` | Redesigned with complete standalone in-APK registration wizard, 4-digit PIN setup, status tracking, and language switcher. |
| `cervos-desktop/src/App.tsx` | Uncoupled `startAutoSync()` from initial online check to ensure background retries run unconditionally on APK boot. |
| `cervos-desktop/src/pages/Dashboard.tsx` | Subscribed to `lastSyncAt` store updates to dynamically refresh live stats and eliminate offline warnings upon background reconnection. |
| `cervos-desktop/src/lib/queries.ts` | Exported `hashPin()` for shared cryptographic PIN generation. |
| `cervos-desktop/src/lib/i18n.ts` | Added comprehensive English and Swahili dictionaries for onboarding and terminal provisioning. |
| `cervos-desktop/src/index.css` | Integrated `.hud-panel`, `.hud-border`, and `.hud-notch-line` components. |
