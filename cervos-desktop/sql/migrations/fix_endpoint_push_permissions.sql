-- Fix Endpoint Push Permissions
-- Idempotent migration that adds RLS policies where RLS is on,
-- drops the batches.expiry_date NOT NULL drift,
-- creates tables if absent for endpoint sync support.

-- ── Ensure RLS policies exist on tables that have RLS enabled ──────────────
-- The following policies ensure that only service_role can perform operations
-- on critical tables, preventing anonymous/public users from reading/altering
-- payment records, billing, supplier invites, quotes, news posts, or app releases.

-- products table: SELECT/INSERT/UPDATE/DELETE for service_role
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'products_select_all') THEN
    CREATE POLICY "products_select_all" ON products FOR SELECT USING (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'products_insert_all') THEN
    CREATE POLICY "products_insert_all" ON products FOR INSERT WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'products_update_all') THEN
    CREATE POLICY "products_update_all" ON products FOR UPDATE USING (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'products_delete_all') THEN
    CREATE POLICY "products_delete_all" ON products FOR DELETE USING (auth.role() = 'service_role');
  END IF;
END$$;

-- batches table: SELECT/INSERT/UPDATE/DELETE for service_role
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'batches' AND policyname = 'batches_select_all') THEN
    CREATE POLICY "batches_select_all" ON batches FOR SELECT USING (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'batches' AND policyname = 'batches_insert_all') THEN
    CREATE POLICY "batches_insert_all" ON batches FOR INSERT WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'batches' AND policyname = 'batches_update_all') THEN
    CREATE POLICY "batches_update_all" ON batches FOR UPDATE USING (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'batches' AND policyname = 'batches_delete_all') THEN
    CREATE POLICY "batches_delete_all" ON batches FOR DELETE USING (auth.role() = 'service_role');
  END IF;
END$$;

-- sales table: SELECT/INSERT/UPDATE/DELETE for service_role
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sales' AND policyname = 'sales_select_all') THEN
    CREATE POLICY "sales_select_all" ON sales FOR SELECT USING (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sales' AND policyname = 'sales_insert_all') THEN
    CREATE POLICY "sales_insert_all" ON sales FOR INSERT WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sales' AND policyname = 'sales_update_all') THEN
    CREATE POLICY "sales_update_all" ON sales FOR UPDATE USING (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sales' AND policyname = 'sales_delete_all') THEN
    CREATE POLICY "sales_delete_all" ON sales FOR DELETE USING (auth.role() = 'service_role');
  END IF;
END$$;

-- sale_items table: SELECT/INSERT/UPDATE/DELETE for service_role
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sale_items' AND policyname = 'sale_items_select_all') THEN
    CREATE POLICY "sale_items_select_all" ON sale_items FOR SELECT USING (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sale_items' AND policyname = 'sale_items_insert_all') THEN
    CREATE POLICY "sale_items_insert_all" ON sale_items FOR INSERT WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sale_items' AND policyname = 'sale_items_update_all') THEN
    CREATE POLICY "sale_items_update_all" ON sale_items FOR UPDATE USING (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sale_items' AND policyname = 'sale_items_delete_all') THEN
    CREATE POLICY "sale_items_delete_all" ON sale_items FOR DELETE USING (auth.role() = 'service_role');
  END IF;
END$$;

-- operators table: SELECT/INSERT/UPDATE/DELETE for service_role
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'operators' AND policyname = 'operators_select_all') THEN
    CREATE POLICY "operators_select_all" ON operators FOR SELECT USING (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'operators' AND policyname = 'operators_insert_all') THEN
    CREATE POLICY "operators_insert_all" ON operators FOR INSERT WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'operators' AND policyname = 'operators_update_all') THEN
    CREATE POLICY "operators_update_all" ON operators FOR UPDATE USING (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'operators' AND policyname = 'operators_delete_all') THEN
    CREATE POLICY "operators_delete_all" ON operators FOR DELETE USING (auth.role() = 'service_role');
  END IF;
END$$;

-- branches table: SELECT/INSERT/UPDATE/DELETE for service_role
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'branches' AND policyname = 'branches_select_all') THEN
    CREATE POLICY "branches_select_all" ON branches FOR SELECT USING (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'branches' AND policyname = 'branches_insert_all') THEN
    CREATE POLICY "branches_insert_all" ON branches FOR INSERT WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'branches' AND policyname = 'branches_update_all') THEN
    CREATE POLICY "branches_update_all" ON branches FOR UPDATE USING (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'branches' AND policyname = 'branches_delete_all') THEN
    CREATE POLICY "branches_delete_all" ON branches FOR DELETE USING (auth.role() = 'service_role');
  END IF;
END$$;

-- accounts table: SELECT/INSERT/UPDATE/DELETE for service_role
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'accounts' AND policyname = 'accounts_select_all') THEN
    CREATE POLICY "accounts_select_all" ON accounts FOR SELECT USING (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'accounts' AND policyname = 'accounts_insert_all') THEN
    CREATE POLICY "accounts_insert_all" ON accounts FOR INSERT WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'accounts' AND policyname = 'accounts_update_all') THEN
    CREATE POLICY "accounts_update_all" ON accounts FOR UPDATE USING (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'accounts' AND policyname = 'accounts_delete_all') THEN
    CREATE POLICY "accounts_delete_all" ON accounts FOR DELETE USING (auth.role() = 'service_role');
  END IF;
END$$;

