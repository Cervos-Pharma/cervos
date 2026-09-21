# Building the Cervos POS Android APK

The POS app (`cervos-desktop/`) is a Tauri 2 app. Tauri 2 builds Android APKs from the same codebase as the Windows installer — no rewrite needed. The UI is now responsive: below `lg` (1024px) the sidebar becomes a slide-in/out drawer with a hamburger in the top bar, and the POS screen stacks the cart above the payment panel with touch-friendly quantity steppers.

> **Prerequisite summary** (verified on this machine):
> ✅ Rust 1.98 (with `rustup target add aarch64-linux-android`)
> ✅ Android SDK at `%LOCALAPPDATA%\Android\Sdk` (platforms; build-tools 36.0.0)
> ✅ JDK 25 + Android Studio (installed at `C:\Program Files\Android\Android Studio`)
> ❌ NDK + cmdline-tools — install these (Step 1).

## Step 1 — Install the missing Android components (one time)

Open **Android Studio → More Actions (or ⋮) → SDK Manager → SDK Tools** tab:

1. Tick **NDK (Side by side)** → Apply. (Any recent LTS works; Tauri 2 currently pins 27.x — pick the default it offers.)
2. Tick **Android SDK Command-line Tools (latest)** → Apply.

The SDK Manager downloads both in one go (~2–3 GB).

## Step 2 — Environment variables (one time)

Add these to your user environment (System Properties → Environment Variables), or run in the shell you build from:

```powershell
setx ANDROID_HOME "%LOCALAPPDATA%\Android\Sdk"
setx JAVA_HOME "C:\Users\<you>\.jdks\jdk-21.0.12.1+1"   # portable JDK 21 — see warning below
setx NDK_HOME "%LOCALAPPDATA%\Android\Sdk\ndk\<version-you-installed>"
setx PATH "$env:PATH;$env:LOCALAPPDATA\Android\Sdk\platform-tools;$env:LOCALAPPDATA\Android\Sdk\cmdline-tools\latest\bin"
```

Open a **new** terminal afterwards (setx only affects new processes).

> **Warning — JDK version (verified the hard way):** Android Studio's JBR is Java 25 on this
> machine, and Gradle 8.14 cannot run under it (`Unsupported class file major version 69`).
> Install a portable JDK 21 instead — no admin, no system change:
>
> ```powershell
> mkdir "$env:USERPROFILE\.jdks"
> curl -L -o "$env:USERPROFILE\.jdks\temurin21.zip" "https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jdk/hotspot/normal/eclipse"
> tar -xf "$env:USERPROFILE\.jdks\temurin21.zip" -C "$env:USERPROFILE\.jdks"
> ```

## Step 3 — Generate the Android project (one time)

```powershell
cd cervos-desktop
npm install
npm run tauri -- android init
```

This creates `src-tauri/gen/android` — the Gradle wrapper project Tauri manages. Commit it? It's generated but customized per-app (icons, package id); Tauri docs recommend committing it.

## Step 4 — Add the Android Rust target (one time)

```powershell
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

## Step 5 — Build the APK

Debug APK (biggest, for quick device testing):

```powershell
npm run tauri -- android build --debug --target aarch64
```

Release APK (recommended for distribution to pharmacies):

```powershell
npm run tauri -- android build --apk --target aarch64   # --apk skips the AAB step (see troubleshooting)
```

Output lands in `src-tauri/gen/android/app/build/outputs/apk/universal/release/` — e.g. `app-universal-release-unsigned.apk`.

### Signing for distribution

For pharmacies to install it outside the Play Store, sign it:

```powershell
# 1. Create an upload keystore (once — keep it safe, you cannot update the app without it)
keytool -genkey -v -keystore cervos-upload.keystore -alias cervos -keyalg RSA -keysize 2048 -validity 10000

# 2. Point Gradle at it: create cervos-desktop/src-tauri/gen/android/keystore.properties
#    (this file must NOT be committed — add to .gitignore)
#      storeFile=.../cervos-upload.keystore
#      storePassword=...
#      keyAlias=cervos
#      keyPassword=...

# 3. Sign the built APK directly with apksigner (simplest — verified working):
#    SDK/build-tools/<v>/apksigner.bat sign --ks cervos-upload.keystore --ks-key-alias cervos \
#      --ks-pass pass:... --key-pass pass:... --out cervos-pos-<v>-arm64.apk app-universal-release-unsigned.apk
#
# Or configure Gradle to sign during the build:
#    src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk
```

Alternatively, Play App Signing can generate a signed AAB (`--apk --aab` flags) if you later publish to the Play Store.

## Step 6 — Install on a device

Enable **Developer options → USB debugging** on the phone, plug in, then:

```powershell
adb install -r app-universal-release.apk
```

Or copy the APK to the phone and tap it (allow "install unknown apps" for your file manager).

---

## Notes on the responsive POS layout

- `Shell.tsx` owns `sidebarOpen` via React context (`useShell()`).
- `TopBar.tsx` renders the hamburger below `lg` (1024 px) and hides the "Cervos POS" wordmark on very narrow screens.
- `Sidebar.tsx` renders as `fixed` overlay drawer (with backdrop) below `lg`, `static` permanent sidebar at `lg+`; it auto-closes on navigation and Escape.
- `Pos.tsx` stacks vertically on phones: search/barcode row, cart as touch-friendly cards, payment panel below. On desktop everything is unchanged (3-zone layout, table cart).
- The Tauri window config (`tauri.conf.json`) is untouched — desktop windows keep their 1200×800 min-1024 dimensions; Android ignores those keys.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `failed to ensure Android environment` on `android init` | NDK / cmdline-tools missing → Step 1. |
| `Error: ANDROID_HOME is not set` | Step 2, open a NEW terminal. |
| Gradle sync fails: "Unsupported class file major version" | Wrong JDK — build with the portable JDK 21 (`~/.jdks/jdk-21.0.12.1+1`), **not** the JBR or any Java 25/26 install. |
| `Could not GET https://dl.google.com/...` — connection timed out | dl.google.com is flaky on this network. Aliyun mirrors are already patched into `gen/android/build.gradle.kts` and `buildSrc/build.gradle.kts` (with `google()`/`mavenCentral()` kept as fallback). If `tauri android init` ever regenerates those files, re-apply the mirrors. |
| `failed to build AAB` / gradlew exits `-1073741502` after the APK is produced | Windows process-init flake on the optional Play-Store AAB step — the APK is already built and fine. Skip the AAB entirely with `npm run tauri -- android build --apk --target aarch64`. |
| `linker: no such file ... aarch64-linux-android` | `rustup target add aarch64-linux-android` (Step 4). |
| APK installs but is "not installed" | Old Android (< 7)? Tauri 2 needs API 24+. Also check storage space. |
| Camera scanner shows black box on device | Grant the app camera permission in Android settings, or rely on barcode text entry (the app's scanner uses `BarcodeDetector` where available, with manual entry fallback). |
