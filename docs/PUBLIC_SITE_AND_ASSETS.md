# Cervos Pharma Public Site, Routes, Assets & Link Architecture

## 1. Public Route Inventory

| Route | Source File | Purpose | Notes |
| --- | --- | --- | --- |
| `/` | `src/app/page.tsx` | Primary marketing landing page | Hero collage, chain overview, field showcase, live Tanzania globe, OS-detected download card, partner ribbon, support desk |
| `/products` | `src/app/products/page.tsx` | Hardware & solution showcase + pricing calculator | Zig-zag edge-bleeding mockups, tilted dual phone stage, interactive `SubscriptionCalculator` (`#calculator-focus`), floating focus modal (`?focus=counter\|shelf\|wholesale`) |
| `/markets` | `src/app/markets/page.tsx` | Market outcomes & audience overview | Editorial reasons across Pharmacies, Suppliers, Clinics, Researchers, and Investors with floating focus modal (`?focus=...`) |
| `/dispatch` | `src/app/dispatch/page.tsx` | **The Dispatch** editorial journal index | Centered serif masthead in Cervos palette (`#F8FAFC` / `#FFFFFF` / `#1039B9`), votable upvotes (no downvote counts shown), share links, topic/sort filters |
| `/dispatch/[slug]` | `src/app/dispatch/[slug]/page.tsx` | Dedicated Dispatch essay reader page | Standalone longform reading layout with people photography, pull quotes, live upvote/downvote/share bar, next essay navigation |
| `/help` | `src/app/help/page.tsx` | Dedicated Help Center | Searchable & filterable pharmacy/hardware/`Kasri` guides + embedded `<SupportHelpSection />` ticket form |
| `/contact` | `src/app/contact/page.tsx` | Dedicated Contact HQ page | Dar es Salaam HQ info, direct support mailto, partner enquiry shortcut, embedded ticket desk |
| `/downloads` | `src/app/downloads/page.tsx` | All-platform installers directory | Highlights visitor's detected platform and lists Mobile (PWA), Windows, Linux, and macOS builds cleanly |
| `/about` | `src/app/about/page.tsx` | Medicine Chain Overview | Introduces the 8 connected chain participants with links to company profile & partners |
| `/about/company` | `src/app/about/company/page.tsx` | Cervos Pharma company mission & milestones | Brand narrative, principles, and milestones |
| `/partners` | `src/app/partners/page.tsx` | Partners Showcase & Enquiry Desk | Concentric right-edge counter-rotating orbit showcase, partner categories, and partnership enquiry form |
| `/auth` | `src/app/auth/page.tsx` | Interactive Onboarding & Sign In | Multi-step role onboarding with synced left stage visuals, `AuthOrthographicGlobe`, compact responsive language toggle, legal & `AuthHelpModal` dialogs |

Legacy detail routes (`/products/[slug]`, `/markets/[slug]` driven by `src/lib/marketing-catalog.ts`) remain online for direct fallback navigation.

---

## 2. Shared Public Component Map

| Component | Path | Responsibility |
| --- | --- | --- |
| `PublicNav` | `src/components/PublicNav.tsx` | Top nav bar separating label route `<Link>` from chevron dropdown `<button>`, desktop segmented `EN\|SW`, compact mobile translate icon button, and full mobile accordion drawer |
| `ForegroundModal` | `src/components/ForegroundModal.tsx` | Portal overlay (`createPortal(..., document.body)`) centering modals in the active viewport with scroll lock, focus restoration, `Escape`, and backdrop outside-click dismissal |
| `AppleHardwareMockups` | `src/components/AppleHardwareMockups.tsx` | Seamless edge-bleeding `DesktopStudioBezel` & `AluminumTabletMockup`, equal-scale tilted white-screen `AppleIPhoneMockup` & `TitaniumPhoneMockup`, `UbuntuKioskBezel`, `MacBookOwnerBezel`, and `ProductWalkthroughModal` |
| `ProductSuiteMockups` | `src/components/ProductSuiteMockups.tsx` | Orchestrates the 5 hardware bands, genealogy selector, walkthrough modals, and floating product spotlight modal |
| `SubscriptionCalculator` | `src/components/SubscriptionCalculator.tsx` | Stripe/Linear-inspired TZS pricing calculator across Single Shop & Enterprise tracks with preset dropdown, numeric stepper, and slider |
| `DispatchInteractions` | `src/components/DispatchInteractions.tsx` | Client-persisted upvote counter (hides numeric downvote count), downvote toggle, and native share / clipboard URL copy |
| `TanzaniaGlobe` & `AuthStageVisuals` | `src/components/TanzaniaGlobe.tsx`, `src/components/AuthStageVisuals.tsx` | Unified `21.5deg` tilted Three.js / WebGL Tanzania corridor mesh globes (`GLOBE_SHARED_TOKENS`) and onboarding visual stages |
| `PartnersTaperRibbon` & `SupportHelpSection` | `src/components/PartnersTaperRibbon.tsx`, `src/components/SupportHelpSection.tsx` | Seamless scrolling partner marquee and FAQ + `submitSupportTicket` desk |
| `AuthHelpModal` | `src/components/AuthHelpModal.tsx` | Focus onboarding FAQ accordion + support ticket submission dialog inside `/auth` |