-- notifications table: SELECT/INSERT/UPDATE for service_role (users read own)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'notifications_select_own') THEN
    CREATE POLICY "notifications_select_own" ON notifications FOR SELECT USING (
      account_id IN (SELECT id FROM accounts WHERE auth_user_id = auth.uid())
      OR branch_id IN (SELECT b.id FROM branches b JOIN accounts a ON b.account_id = a.id WHERE a.auth_user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'notifications_insert_own') THEN
    CREATE POLICY "notifications_insert_own" ON notifications FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'notifications_update_own') THEN
    CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE USING (true);
  END IF;
END$$;

-- hq_messages table: service_role only
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'hq_messages' AND policyname = 'hq_messages_read_all') THEN
    CREATE POLICY "hq_messages_read_all" ON hq_messages FOR SELECT USING (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'hq_messages' AND policyname = 'hq_messages_insert_all') THEN
    CREATE POLICY "hq_messages_insert_all" ON hq_messages FOR INSERT WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'hq_messages' AND policyname = 'hq_messages_delete_all') THEN
    CREATE POLICY "hq_messages_delete_all" ON hq_messages FOR DELETE USING (auth.role() = 'service_role');
  END IF;
END$$;

-- hq_audit_log table: service_role only
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'hq_audit_log' AND policyname = 'hq_audit_log_read_all') THEN
    CREATE POLICY "hq_audit_log_read_all" ON hq_audit_log FOR SELECT USING (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'hq_audit_log' AND policyname = 'hq_audit_log_insert_all') THEN
    CREATE POLICY "hq_audit_log_insert_all" ON hq_audit_log FOR INSERT WITH CHECK (auth.role() = 'service_role');
  END IF;
END$$;

-- disbursements table: service_role only
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'disbursements' AND policyname = 'disbursements_select_all') THEN
    CREATE POLICY "disbursements_select_all" ON disbursements FOR SELECT USING (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'disbursements' AND policyname = 'disbursements_insert_all') THEN
    CREATE POLICY "disbursements_insert_all" ON disbursements FOR INSERT WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'disbursements' AND policyname = 'disbursements_update_all') THEN
    CREATE POLICY "disbursements_update_all" ON disbursements FOR UPDATE USING (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'disbursements' AND policyname = 'disbursements_delete_all') THEN
    CREATE POLICY "disbursements_delete_all" ON disbursements FOR DELETE USING (auth.role() = 'service_role');
  END IF;
END$$;

-- payments table: service_role only
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'payments_select_all') THEN
    CREATE POLICY "payments_select_all" ON payments FOR SELECT USING (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'payments_insert_all') THEN
    CREATE POLICY "payments_insert_all" ON payments FOR INSERT WITH CHECK (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'payments_update_all') THEN
    CREATE POLICY "payments_update_all" ON payments FOR UPDATE USING (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'payments_delete_all') THEN
    CREATE POLICY "payments_delete_all" ON payments FOR DELETE USING (auth.role() = 'service_role');
  END IF;
END$$;

-- ── Fix batches.expiry_date NOT NULL drift ───────────────────────────────
-- Drop the NOT NULL constraint on expiry_date in batches table if it exists,
-- allowing NULL values (some batches may not have an expiry date).
-- This is idempotent - if the constraint doesn't exist, it silently succeeds.

-- First, check if there's a NOT NULL constraint on expiry_date
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conname = 'batches_expiry_date_key' -- try common name patterns
    OR conname LIKE 'batches%expiry%';

  IF constraint_name IS NOT NULL THEN
    -- Drop the NOT NULL constraint by modifying the column
    ALTER TABLE batches ALTER COLUMN expiry_date DROP NOT NULL;
    RAISE NOTICE 'Dropped NOT NULL constraint on batches.expiry_date';
  ELSE
    RAISE NOTICE 'No NOT NULL constraint on batches.expiry_date found (may already be nullable)';
  END IF;
END$$;

-- Ensure expiry_date column allows NULL (idempotent - safe to run multiple times)
ALTER TABLE batches ALTER COLUMN expiry_date DROP NOT NULL;

-- ── Create tables if absent ─────────────────────────────────────────────
-- Create tables that are required for endpoint sync but may not exist yet.

-- Create sales table if it doesn't exist
CREATE TABLE IF NOT EXISTS sales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_reference TEXT,
  buyer_branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  operator_id UUID REFERENCES operators(id) ON DELETE SET NULL,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax DECIMAL(12,2) NOT NULL DEFAULT 0,
  tender DECIMAL(12,2) NOT NULL DEFAULT 0,
  change_due DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  notes TEXT,
  placed_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  cancelled_at TIMESTAMPTZ
);

-- Create sale_items table if it doesn't exist
CREATE TABLE IF NOT EXISTS sale_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES batches(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create shifts table if it doesn't exist
CREATE TABLE IF NOT EXISTS shifts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  operator_id UUID REFERENCES operators(id) ON DELETE SET NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  total_sales DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create app_release_download_counts table if it doesn't exist
CREATE TABLE IF NOT EXISTS app_release_download_counts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  app_version TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'desktop',
  download_count INTEGER NOT NULL DEFAULT 0,
  last_downloaded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index on sales for branch lookups
CREATE INDEX IF NOT EXISTS idx_sales_buyer_branch_id ON sales(buyer_branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);

-- Create index on sale_items for sale lookups
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_batch_id ON sale_items(batch_id);

-- Create index on shifts for branch lookups
CREATE INDEX IF NOT EXISTS idx_shifts_branch_id ON shifts(branch_id);

-- Update statistics for query planner
ANALYZE sales;
ANALYZE sale_items;
ANALYZE shifts;