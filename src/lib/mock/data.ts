/**
 * @file lib/mock/data.ts
 * @description In-memory mock dataset for the fully-local UI/UX smoke-test mode
 *   (`NEXT_PUBLIC_MOCK_MODE=true`, started via `npm run dev:mock`).
 *
 * The dataset mirrors the real Supabase schema (accounts, branches, operators,
 * installs, products, batches, sales, activity_log, support_tickets,
 * quote_requests, supplier_catalog, orders, order_line_items, app_releases,
 * user_profiles, hq_admins, payment_settings) so every page — HQ Console and
 * both user portals — renders with believable Tanzanian pharmacy data.
 *
 * All ids are readable slugs so URLs like /hq/accounts/acc-uzuri make sense.
 * Timestamps are computed relative to "now" so dashboards always show fresh
 * data on any day you run it.
 *
 * NOTE: This is a *mutable, per-process* store — HQ actions (suspend, lock,
 * extend trial, etc.) really mutate this data while the dev server runs.
 * Restart `npm run dev:mock` to reset it.
 */

export type MockRow = Record<string, unknown>;
export type MockTable = Record<string, MockRow[]>;

const DAY = 86400000;
const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();
const fut = (daysAhead: number) => new Date(Date.now() + daysAhead * DAY).toISOString();

/** Known sign-in credentials for the mock web portals (see TEST_LOCAL.md). */
export const MOCK_AUTH_USERS: {
  id: string;
  email: string;
  password: string;
  account_type: "pharmacy" | "supplier";
  full_name: string;
}[] = [
  {
    id: "user-pharm",
    email: "demo.pharmacy@cervos.test",
    password: "Pharmacy@2026!",
    account_type: "pharmacy",
    full_name: "Demo Pharmacy Owner",
  },
  {
    id: "user-supplier",
    email: "demo.supplier@cervos.test",
    password: "Supplier@2026!",
    account_type: "supplier",
    full_name: "Demo Supplier Admin",
  },
];

export const MOCK_HQ_ADMIN_EMAIL = "admin@cervos.co";
export const MOCK_HQ_ADMIN_PASSWORD = "Cervos2026!";
export const MOCK_HQ_SUPPORT_EMAIL = "support@cervos.co";
export const MOCK_HQ_SUPPORT_PASSWORD = "Support@2026!";

/** Operator PINs used across demo branches (plaintext only here for reference). */
export const MOCK_OPERATOR_PINS = ["1234", "2345", "3456", "4567", "5678"];

/**
 * Builds the full mock dataset. Each call returns a fresh copy so tests are
 * repeatable; the runtime singleton keeps a single instance per dev server.
 */
