# Kiswahili full coverage — how to apply

## What was done

Every screen in **all three products** is now fully translated EN ⇄ Kiswahili:

- **Desktop POS (EXE)** — Login, Dashboard, POS, Onboarding, Inventory (all 3
  modals), Shifts, Records, Receipt printout, Alerts, Orders, Reports, Users,
  Subscription, Marketplace, Settings
- **Android APK** — same screens (identical codebase, rebuilt)
- **Web portals** — pharmacy dashboard + billing, HQ console (intelligence,
  billing, accounts, audit, downloads, messages, news, quotes, support, team,
  network), supplier portal (subscription, quote answers), error/gate screens

Language is switched with the **EN / SW** toggle (web: top bar; desktop:
Settings or sidebar). The choice is remembered per device.

## To apply the changes

### 1. Web portals — nothing to do

The code is pushed (commit `4fc68c3`). Your deploy picks it up automatically.
After deploying, verify: open the site, tap **SW** in the top bar, the whole
portal switches to Kiswahili.

### 2. Android APK — upload to HQ

File (already built & signed today):

```
C:\Users\user\AppData\Local\Temp\hq-drop\cervos-pos-0.2.3-arm64.apk
```

- HQ → Downloads → upload this file, platform **android**, version **0.2.3**
- Mark it **current** when asked
- Then on the phone: open cervos.online/download → download → install
  (allow "install unknown apps" if prompted)

### 3. Windows EXE — upload to HQ

File (already built today, includes all translations + sync fixes):

```
C:\Users\user\AppData\Local\Temp\hq-drop\Cervos POS_0.2.0_x64-setup.exe
```

- HQ → Downloads → upload, platform **windows**, version **0.2.0**
- Mark it **current**

## How translations work (for future edits)

- Desktop: `cervos-desktop/src/lib/i18n.ts` — one dictionary, `EN:` and `SW:`
  per key. Pages call `const { t } = useI18n()` then `t('key.name')`.
- Web: `src/lib/i18n/translations.ts` — same shape. Client components use
  `useI18n()`; server components use `await getT()`.
- When adding UI text, always add the key to both the EN and SW sides.
