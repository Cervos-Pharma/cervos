# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

Cervos Pharma serves **eight connected stakeholder groups** across the East African pharmaceutical and healthcare ecosystem from one unified platform:

1. **Patients (`patient`):** Finding verified in-stock medicines nearby, redeeming e-prescriptions (`claim_token`), reserving pickups, and reporting adverse effects.
2. **Business Owners (`pharmacy_owner`, `branch_manager`):** Operating single pharmacies or multi-branch groups with live P&L, shift accountability, PayMe billing, and staff governance.
3. **Business Operators (`superintendent_pharmacist`, `pharmaceutical_tech`, `pos_cashier`, `inventory_clerk`):** Fast offline-resilient checkout, FEFO dispensing, Schedule IV / prescription overrides, blind shift close, and Goods Received Note (GRN) stock intake.
4. **Regulators (`regulator_tmda`):** Permit verification (`tmda_permit`), controlled-substance audit trails, and instant batch recall quarantine commands.
5. **Researchers (`policy_researcher`):** De-identified medicine demand velocity, antimicrobial stewardship (WHO AWaRe), regional stockout pressure, ML forecasting, and digital-biology telemetry vectors.
6. **Hospitals (`hospital_pharmacist`):** Stockout early-warning radar, inter-facility emergency surplus transfers, and formulary replenishment.
7. **Suppliers (`supplier_admin`, `sales_account_mgr`, `warehouse_dispatcher`):** Wholesale catalog publishing, RFQ tender bidding, batch/expiry/COA dispatch (ASN), and escrow settlement.
8. **Prescribers (`physician_prescriber`):** MCT-licensed e-prescription origination (`claim_token`) with live pharmacy stock availability visibility.

## Product Purpose

End supply-chain fragmentation in digital pharmacy and medicine access by uniting point-of-sale execution, B2B wholesale replenishment, hospital stockout coordination, prescribing, and regulatory/research intelligence inside one congruent, offline-first system.

## Positioning

Apple-level simplicity on every front-line surface paired with Google-level interconnectedness across an immutable, clinically structured inventory and telemetry spine (`stock_movements`, FEFO batches, `claim_token`, WHO ATC/AWaRe intelligence).

## Operating Context

- East African pharmacies, ADDO outlets, hospital dispensaries, and pharmaceutical wholesalers operating on unreliable connectivity and mixed Windows/Android/Web hardware.
- Regulatory alignment with Tanzania TMDA batch/permit controls, Schedule IV vault tracking, TRA fiscal workflows, and bilingual English (`en`) / Swahili (`sw`) operation.

## Capabilities and Constraints

- Offline-first POS terminals must never rely on 5 MB browser `localStorage` blobs or lose unsynced sales when cashiers lock their PIN screen.
- Monetary math is strictly in integer `TZS` formatted uniformly without literal `$` or `TSh` drift.
- Shared domain truth (`@cervos/core`, `@cervos/db`, `@cervos/intelligence`, `@cervos/ui`, `@cervos/i18n`) compiles strictly across Web and Desktop targets within the monorepo.

## Brand Commitments

- Brand: **Cervos Pharma / Cervos OS**
- Primary Visual Identity: Clean clinical off-white surface (`#fcf8ff`), deep cobalt primary (`#1039b9`), clinical teal secondary (`#006875`), institutional dark-ink typography (`#1a1a2e`), crisp notch geometry where intentionally invoked, zero visual bloat.

## Product Principles

1. **One Coherent System:** Every portal, terminal, and role views the same live domain objects—no disconnected prototypes.
2. **Offline Safety & Cash Truth First:** Durable local persistence, push-before-pull sync, strict FEFO expiry blocking, and blind cash shift variance take priority over decorative features.
3. **Calm Operational Precision:** Fast keyboard/barcode workflows, instant feedback, zero browser `alert()`/`confirm()` traps.
4. **Intelligence Built Into the Spine:** Every dispensed unit cleanly feeds velocity forecasting, hospital stockout transfers, and anonymized research/digital-biology vectors.