export function createMockData(): MockTable {
  // ── Accounts ───────────────────────────────────────────────────────────────
  const accounts = [
    {
      id: "acc-uzuri",
      name: "Uzuri Pharmacy",
      type: "pharmacy",
      billing_status: "active",
      download_enabled: true,
      subscription_status: "active",
      subscription_expires_at: fut(20),
      verified: true,
      suspended_at: null,
      suspension_reason: null,
      auth_user_id: "user-pharm",
      created_at: iso(320 * DAY),
    },
    {
      id: "acc-neema",
      name: "Neema Chemists",
      type: "pharmacy",
      billing_status: "active",
      download_enabled: false,
      subscription_status: "trial",
      subscription_expires_at: null,
      verified: false,
      suspended_at: null,
      suspension_reason: null,
      auth_user_id: null,
      created_at: iso(40 * DAY),
    },
    {
      id: "acc-baraka",
      name: "Baraka Pharmacy",
      type: "pharmacy",
      billing_status: "inactive",
      download_enabled: true,
      subscription_status: "grace",
      subscription_expires_at: null,
      verified: false,
      suspended_at: null,
      suspension_reason: null,
      auth_user_id: null,
      created_at: iso(160 * DAY),
    },
    {
      id: "acc-imani",
      name: "Imani Pharmacy",
      type: "pharmacy",
      billing_status: "inactive",
      download_enabled: false,
      subscription_status: "locked",
      subscription_expires_at: iso(5 * DAY),
      verified: false,
      suspended_at: iso(3 * DAY),
      suspension_reason: "Payment dispute under review with support.",
      auth_user_id: null,
      created_at: iso(220 * DAY),
    },
    {
      id: "acc-afya",
      name: "Afya Wholesale Ltd",
      type: "supplier",
      billing_status: "active",
      download_enabled: false,
      subscription_status: "active",
      subscription_expires_at: fut(28),
      verified: true,
      suspended_at: null,
      suspension_reason: null,
      auth_user_id: "user-supplier",
      created_at: iso(300 * DAY),
    },
    {
      id: "acc-tibu",
      name: "Tibu Distributors",
      type: "supplier",
      billing_status: "active",
      download_enabled: false,
      subscription_status: "active",
      subscription_expires_at: fut(14),
      verified: true,
      suspended_at: null,
      suspension_reason: null,
      auth_user_id: null,
      created_at: iso(180 * DAY),
    },
    {
      id: "acc-furaha",
      name: "Furaha Pharma Supply",
      type: "supplier",
      billing_status: "active",
      download_enabled: false,
      subscription_status: "trial",
      subscription_expires_at: null,
      verified: false,
      suspended_at: null,
      suspension_reason: null,
      auth_user_id: null,
      created_at: iso(25 * DAY),
    },
    {
      id: "acc-mazingira",
      name: "Mazingira Medics",
      type: "supplier",
      billing_status: "inactive",
      download_enabled: false,
      subscription_status: "locked",
      subscription_expires_at: iso(12 * DAY),
      verified: false,
      suspended_at: null,
      suspension_reason: null,
      auth_user_id: null,
      created_at: iso(95 * DAY),
    },
  ];

  // ── User profiles ──────────────────────────────────────────────────────────
  const user_profiles = [
    {
      account_id: "acc-uzuri",
      contact_name: "Amina Hassan",
      phone: "+255 712 000 001",
      region: "Dar es Salaam",
      role: "Owner",
      tech_comfort: "comfortable",
      goals: ["Grow to 3 branches", "Reduce stockouts", "Go paperless"],
      onboarding_completed_at: iso(300 * DAY),
      last_active_at: iso(0.2 * DAY),
      updated_at: iso(0.2 * DAY),
    },
    {
      account_id: "acc-neema",
      contact_name: "John Mushi",
      phone: "+255 756 000 002",
      region: "Mwanza",
      role: "Manager",
      tech_comfort: "needs_help",
      goals: ["Track expiry dates", "Understand sales reports"],
      onboarding_completed_at: null,
      last_active_at: iso(6 * DAY),
      updated_at: iso(6 * DAY),
    },
    {
      account_id: "acc-baraka",
      contact_name: "Grace Ndege",
      phone: "+255 783 000 003",
      region: "Arusha",
      role: "Pharmacist in charge",
      tech_comfort: "comfortable",
      goals: ["Automate reorders"],
      onboarding_completed_at: iso(140 * DAY),
      last_active_at: iso(14 * DAY),
      updated_at: iso(14 * DAY),
    },
    {
      account_id: "acc-imani",
      contact_name: "Peter Kileo",
      phone: "+255 745 000 004",
      region: "Dodoma",
      role: "Owner",
      tech_comfort: "needs_help",
      goals: [],
      onboarding_completed_at: null,
      last_active_at: iso(60 * DAY),
      updated_at: iso(60 * DAY),
    },
    {
      account_id: "acc-afya",
      contact_name: "Salma Juma",
      phone: "+255 719 000 005",
      region: "Dar es Salaam",
      role: "Sales Director",
      tech_comfort: "expert",
      goals: ["Win 50 pharmacy buyers", "Digitize order pipeline"],
      onboarding_completed_at: iso(280 * DAY),
      last_active_at: iso(0.5 * DAY),
      updated_at: iso(0.5 * DAY),
    },
    {
      account_id: "acc-tibu",
      contact_name: "Issa Mwakyusa",
      phone: "+255 762 000 006",
      region: "Tanga",
      role: "General Manager",
      tech_comfort: "comfortable",
      goals: ["Grow wholesale revenue"],
      onboarding_completed_at: iso(170 * DAY),
      last_active_at: iso(3 * DAY),
      updated_at: iso(3 * DAY),
    },
    {
      account_id: "acc-furaha",
      contact_name: "Rehema Swalehe",
      phone: "+255 774 000 007",
      region: "Zanzibar",
      role: "Owner",
      tech_comfort: "needs_help",
      goals: ["Launch online catalog"],
      onboarding_completed_at: null,
      last_active_at: iso(9 * DAY),
      updated_at: iso(9 * DAY),
    },
    {
      account_id: "acc-mazingira",
      contact_name: "Oscar Mkude",
      phone: "+255 733 000 008",
      region: "Morogoro",
      role: "Manager",
      tech_comfort: "comfortable",
      goals: [],
      onboarding_completed_at: iso(90 * DAY),
      last_active_at: iso(30 * DAY),
      updated_at: iso(30 * DAY),
    },
  ];

  // ── Branches ───────────────────────────────────────────────────────────────
  const branches = [
    {
      id: "br-uzuri-cbd",
      account_id: "acc-uzuri",
      name: "Uzuri CBD Branch",
      lat: -6.8137,
      lng: 39.2819,
      subscription_status: "active",
      trial_ends_at: null,
      payment_due_at: null,
      grace_ends_at: null,
      unlock_requested_at: null,
      manually_unlocked_at: null,
      locked_manually_at: null,
      last_synced_at: iso(0.1 * DAY),
      updated_at: iso(0.1 * DAY),
      created_at: iso(300 * DAY),
    },
    {
      id: "br-uzuri-kariakoo",
      account_id: "acc-uzuri",
      name: "Uzuri Kariakoo Branch",
      lat: -6.8217,
      lng: 39.2834,
      subscription_status: "active",
      trial_ends_at: null,
      payment_due_at: null,
      grace_ends_at: null,
      unlock_requested_at: null,
      manually_unlocked_at: null,
      locked_manually_at: null,
      last_synced_at: iso(0.3 * DAY),
      updated_at: iso(0.3 * DAY),
      created_at: iso(120 * DAY),
    },
    {
      id: "br-uzuri-mikocheni",
      account_id: "acc-uzuri",
      name: "Uzuri Mikocheni Branch",
      lat: -6.771,
      lng: 39.257,
      subscription_status: "trial",
      trial_ends_at: fut(9),
      payment_due_at: null,
      grace_ends_at: null,
      unlock_requested_at: null,
      manually_unlocked_at: null,
      locked_manually_at: null,
      last_synced_at: iso(2 * DAY),
      updated_at: iso(2 * DAY),
      created_at: iso(10 * DAY),
    },
    {
      id: "br-neema-central",
      account_id: "acc-neema",
      name: "Neema Central",
      lat: -2.5166,
      lng: 32.9017,
      subscription_status: "trial",
      trial_ends_at: fut(4),
      payment_due_at: null,
      grace_ends_at: null,
      unlock_requested_at: iso(1 * DAY),
      manually_unlocked_at: null,
      locked_manually_at: null,
      last_synced_at: null,
      updated_at: iso(1 * DAY),
      created_at: iso(40 * DAY),
    },
    {
      id: "br-baraka-njiro",
      account_id: "acc-baraka",
      name: "Baraka Njiro",
      lat: -3.3961,
      lng: 36.7904,
      subscription_status: "locked",
      trial_ends_at: iso(2 * DAY),
      payment_due_at: iso(10 * DAY),
      grace_ends_at: iso(2 * DAY),
      unlock_requested_at: iso(3 * DAY),
      manually_unlocked_at: null,
      locked_manually_at: null,
      last_synced_at: iso(4 * DAY),
      updated_at: iso(3 * DAY),
      created_at: iso(160 * DAY),
    },
    {
      id: "br-imani-main",
      account_id: "acc-imani",
      name: "Imani Main",
      lat: -6.163,
      lng: 35.7516,
      subscription_status: "locked",
      trial_ends_at: null,
      payment_due_at: iso(30 * DAY),
      grace_ends_at: iso(15 * DAY),
      unlock_requested_at: null,
      manually_unlocked_at: null,
      locked_manually_at: iso(3 * DAY),
      last_synced_at: iso(6 * DAY),
      updated_at: iso(3 * DAY),
      created_at: iso(220 * DAY),
    },
    {
      id: "br-afya-ubungo",
      account_id: "acc-afya",
      name: "Afya Ubungo Warehouse",
      lat: -6.79,
      lng: 39.208,
      subscription_status: "active",
      trial_ends_at: null,
      payment_due_at: null,
      grace_ends_at: null,
      unlock_requested_at: null,
      manually_unlocked_at: null,
      locked_manually_at: null,
      last_synced_at: iso(0.2 * DAY),
      updated_at: iso(0.2 * DAY),
      created_at: iso(300 * DAY),
    },
    {
      id: "br-afya-temeke",
      account_id: "acc-afya",
      name: "Afya Temeke Depot",
      lat: -6.895,
      lng: 39.276,
      subscription_status: "active",
      trial_ends_at: null,
      payment_due_at: null,
      grace_ends_at: null,
      unlock_requested_at: null,
      manually_unlocked_at: null,
      locked_manually_at: null,
      last_synced_at: iso(1 * DAY),
      updated_at: iso(1 * DAY),
      created_at: iso(90 * DAY),
    },
    {
      id: "br-tibu-tanga",
      account_id: "acc-tibu",
      name: "Tibu Tanga Depot",
      lat: -5.0667,
      lng: 39.1,
      subscription_status: "active",
      trial_ends_at: null,
      payment_due_at: null,
      grace_ends_at: null,
      unlock_requested_at: null,
      manually_unlocked_at: null,
      locked_manually_at: null,
      last_synced_at: iso(2 * DAY),
      updated_at: iso(2 * DAY),
      created_at: iso(180 * DAY),
    },
    {
      id: "br-furaha-stonetown",
      account_id: "acc-furaha",
      name: "Furaha Stone Town",
      lat: -6.1636,
      lng: 39.1952,
      subscription_status: "trial",
      trial_ends_at: fut(18),
      payment_due_at: null,
      grace_ends_at: null,
      unlock_requested_at: null,
      manually_unlocked_at: null,
      locked_manually_at: null,
      last_synced_at: null,
      updated_at: iso(1 * DAY),
      created_at: iso(25 * DAY),
    },
  ];

  // ── Operators ──────────────────────────────────────────────────────────────
  const operators = [
    { id: "op-uzuri-cbd-1", branch_id: "br-uzuri-cbd", name: "Amina Hassan", pin_hash: "sha256:1234", role: "owner", created_at: iso(300 * DAY) },
    { id: "op-uzuri-cbd-2", branch_id: "br-uzuri-cbd", name: "Daudi Malima", pin_hash: "sha256:2345", role: "pharmacist_in_charge", created_at: iso(280 * DAY) },
    { id: "op-uzuri-cbd-3", branch_id: "br-uzuri-cbd", name: "Zainab Ali", pin_hash: "sha256:3456", role: "cashier", created_at: iso(200 * DAY) },
    { id: "op-uzuri-kar-1", branch_id: "br-uzuri-kariakoo", name: "Joseph Lema", pin_hash: "sha256:1234", role: "pharmacist_in_charge", created_at: iso(110 * DAY) },
    { id: "op-uzuri-kar-2", branch_id: "br-uzuri-kariakoo", name: "Fatuma Said", pin_hash: "sha256:2345", role: "cashier", created_at: iso(90 * DAY) },
    { id: "op-neema-1", branch_id: "br-neema-central", name: "John Mushi", pin_hash: "sha256:1234", role: "owner", created_at: iso(40 * DAY) },
    { id: "op-baraka-1", branch_id: "br-baraka-njiro", name: "Grace Ndege", pin_hash: "sha256:1234", role: "pharmacist_in_charge", created_at: iso(150 * DAY) },
    { id: "op-afya-1", branch_id: "br-afya-ubungo", name: "Salma Juma", pin_hash: "sha256:1234", role: "owner", created_at: iso(290 * DAY) },
    { id: "op-afya-2", branch_id: "br-afya-ubungo", name: "Hamisi Kimaro", pin_hash: "sha256:4567", role: "pharmacist_in_charge", created_at: iso(270 * DAY) },
    { id: "op-afya-3", branch_id: "br-afya-temeke", name: "Neema Pallangyo", pin_hash: "sha256:5678", role: "pharmacist_in_charge", created_at: iso(85 * DAY) },
    { id: "op-tibu-1", branch_id: "br-tibu-tanga", name: "Issa Mwakyusa", pin_hash: "sha256:1234", role: "owner", created_at: iso(175 * DAY) },
  ];

  // ── Installs ───────────────────────────────────────────────────────────────
  const installs = [
    { id: "ins-1", branch_id: "br-uzuri-cbd", device_fingerprint: "fp-uzuri-cbd-01", activated_at: iso(280 * DAY), last_synced_at: iso(0.1 * DAY) },
    { id: "ins-2", branch_id: "br-uzuri-cbd", device_fingerprint: "fp-uzuri-cbd-02", activated_at: iso(60 * DAY), last_synced_at: iso(0.5 * DAY) },
    { id: "ins-3", branch_id: "br-uzuri-kariakoo", device_fingerprint: "fp-uzuri-kar-01", activated_at: iso(100 * DAY), last_synced_at: iso(0.3 * DAY) },
    { id: "ins-4", branch_id: "br-uzuri-mikocheni", device_fingerprint: "fp-uzuri-mik-01", activated_at: iso(9 * DAY), last_synced_at: iso(2 * DAY) },
    { id: "ins-5", branch_id: "br-afya-ubungo", device_fingerprint: "fp-afya-ub-01", activated_at: iso(290 * DAY), last_synced_at: iso(0.2 * DAY) },
    { id: "ins-6", branch_id: "br-afya-temeke", device_fingerprint: "fp-afya-tem-01", activated_at: iso(80 * DAY), last_synced_at: iso(1 * DAY) },
    { id: "ins-7", branch_id: "br-tibu-tanga", device_fingerprint: "fp-tibu-01", activated_at: iso(150 * DAY), last_synced_at: iso(2 * DAY) },
  ];

  // ── Products (master catalog) ──────────────────────────────────────────────
  const products = [
    { id: "prod-1", generic_name: "Amoxicillin 500mg", brand_name: "Amoxil", category: "Antibiotics", requires_prescription: true, created_at: iso(365 * DAY), updated_at: iso(30 * DAY) },
    { id: "prod-2", generic_name: "Paracetamol 500mg", brand_name: "Panadol", category: "Analgesics", requires_prescription: false, created_at: iso(365 * DAY), updated_at: iso(30 * DAY) },
    { id: "prod-3", generic_name: "Artemether/Lumefantrine", brand_name: "Coartem", category: "Antimalarials", requires_prescription: true, created_at: iso(365 * DAY), updated_at: iso(30 * DAY) },
    { id: "prod-4", generic_name: "Metformin 500mg", brand_name: "Glucophage", category: "Diabetes", requires_prescription: true, created_at: iso(300 * DAY), updated_at: iso(20 * DAY) },
    { id: "prod-5", generic_name: "Vitamin C 250mg", brand_name: "Redoxon", category: "Supplements", requires_prescription: false, created_at: iso(300 * DAY), updated_at: iso(20 * DAY) },
    { id: "prod-6", generic_name: "Oral Rehydration Salts", brand_name: "ORASEL", category: "Rehydration", requires_prescription: false, created_at: iso(280 * DAY), updated_at: iso(15 * DAY) },
    { id: "prod-7", generic_name: "Ibuprofen 400mg", brand_name: "Brufen", category: "Analgesics", requires_prescription: false, created_at: iso(280 * DAY), updated_at: iso(15 * DAY) },
    { id: "prod-8", generic_name: "Cetirizine 10mg", brand_name: "Zyrtec", category: "Antihistamines", requires_prescription: false, created_at: iso(250 * DAY), updated_at: iso(15 * DAY) },
    { id: "prod-9", generic_name: "Zinc Sulphate 20mg", brand_name: "Zindol", category: "Supplements", requires_prescription: false, created_at: iso(250 * DAY), updated_at: iso(10 * DAY) },
    { id: "prod-10", generic_name: "Salbutamol Inhaler", brand_name: "Ventolin", category: "Respiratory", requires_prescription: true, created_at: iso(220 * DAY), updated_at: iso(10 * DAY) },
  ];

  // ── Batches (per-branch stock with expiry, some expiring soon) ─────────────
  const expiry = (daysFromNow: number) => new Date(Date.now() + daysFromNow * DAY).toISOString().slice(0, 10);
  const batches = [
    { id: "bat-1", branch_id: "br-uzuri-cbd", product_id: "prod-2", quantity: 120, cost_price: 1800, sale_price: 2500, expiry_date: expiry(60), created_at: iso(20 * DAY), updated_at: iso(5 * DAY) },
    { id: "bat-2", branch_id: "br-uzuri-cbd", product_id: "prod-3", quantity: 45, cost_price: 5200, sale_price: 6800, expiry_date: expiry(12), created_at: iso(40 * DAY), updated_at: iso(3 * DAY) },
    { id: "bat-3", branch_id: "br-uzuri-cbd", product_id: "prod-1", quantity: 80, cost_price: 4200, sale_price: 5500, expiry_date: expiry(25), created_at: iso(30 * DAY), updated_at: iso(4 * DAY) },
    { id: "bat-4", branch_id: "br-uzuri-cbd", product_id: "prod-5", quantity: 200, cost_price: 900, sale_price: 1400, expiry_date: expiry(90), created_at: iso(10 * DAY), updated_at: iso(1 * DAY) },
    { id: "bat-5", branch_id: "br-uzuri-kariakoo", product_id: "prod-2", quantity: 60, cost_price: 1800, sale_price: 2500, expiry_date: expiry(75), created_at: iso(25 * DAY), updated_at: iso(2 * DAY) },
    { id: "bat-6", branch_id: "br-uzuri-kariakoo", product_id: "prod-6", quantity: 150, cost_price: 500, sale_price: 900, expiry_date: expiry(10), created_at: iso(15 * DAY), updated_at: iso(2 * DAY) },
    { id: "bat-7", branch_id: "br-uzuri-mikocheni", product_id: "prod-7", quantity: 90, cost_price: 1500, sale_price: 2100, expiry_date: expiry(45), created_at: iso(8 * DAY), updated_at: iso(1 * DAY) },
    { id: "bat-8", branch_id: "br-neema-central", product_id: "prod-4", quantity: 30, cost_price: 4600, sale_price: 5900, expiry_date: expiry(18), created_at: iso(20 * DAY), updated_at: iso(6 * DAY) },
    { id: "bat-9", branch_id: "br-baraka-njiro", product_id: "prod-8", quantity: 110, cost_price: 700, sale_price: 1200, expiry_date: expiry(80), created_at: iso(12 * DAY), updated_at: iso(2 * DAY) },
  ];

  // ── Sales + sale_items (spread over ~60 days so revenue charts look real) ──
  const sales = [] as MockRow[];
  const sale_items = [] as MockRow[];
  const sellerBranch = ["br-uzuri-cbd", "br-uzuri-kariakoo", "br-uzuri-mikocheni", "br-afya-ubungo"];
  const sellerOperators = ["op-uzuri-cbd-1", "op-uzuri-cbd-2", "op-uzuri-cbd-3", "op-uzuri-kar-1", "op-uzuri-kar-2", "op-afya-1"];
  let saleSeq = 0;
  for (let i = 0; i < 42; i++) {
    const branchId = sellerBranch[i % sellerBranch.length];
    const operatorId = sellerOperators[i % sellerOperators.length];
    const lineItems = 1 + (i % 3);
    let total = 0;
    const items = [] as { batch: MockRow; qty: number }[];
    for (let li = 0; li < lineItems; li++) {
      const batch = batches[(i * 3 + li) % batches.length];
      const qty = 1 + ((i + li) % 3);
      total += Number(batch.sale_price) * qty;
      items.push({ batch, qty });
    }
    saleSeq += 1;
    const created = iso((i % 60) * DAY + i * 37 * 60000);
    sales.push({
      id: `sale-${saleSeq}`,
      branch_id: branchId,
      operator_id: operatorId,
      total: Math.round(total),
      payment_method: ["cash", "mpesa", "card", "tigo", "halopesa"][i % 5],
      payment_ref: i % 5 === 1 ? `MP${saleSeq}${i}${i}` : null,
      created_at: created,
      synced_at: created,
    });
    items.forEach((it, idx) => {
      sale_items.push({
        id: `si-${saleSeq}-${idx}`,
        sale_id: `sale-${saleSeq}`,
        batch_id: it.batch.id,
        quantity: it.qty,
        unit_price: it.batch.sale_price,
      });
    });
  }

  // ── Activity log ───────────────────────────────────────────────────────────
  const activity_log = [
    { id: "act-1", branch_id: "br-uzuri-cbd", operator_id: "op-uzuri-cbd-1", actor: "Amina Hassan", action: "terminal_unlocked", entity_type: "terminal", entity_id: "br-uzuri-cbd", detail: { method: "pin" }, created_at: iso(0.2 * DAY) },
    { id: "act-2", branch_id: "br-uzuri-cbd", operator_id: "op-uzuri-cbd-3", actor: "Zainab Ali", action: "sale_created", entity_type: "sale", entity_id: "sale-42", detail: { total: 8200, payment: "mpesa" }, created_at: iso(0.4 * DAY) },
    { id: "act-3", branch_id: "br-uzuri-cbd", operator_id: null, actor: "system", action: "sync_completed", entity_type: "branch", entity_id: "br-uzuri-cbd", detail: { rows: 127 }, created_at: iso(0.1 * DAY) },
    { id: "act-4", branch_id: "br-uzuri-kariakoo", operator_id: "op-uzuri-kar-1", actor: "Joseph Lema", action: "stock_added", entity_type: "batch", entity_id: "bat-5", detail: { qty: 60, product: "Paracetamol 500mg" }, created_at: iso(1.2 * DAY) },
    { id: "act-5", branch_id: "br-uzuri-kariakoo", operator_id: "op-uzuri-kar-2", actor: "Fatuma Said", action: "sale_created", entity_type: "sale", entity_id: "sale-41", detail: { total: 3600, payment: "cash" }, created_at: iso(1.5 * DAY) },
    { id: "act-6", branch_id: "br-neema-central", operator_id: "op-neema-1", actor: "John Mushi", action: "unlock_requested", entity_type: "branch", entity_id: "br-neema-central", detail: { note: "Trial expired, need extension" }, created_at: iso(1 * DAY) },
    { id: "act-7", branch_id: "br-afya-ubungo", operator_id: "op-afya-2", actor: "Hamisi Kimaro", action: "sale_created", entity_type: "sale", entity_id: "sale-40", detail: { total: 15400, payment: "bank" }, created_at: iso(2 * DAY) },
    { id: "act-8", branch_id: "br-afya-ubungo", operator_id: null, actor: "system", action: "sync_completed", entity_type: "branch", entity_id: "br-afya-ubungo", detail: { rows: 89 }, created_at: iso(0.2 * DAY) },
    { id: "act-9", branch_id: "br-baraka-njiro", operator_id: "op-baraka-1", actor: "Grace Ndege", action: "subscription_locked", entity_type: "branch", entity_id: "br-baraka-njiro", detail: { reason: "grace_expired" }, created_at: iso(3 * DAY) },
    { id: "act-10", branch_id: "br-uzuri-mikocheni", operator_id: null, actor: "system", action: "install_activated", entity_type: "installs", entity_id: "ins-4", detail: { device: "fp-uzuri-mik-01" }, created_at: iso(9 * DAY) },
    { id: "act-11", branch_id: "br-tibu-tanga", operator_id: "op-tibu-1", actor: "Issa Mwakyusa", action: "order_confirmed", entity_type: "order", entity_id: "ord-3", detail: { reference: "ORD-2026-003" }, created_at: iso(2.5 * DAY) },
    { id: "act-12", branch_id: "br-afya-temeke", operator_id: "op-afya-3", actor: "Neema Pallangyo", action: "sync_completed", entity_type: "branch", entity_id: "br-afya-temeke", detail: { rows: 54 }, created_at: iso(1 * DAY) },
  ];

  // ── Support tickets ────────────────────────────────────────────────────────
  const support_tickets = [
    { id: "tkt-1", account_id: "acc-neema", subject: "Trial extension needed for Neema Central", message: "Our trial ended and we cannot open the POS. Please extend for another month.", category: "billing", contact_email: "john@neemachemists.co.tz", status: "open", internal_note: "Cross-check payment history.", source: "app", created_at: iso(1 * DAY), updated_at: iso(1 * DAY) },
    { id: "tkt-2", account_id: null, subject: "Barcode scanner not reading", message: "USB gun scans but nothing enters the field. Firmware maybe?", category: "technical", contact_email: "anonymous@example.com", status: "open", internal_note: null, source: "web", created_at: iso(2 * DAY), updated_at: iso(2 * DAY) },
    { id: "tkt-3", account_id: "acc-baraka", subject: "Cannot add pharmacist role", message: "The role dropdown only shows cashier on the desktop app.", category: "technical", contact_email: "grace@barakapharmacy.co.tz", status: "in_progress", internal_note: "Suspect stale desktop build.", source: "app", created_at: iso(4 * DAY), updated_at: iso(1 * DAY) },
    { id: "tkt-4", account_id: null, subject: "Quote request not received", message: "Submitted a supplier quote form 3 days ago, no response.", category: "other", contact_email: "buyer@example.com", status: "open", internal_note: null, source: "web", created_at: iso(3 * DAY), updated_at: iso(3 * DAY) },
    { id: "tkt-5", account_id: "acc-afya", subject: "Invoice amount mismatch", message: "Our monthly invoice shows a higher amount than expected.", category: "billing", contact_email: "salma@afyawholesale.co.tz", status: "resolved", internal_note: "Adjusted VAT line, refunded diff.", source: "app", created_at: iso(9 * DAY), updated_at: iso(2 * DAY) },
    { id: "tkt-6", account_id: null, subject: "How do I reset an operator PIN?", message: "Lost my cashier PIN after reinstall. Need reset steps.", category: "general", contact_email: "help@example.com", status: "in_progress", internal_note: null, source: "web", created_at: iso(5 * DAY), updated_at: iso(3 * DAY) },
    { id: "tkt-7", account_id: "acc-uzuri", subject: "Sales report export broken", message: "Export from analytics gives an empty CSV.", category: "technical", contact_email: "amina@uzuripharmacy.co.tz", status: "resolved", internal_note: "Fixed timezone filter.", source: "app", created_at: iso(14 * DAY), updated_at: iso(6 * DAY) },
    { id: "tkt-8", account_id: null, subject: "Marketplace order never confirmed", message: "Placed an order with a supplier 2 weeks ago, still pending.", category: "general", contact_email: "buyer2@example.com", status: "resolved", internal_note: "Supplier had no stock; refunded.", source: "web", created_at: iso(20 * DAY), updated_at: iso(10 * DAY) },
  ];

  // ── Quote requests ─────────────────────────────────────────────────────────
  const quote_requests = [
    { id: "qr-1", supplier_account_id: "acc-afya", company_name: "Uzuri Pharmacy", contact_name: "Amina Hassan", email: "amina@uzuripharmacy.co.tz", phone: "+255 712 000 001", message: "Requesting bulk quote for antimalarials.", status: "pending", created_at: iso(0.5 * DAY) },
    { id: "qr-2", supplier_account_id: "acc-tibu", company_name: "Neema Chemists", contact_name: "John Mushi", email: "john@neemachemists.co.tz", phone: "+255 756 000 002", message: "Need pricing on insulin and diabetes lines.", status: "pending", created_at: iso(1.2 * DAY) },
    { id: "qr-3", supplier_account_id: null, company_name: "Baraka Pharmacy", contact_name: "Grace Ndege", email: "grace@barakapharmacy.co.tz", phone: "+255 783 000 003", message: "Wholesale rates for supplements.", status: "pending", created_at: iso(2 * DAY) },
    { id: "qr-4", supplier_account_id: "acc-furaha", company_name: "Mikocheni Medical Store", contact_name: "David Mkono", email: "david@mikochenimed.co.tz", phone: "+255 700 000 004", message: "Respiratory supplies quote.", status: "contacted", created_at: iso(5 * DAY) },
    { id: "qr-5", supplier_account_id: "acc-afya", company_name: "Neema Chemists", contact_name: "John Mushi", email: "john@neemachemists.co.tz", phone: "+255 756 000 002", message: "Follow-up on analgesics bundle.", status: "contacted", created_at: iso(8 * DAY) },
    { id: "qr-6", supplier_account_id: "acc-tibu", company_name: "Uzuri Pharmacy", contact_name: "Amina Hassan", email: "amina@uzuripharmacy.co.tz", phone: "+255 712 000 001", message: "Quarterly antibiotics contract.", status: "closed", created_at: iso(30 * DAY) },
  ];

  // ── Supplier catalog ───────────────────────────────────────────────────────
  const supplier_catalog = [
    { id: "sc-1", supplier_id: "acc-afya", product_id: "prod-1", price: 4200, min_order_qty: 50, stock_qty: 500, status: "active", sku: "AFY-AMOX-500", pack_size: "100 tabs", currency: "TZS", lead_time_days: 2, created_at: iso(280 * DAY), updated_at: iso(2 * DAY) },
    { id: "sc-2", supplier_id: "acc-afya", product_id: "prod-3", price: 5200, min_order_qty: 30, stock_qty: 300, status: "active", sku: "AFY-COART", pack_size: "24 tabs", currency: "TZS", lead_time_days: 2, created_at: iso(280 * DAY), updated_at: iso(2 * DAY) },
    { id: "sc-3", supplier_id: "acc-afya", product_id: "prod-6", price: 500, min_order_qty: 200, stock_qty: 2000, status: "active", sku: "AFY-ORSEL", pack_size: "1 sachet", currency: "TZS", lead_time_days: 1, created_at: iso(280 * DAY), updated_at: iso(2 * DAY) },
    { id: "sc-4", supplier_id: "acc-tibu", product_id: "prod-4", price: 4600, min_order_qty: 40, stock_qty: 250, status: "active", sku: "TIB-MET-500", pack_size: "100 tabs", currency: "TZS", lead_time_days: 3, created_at: iso(170 * DAY), updated_at: iso(1 * DAY) },
    { id: "sc-5", supplier_id: "acc-tibu", product_id: "prod-10", price: 12800, min_order_qty: 10, stock_qty: 60, status: "active", sku: "TIB-SALB", pack_size: "200 dose", currency: "TZS", lead_time_days: 3, created_at: iso(170 * DAY), updated_at: iso(1 * DAY) },
    { id: "sc-6", supplier_id: "acc-tibu", product_id: "prod-9", price: 400, min_order_qty: 100, stock_qty: 0, status: "draft", sku: "TIB-ZINC", pack_size: "10 tabs", currency: "TZS", lead_time_days: 3, created_at: iso(170 * DAY), updated_at: iso(1 * DAY) },
    { id: "sc-7", supplier_id: "acc-furaha", product_id: "prod-5", price: 950, min_order_qty: 80, stock_qty: 400, status: "active", sku: "FUR-VITC", pack_size: "30 tabs", currency: "TZS", lead_time_days: 4, created_at: iso(20 * DAY), updated_at: iso(1 * DAY) },
    { id: "sc-8", supplier_id: "acc-furaha", product_id: "prod-8", price: 750, min_order_qty: 60, stock_qty: 350, status: "active", sku: "FUR-CET", pack_size: "10 tabs", currency: "TZS", lead_time_days: 4, created_at: iso(20 * DAY), updated_at: iso(1 * DAY) },
    { id: "sc-9", supplier_id: "acc-mazingira", product_id: "prod-7", price: 1600, min_order_qty: 50, stock_qty: 150, status: "active", sku: "MAZ-IBU", pack_size: "100 tabs", currency: "TZS", lead_time_days: 5, created_at: iso(90 * DAY), updated_at: iso(1 * DAY) },
  ];

  // ── Orders + line items ────────────────────────────────────────────────────
  const orders = [
    { id: "ord-1", order_reference: "ORD-2026-001", buyer_branch_id: "br-uzuri-cbd", seller_id: "acc-afya", currency: "TZS", status: "delivered", note: "Routine restock", placed_at: iso(18 * DAY), confirmed_at: iso(18 * DAY), shipped_at: iso(16 * DAY), delivered_at: iso(14 * DAY), cancelled_at: null, updated_at: iso(14 * DAY) },
    { id: "ord-2", order_reference: "ORD-2026-002", buyer_branch_id: "br-uzuri-kariakoo", seller_id: "acc-afya", currency: "TZS", status: "shipped", note: null, placed_at: iso(6 * DAY), confirmed_at: iso(5 * DAY), shipped_at: iso(4 * DAY), delivered_at: null, cancelled_at: null, updated_at: iso(4 * DAY) },
    { id: "ord-3", order_reference: "ORD-2026-003", buyer_branch_id: "br-neema-central", seller_id: "acc-tibu", currency: "TZS", status: "confirmed", note: "Diabetes line restock", placed_at: iso(2.5 * DAY), confirmed_at: iso(2.5 * DAY), shipped_at: null, delivered_at: null, cancelled_at: null, updated_at: iso(2.5 * DAY) },
    { id: "ord-4", order_reference: "ORD-2026-004", buyer_branch_id: "br-uzuri-mikocheni", seller_id: "acc-furaha", currency: "TZS", status: "pending", note: null, placed_at: iso(0.8 * DAY), confirmed_at: null, shipped_at: null, delivered_at: null, cancelled_at: null, updated_at: iso(0.8 * DAY) },
    { id: "ord-5", order_reference: "ORD-2026-005", buyer_branch_id: "br-baraka-njiro", seller_id: "acc-afya", currency: "TZS", status: "cancelled", note: "Buyer requested cancellation", placed_at: iso(10 * DAY), confirmed_at: null, shipped_at: null, delivered_at: null, cancelled_at: iso(9 * DAY), updated_at: iso(9 * DAY) },
  ];
  const order_line_items = [
    { id: "oli-1", order_id: "ord-1", product_id: "prod-1", product_name: "Amoxicillin 500mg", quantity: 100, unit_price: 4200, created_at: iso(18 * DAY) },
    { id: "oli-2", order_id: "ord-1", product_id: "prod-3", product_name: "Artemether/Lumefantrine", quantity: 60, unit_price: 5200, created_at: iso(18 * DAY) },
    { id: "oli-3", order_id: "ord-2", product_id: "prod-6", product_name: "Oral Rehydration Salts", quantity: 500, unit_price: 500, created_at: iso(6 * DAY) },
    { id: "oli-4", order_id: "ord-3", product_id: "prod-4", product_name: "Metformin 500mg", quantity: 80, unit_price: 4600, created_at: iso(2.5 * DAY) },
    { id: "oli-5", order_id: "ord-4", product_id: "prod-5", product_name: "Vitamin C 250mg", quantity: 150, unit_price: 950, created_at: iso(0.8 * DAY) },
    { id: "oli-6", order_id: "ord-5", product_id: "prod-1", product_name: "Amoxicillin 500mg", quantity: 50, unit_price: 4200, created_at: iso(10 * DAY) },
  ];

  // ── Marketplace orders + ledger (supplier analytics) ───────────────────────
  const marketplace_orders = [
    { id: "mo-1", type: "B2B", buyer_branch_id: "br-uzuri-cbd", seller_id: "acc-afya", referrer_branch_id: null, amount: 700000, platform_fee_pct: 0.05, referral_fee_pct: 0.05, status: "fulfilled", created_at: iso(12 * DAY) },
    { id: "mo-2", type: "B2B", buyer_branch_id: "br-neema-central", seller_id: "acc-tibu", referrer_branch_id: null, amount: 420000, platform_fee_pct: 0.05, referral_fee_pct: 0.05, status: "paid_escrow", created_at: iso(2 * DAY) },
  ];
  const ledger_entries = [
    { id: "le-1", order_id: "mo-1", party: "buyer", amount: 700000, direction: "hold", created_at: iso(12 * DAY) },
    { id: "le-2", order_id: "mo-1", party: "buyer", amount: 700000, direction: "release", created_at: iso(10 * DAY) },
    { id: "le-3", order_id: "mo-1", party: "seller", amount: 665000, direction: "release", created_at: iso(10 * DAY) },
    { id: "le-4", order_id: "mo-1", party: "cervos", amount: 35000, direction: "release", created_at: iso(10 * DAY) },
    { id: "le-5", order_id: "mo-2", party: "buyer", amount: 420000, direction: "hold", created_at: iso(2 * DAY) },
  ];

  // ── App releases (HQ Downloads) ────────────────────────────────────────────
  // Shape matches the real `app_releases` table; file_url points at the mock
  // storage route, which serves binaries from <repo>/.mock-releases.
  const app_releases = [
    { id: "rel-1", platform: "windows", version: "2.4.0", file_path: "windows/cervos-setup-2.4.0.exe", file_url: "/mock/storage/app-releases/windows/cervos-setup-2.4.0.exe", file_size_bytes: 96000000, release_notes: "Faster sync, barcode scan fix, printer presets.", is_current: true, created_at: iso(6 * DAY), uploaded_at: iso(6 * DAY) },
    { id: "rel-2", platform: "android", version: "0.2.0", file_path: "android/cervos-pos-0.2.0-arm64.apk", file_url: "/mock/storage/app-releases/android/cervos-pos-0.2.0-arm64.apk", file_size_bytes: 14700000, release_notes: "First Android build of the Cervos POS app (arm64).", is_current: true, created_at: iso(1 * DAY), uploaded_at: iso(1 * DAY) },
    { id: "rel-3", platform: "mac", version: "2.3.0", file_path: "mac/cervos-2.3.0.dmg", file_url: "/mock/storage/app-releases/mac/cervos-2.3.0.dmg", file_size_bytes: 88000000, release_notes: "Initial macOS support.", is_current: true, created_at: iso(35 * DAY), uploaded_at: iso(35 * DAY) },
  ];

  // ── Payment settings (dashboard/settings + supplier/settings) ──────────────
  // Shape must match the `PaymentSettings` type in lib/actions/payments.ts —
  // PaymentSettingsForm reads `accepted_methods` unconditionally, so a row with
  // legacy payout fields (provider/business_name/payout_method) crashed the page.
  const payment_settings = [
    // Pharmacy demo account — POS counter methods, cash always enabled.
    { id: "ps-1", account_id: "acc-uzuri", default_method: "cash", accepted_methods: ["cash", "mobile_money", "card"], mpesa_number: "0713000001", tigo_number: null, halopesa_number: null, airtel_number: "0685000001", bank_name: null, bank_account: null, bank_branch: null, payme_wallet_number: null, created_at: iso(320 * DAY), updated_at: iso(4 * DAY) },
    { id: "ps-2", account_id: "acc-afya", default_method: "bank_transfer", accepted_methods: ["mobile_money", "bank_transfer", "invoice"], mpesa_number: "0719000005", tigo_number: null, halopesa_number: null, airtel_number: null, bank_name: "CRDB Bank", bank_account: "0150 5511 0001", bank_branch: "Dar es Salaam", payme_wallet_number: "+255719000005", created_at: iso(270 * DAY), updated_at: iso(2 * DAY) },
    { id: "ps-3", account_id: "acc-tibu", default_method: "mobile_money", accepted_methods: ["mobile_money", "invoice"], mpesa_number: null, tigo_number: "0762000006", halopesa_number: null, airtel_number: null, bank_name: null, bank_account: null, bank_branch: null, payme_wallet_number: "+255762000006", created_at: iso(160 * DAY), updated_at: iso(3 * DAY) },
  ];

  // ── HQ admins (passwords are real scrypt hashes — see TEST_LOCAL.md) ───────
  const hq_admins = [
    {
      id: "hq-1",
      email: MOCK_HQ_ADMIN_EMAIL,
      name: "Cervos Ops Admin",
      password_hash: "scrypt$16384$8$1$QCStZvT8DO7gQ9RY4rBZlw==$Fp0mplh30Vjw/MHeWasAlaznc1jDIWRoOABsSH77agjMkPeJXrCApoG5FvruGPcl6O+iAEYOUuyekJ0ykCO2HQ==",
      role: "admin",
      disabled: false,
      last_login_at: iso(1 * DAY),
      created_at: iso(200 * DAY),
    },
    {
      id: "hq-2",
      email: MOCK_HQ_SUPPORT_EMAIL,
      name: "Cervos Support",
      password_hash: "scrypt$16384$8$1$EJwfK62qDGjOGqD8snCNTQ==$ItS8QNam3XGA2ZNjVEkhKE8q+Oz41mEAteVLs+V6dy7bN8+8lOqI6bFL/ZrwyGyGQIM35MOCruYqHLaf9REvgA==",
      role: "support",
      disabled: false,
      last_login_at: iso(3 * DAY),
      created_at: iso(180 * DAY),
    },
  ];

  return {
    accounts,
    user_profiles,
    branches,
    operators,
    installs,
    products,
    batches,
    sales,
    sale_items,
    activity_log,
    support_tickets,
    quote_requests,
    supplier_catalog,
    orders,
    order_line_items,
    marketplace_orders,
    ledger_entries,
    app_releases,
    payment_settings,
    hq_admins,
  };
}

/** Defines the FK relationships the mock embed-resolver understands. */
export interface MockRelationship {
  fkCol: string;
  embedTable: string;
  many: boolean;
  /** For to-many embeds: the column on the embed table that references the parent's id. */
  fkTargetCol?: string;
}

export const MOCK_RELATIONSHIPS: Record<string, MockRelationship[]> = {
  batches: [
    { fkCol: "product_id", embedTable: "products", many: false },
    { fkCol: "branch_id", embedTable: "branches", many: false },
  ],
  branches: [{ fkCol: "account_id", embedTable: "accounts", many: false }],
  activity_log: [{ fkCol: "branch_id", embedTable: "branches", many: false }],
  orders: [{ fkCol: "id", embedTable: "order_line_items", many: true, fkTargetCol: "order_id" }],
};
