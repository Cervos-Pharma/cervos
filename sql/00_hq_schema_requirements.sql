-- Cervos HQ Console - Supabase Schema Setup
-- Run this SQL in Supabase Dashboard > SQL Editor to create all missing tables and columns
-- Also create the storage bucket: Supabase Dashboard > Storage > New Bucket > Name: "app-releases" (private)

-- ============================================
-- MISSING TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_name TEXT,
  phone TEXT,
  region TEXT,
  role TEXT,
  tech_comfort TEXT,
  goals TEXT[],
  onboarding_completed_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price_monthly_tzs NUMERIC NOT NULL DEFAULT 0,
  price_annual_tzs NUMERIC NOT NULL DEFAULT 0,
  max_branches INTEGER NOT NULL DEFAULT 1,
  max_operators INTEGER NOT NULL DEFAULT 5,
  features TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS billing_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  amount_tzs NUMERIC NOT NULL,
  reference TEXT NOT NULL,
  note TEXT,
  status TEXT DEFAULT 'paid',
  recorded_by_hq_admin_id UUID REFERENCES hq_admins(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplier_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_request_id UUID REFERENCES quote_requests(id),
  invite_token TEXT NOT NULL UNIQUE,
  token_expires_at TIMESTAMPTZ NOT NULL,
  invited_by_hq_admin_id UUID REFERENCES hq_admins(id),
  supplier_account_id UUID REFERENCES accounts(id),
  status TEXT DEFAULT 'pending',
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplier_quote_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_request_id UUID NOT NULL REFERENCES quote_requests(id),
  account_id UUID NOT NULL REFERENCES accounts(id),
  expected_branches INTEGER,
  annual_volume TEXT,
  current_supplier TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(quote_request_id, account_id)
);

CREATE TABLE IF NOT EXISTS news_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS news_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT,
  content TEXT,
  cover_image_url TEXT,
  author_name TEXT,
  category TEXT DEFAULT 'Company',
  tags TEXT[] DEFAULT '{}',
  published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  version TEXT NOT NULL,
  release_notes TEXT,
  file_url TEXT NOT NULL,
  file_size_bytes BIGINT,
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE app_releases ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================
-- MISSING COLUMNS ON EXISTING TABLES
-- ============================================

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS subscription_plan UUID REFERENCES subscription_plans(id);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS ltv NUMERIC DEFAULT 0;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS grace_ends_at TIMESTAMPTZ;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;

ALTER TABLE branches ADD COLUMN IF NOT EXISTS locked_manually_at TIMESTAMPTZ;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS grace_ends_at TIMESTAMPTZ;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;

ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0;

-- Columns added for desktop endpoint <-> HQ sync (formulation, barcode, pricing, sync tracking)
ALTER TABLE products ADD COLUMN IF NOT EXISTS formulation TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS default_expiry TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS default_cost_price REAL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS default_sale_price REAL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE batches ADD COLUMN IF NOT EXISTS batch_number TEXT;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();


ALTER TABLE sales ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id);

ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id);

ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS branch_name TEXT;
ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS expected_branches INTEGER;
ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS current_supplier TEXT;
ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS annual_volume TEXT;

ALTER TABLE hq_admins ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'admin';
ALTER TABLE hq_admins ADD COLUMN IF NOT EXISTS disabled BOOLEAN DEFAULT false;
ALTER TABLE hq_admins ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- ============================================
-- RLS POLICIES (allow service role full access)
-- ============================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_quote_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_releases ENABLE ROW LEVEL SECURITY;

-- user_profiles: service role only
DROP POLICY IF EXISTS "Service role full access user_profiles" ON user_profiles;
CREATE POLICY "Service role full access user_profiles" ON user_profiles FOR ALL USING (true) WITH CHECK (true);

-- subscription_plans: anyone can read
DROP POLICY IF EXISTS "Anyone can read subscription_plans" ON subscription_plans;
CREATE POLICY "Anyone can read subscription_plans" ON subscription_plans FOR SELECT USING (true);

-- billing_payments: service role only
DROP POLICY IF EXISTS "Service role full access billing_payments" ON billing_payments;
CREATE POLICY "Service role full access billing_payments" ON billing_payments FOR ALL USING (true) WITH CHECK (true);