---

## 3. Data Catalogs

- `src/lib/landing-data.ts`: Exports `PlatformBuildId`, `detectClientPlatform()`, and `getDownloadBuilds(isSw)`.
- `src/lib/dispatch-catalog.ts`: Bilingual **The Dispatch** essays (`rainy-evening-kariakoo`, `quiet-shelf-capital`, `trust-along-corridor`), author metadata, base upvote counts, and `getDispatchEssayBySlug(slug)`.
- `src/lib/marketing-catalog.ts`: Bilingual `PRODUCT_CATALOG` and `MARKET_CATALOG` records supporting legacy detail routes.

---

## 4. `public/` Asset Catalog & Cleanup Log

### Active Brand Logos & Icons
- `public/cervos-company-logo-circular.svg`: Primary brand mark (used across navbars, globe cards, phone screens, and footers)
- `public/cervos-product-logo-circular.svg`: Product circular badge (Home hero orbit center and Auth stages)
- `public/cervos-company-logo-circular-dark.svg`, `public/cervos-company-logo-transparent.svg`, `public/cervos-product-logo-transparent.svg`: SVG logo kit variants retained (`< 3 KB` each)
- `public/logo.png`, `public/apple-touch-icon.png`: OpenGraph and Apple PWA touch icons

### Documentary People Photography (Active)
- `public/cervos-people-counter.jpg`: Neighborhood pharmacist handing a paper bag to a smiling customer over the counter (Home hero & `#field`, `/markets` hero & Pharmacies row, `/about/company`, `/contact`, `/dispatch`)
- `public/cervos-people-stockroom.jpg`: Pharmacy stockroom attendant inspecting incoming cartons on smartphone (`Home #field`, `/markets` Clinics row, `/help` hero, `/dispatch`)
- `public/cervos-people-delivery.jpg`: Delivery driver and pharmacy shopkeeper checking boxes beside van (`Home hero & #field`, `/markets` Suppliers row, `/about` hero, `/partners` hero backdrop, `/dispatch`)

### Dispensary, Logistics & Hardware Studio Photography (Active)
- `public/cervos-counter-station.jpg`: Checkout counter workstation scene (`/products` hero, `/downloads` hero, `/markets` Investors row, `walkthroughGuides`)
- `public/cervos-dispensary-desk.jpg`: Clean pharmacy shelf and consultation scene (`/markets` Researchers row, `walkthroughGuides`)
- `public/cervos-fleet-van.jpg`: Branded distribution van scene (`walkthroughGuides`)
- `public/cervos-hardware-desktop.jpg`: Studio HP Windows + MacBook workstation render (`/products` Band 1 bleed)
- `public/cervos-hardware-tablet.jpg`: Studio landscape tablet dispatch render (`/products` Band 3 bleed)
- `public/cervos-hardware-phone.jpg`: Studio phone render referenced inside `walkthroughGuides` scenes in `ProductSuiteMockups.tsx`

### Fonts & System Assets
- `public/fonts/Outfit-SemiBold.ttf`, `public/fonts/material-symbols-outlined.woff2`, `public/sw.js`, `public/security.txt`

### Removed / Legacy Assets Audit
- Deleted `public/pharmacist-1.png` (1.32 MB stale prototype, `0` code references anywhere).
- Retained `public/pharmacist-2.png` temporarily only because deprecated `src/_legacy_frontend/supplier/quote/page.tsx` still references it; can be deleted once `_legacy_frontend/` is retired.

---

## 5. Pending Cross-Site Link Alignment Plan (Next Pass)

1. **Footer Consistency**: Standardize bottom footers across `/`, `/products`, `/markets`, `/about`, `/about/company`, `/partners`, `/downloads`, `/help`, `/dispatch`, and `/contact` so **The Dispatch** (`/dispatch`), **Help** (`/help`), **Downloads** (`/downloads`), and **Contacts** (`/contact`) appear consistently everywhere (replacing remaining `/#support` and `#focus` footer anchors on `/`).
2. **Auth Role Query Normalization**: Align all `?role=` query links (`role=pharmacy`, `role=supplier`, `role=clinics` / `dispensary`, `role=researcher`, `role=investor`) cleanly with `AuthPageInner` initial state in `src/app/auth/page.tsx`.
3. **Subpage Convergence**: Decide whether `/products/[slug]` (`counter-pos`, `shelf-control`, `wholesale`) and `/markets/[slug]` (`pharmacies`, `suppliers`, `clinics`) redirect straight to `/products?focus=...` and `/markets?focus=...` or update their footer/secondary links cleanly away from `/markets/pharmacies` and `/#network`.
