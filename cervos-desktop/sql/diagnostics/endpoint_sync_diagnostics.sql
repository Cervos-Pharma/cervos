-- Endpoint Sync Diagnostics
-- Reports missing INSERT policies, missing tables, NOT NULL conflicts
-- Run in Supabase Dashboard → SQL Editor

-- Check for tables missing RLS INSERT policies
SELECT
  t.table_name,
  CASE
    WHEN r.policyname IS NULL THEN 'MISSING INSERT POLICY'
    WHEN r.policyname LIKE '%insert%' THEN 'HAVE INSERT POLICY'
    ELSE 'OTHER POLICY: ' || r.policyname
  END AS rls_status
FROM information_schema.tables t
LEFT JOIN pg_policies r ON t.table_name = r.tablename AND r.schemaname = 'public'
  AND r.policylike = 'INSERT'
WHERE t.table_schema = 'public'
  AND t.table_type = 'TABLE'
ORDER BY t.table_name;

-- Check for tables referenced in sync_queue that may not exist
SELECT
  q.table_name,
  CASE
    WHEN t.table_name IS NULL THEN 'TABLE NOT FOUND in information_schema'
    ELSE 'TABLE EXISTS'
  EXISTS_check
FROM (SELECT DISTINCT table_name FROM sync_queue) q
LEFT JOIN information_schema.tables t ON q.table_name = t.table_name AND t.table_schema = 'public'
ORDER BY q.table_name;

-- Check for NOT NULL constraint violations in batches table (expiry_date drift)
SELECT
  b.id,
  b.expiry_date,
  CASE
    WHEN b.expiry_date IS NULL THEN 'NOT NULL violation — expiry_date is NULL'
    WHEN b.expiry_date != b.expiry_date THEN 'NOT NULL violation — expiry_date is NaN/undefined'
    ELSE 'OK'
  END AS null_status
FROM batches b
WHERE b.expiry_date IS NULL
LIMIT 20;

-- Check for tables that should exist for endpoint sync but may be missing
SELECT
  expected_table,
  CASE
    WHEN actual.table_name IS NULL THEN 'MISSING — not in database'
    ELSE 'PRESENT'
  END AS status
FROM (
  VALUES ('products'),
        ('batches'),
        ('sales'),
        ('sale_items'),
        ('orders'),
        ('order_line_items'),
        ('operators'),
        ('branches'),
        ('accounts'),
        ('notifications'),
        ('pos_settings'),
        ('hq_messages'),
        ('hq_audit_log'),
        ('disbursements'),
        ('payments')
) AS expected(expected_table)
LEFT JOIN information_schema.tables actual ON expected.expected_table = actual.table_name AND actual.table_schema = 'public'
ORDER BY expected.expected_table;