-- supplier_invites: service role only
DROP POLICY IF EXISTS "Service role full access supplier_invites" ON supplier_invites;
CREATE POLICY "Service role full access supplier_invites" ON supplier_invites FOR ALL USING (true) WITH CHECK (true);

-- supplier_quote_answers: service role only
DROP POLICY IF EXISTS "Service role full access supplier_quote_answers" ON supplier_quote_answers;
CREATE POLICY "Service role full access supplier_quote_answers" ON supplier_quote_answers FOR ALL USING (true) WITH CHECK (true);

-- news_categories: anyone can read
DROP POLICY IF EXISTS "Anyone can read news_categories" ON news_categories;
CREATE POLICY "Anyone can read news_categories" ON news_categories FOR SELECT USING (true);

-- news_posts: anyone can view published; service role manages all
DROP POLICY IF EXISTS "Anyone can view published news_posts" ON news_posts;
CREATE POLICY "Anyone can view published news_posts" ON news_posts FOR SELECT USING (published = true);
DROP POLICY IF EXISTS "Service role full access news_posts" ON news_posts;
CREATE POLICY "Service role full access news_posts" ON news_posts FOR ALL USING (true) WITH CHECK (true);

-- app_releases: anyone can view current releases; service role manages all
DROP POLICY IF EXISTS "Anyone can view current app_releases" ON app_releases;
CREATE POLICY "Anyone can view current app_releases" ON app_releases FOR SELECT USING (is_current = true);
DROP POLICY IF EXISTS "Service role full access app_releases" ON app_releases;
CREATE POLICY "Service role full access app_releases" ON app_releases FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- RPC FUNCTION: set_current_release
-- ============================================

CREATE OR REPLACE FUNCTION set_current_release(p_release_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE app_releases
  SET is_current = false
  WHERE platform = (SELECT platform FROM app_releases WHERE id = p_release_id)
    AND is_current = true;
  UPDATE app_releases
  SET is_current = true
  WHERE id = p_release_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- SEED DEFAULT NEWS CATEGORIES
-- ============================================

INSERT INTO news_categories (name, slug) VALUES
  ('Product Updates', 'product-updates'),
  ('Industry News', 'industry-news'),
  ('Regulatory', 'regulatory'),
  ('Company', 'company')
ON CONFLICT DO NOTHING;

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_user_profiles_account_id ON user_profiles(account_id);
CREATE INDEX IF NOT EXISTS idx_branches_account_id ON branches(account_id);
CREATE INDEX IF NOT EXISTS idx_operators_branch_id ON operators(branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_branch_id ON sales(branch_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_branch_id ON activity_log(branch_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_quote_requests_status ON quote_requests(status);
CREATE INDEX IF NOT EXISTS idx_supplier_invites_status ON supplier_invites(status);
CREATE INDEX IF NOT EXISTS idx_billing_payments_account_id ON billing_payments(account_id);
CREATE INDEX IF NOT EXISTS idx_news_posts_published ON news_posts(published);
CREATE INDEX IF NOT EXISTS idx_app_releases_platform ON app_releases(platform);

-- ============================================
-- ENDPOINT SYNC TABLES (desktop <-> HQ)
-- Idempotent: safe to re-run. Mirrors the desktop SQLite schema.
-- RLS is intentionally OFF for these (anon key writes from the desktop
-- client), consistent with how `sales` is already synced.
-- ============================================

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY,
  generic_name TEXT NOT NULL,
  brand_name TEXT,
  category TEXT,
  formulation TEXT,
  requires_prescription BOOLEAN DEFAULT false,
  barcode TEXT,
  unit_desc TEXT,
  default_expiry TEXT,
  default_cost_price REAL,
  default_sale_price REAL,
  stock INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS batches (
  id UUID PRIMARY KEY,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  batch_number TEXT,
  quantity INTEGER DEFAULT 0,
  cost_price REAL DEFAULT 0,
  sale_price REAL DEFAULT 0,
  expiry_date TEXT,
  sync_version INTEGER DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_updated_at ON products(updated_at);
CREATE INDEX IF NOT EXISTS idx_batches_branch_id ON batches(branch_id);
CREATE INDEX IF NOT EXISTS idx_batches_product_id ON batches(product_id);
CREATE INDEX IF NOT EXISTS idx_batches_updated_at ON batches(updated_at);
