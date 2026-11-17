# Cervos OS — Connected Pharmacy & Clinical Supply Platform

Unified pnpm monorepo powering the **8-Stakeholder Connected Cervos OS** across Web (Next.js App Router), POS Desktop & Android (`cervos-desktop` Tauri v2 + SQLite), and Supplier Portal Desktop (`cervos-supplier-desktop` Tauri v2).

## Workspace Layout

```text
cervos/
├── packages/
│   ├── core/          # Clinical & commercial primitives (8-role RBAC, FEFO, GS1, TZS money, shifts)
│   ├── db/            # Shared Zod schemas & domain contracts
│   ├── i18n/          # Bilingual EN / SW dictionary
│   ├── intelligence/  # EWMA demand forecasting, draft POs, anonymized telemetry, hospital transfers
│   ├── textify/       # Server-side Textify Africa SMS, WhatsApp & OTP adapter
│   └── ui/            # Shared clinical UI primitives (<Money />, <ExpiryBadge />, <CervosCommandBar />)
├── src/               # Next.js 16 web portals (/dashboard, /branch, /supplier, /hq, /ecosystem) & API routes
├── cervos-desktop/    # Offline-first POS terminal (Windows/macOS/Linux + Android APK)
├── cervos-supplier-desktop/  # B2B supplier fulfillment & dispatch desktop app
├── sql/               # Base cloud schema (`00_hq_schema_requirements.sql`), seeds (`01_*`), migrations/
├── docs/              # Architecture, setup, sync, PWA, mobile onboarding & Textify docs
└── scripts/           # Environment, i18n parity, responsive checks & local dev scripts
```

## Documentation & Specifications

- Product charter & user journeys: [PRODUCT.md](./PRODUCT.md)
- Interface & visual craft tokens: [DESIGN.md](./DESIGN.md)
- Architecture & sync contracts: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- Local setup & env validation: [docs/SETUP.md](./docs/SETUP.md) | [docs/LOCAL_MOCK_MODE.md](./docs/LOCAL_MOCK_MODE.md)
- Textify Africa SMS & OTP contract: [docs/TEXTIFY.md](./docs/TEXTIFY.md)

## Quick Start & Verification

```bash
# 1. Verify environment configuration
npm run check:env

# 2. Run local web portals with zero external backend (mock mode)
npm run dev:mock

# 3. Type-check Web + both Tauri desktop workspaces
npx tsc --noEmit
npx tsc -p cervos-desktop/tsconfig.json --noEmit
npx tsc -p cervos-supplier-desktop/tsconfig.json --noEmit

# 4. Run tests & EN/SW i18n parity check
npx vitest run
node scripts/audit-i18n.js
```

