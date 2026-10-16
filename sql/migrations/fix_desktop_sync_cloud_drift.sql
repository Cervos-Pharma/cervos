-- Migration: reconcile live-Supabase drift that blocks desktop sync uploads
-- Run in Supabase Dashboard → SQL Editor (idempotent).
--
-- Discovered while verifying the desktop POS (2026-10-16). The live cloud DB
-- has drifted from this repo's canonical `scripts/hq_schema_requirements.sql`,
-- which intends `products`/`batches` to be anonymously writable-by-desktop
-- (RLS off) with a nullable `batches.expiry_date`. The live DB instead has:
--
--   1. RLS enabled on `products` with policies that allow SELECT and UPDATE
--      for authenticated users but NO matching INSERT policy → every desktop
--      "Add New Product" upload fails with 42501 / HTTP 403
--      ("new row violates row-level security policy").
--      Cascade effect: `batches` rows referencing the never-uploaded product
--      id also fail (FK 23503 → HTTP 409), so stock never leaves the POS.
--
--   2. `batches.expiry_date` set to NOT NULL, while the desktop legitimately
--      creates batches whose product has no default expiry date and sends
--      null → 23502 / HTTP 400 ("null value in column expiry_date ...").
--      The repo schema (hq_schema_requirements.sql) declares it nullable.
--
-- Verified fine against the live DB (no change needed): `sales` inserts with
-- the desktop payload succeed; `sale_items` passes RLS once its parent sale
-- exists (the POS ordering bug that exposed this is fixed client-side by
-- uploading parents before children in bulkPush).
--
-- Trade-off note: `products` is a shared master catalog (see
-- sql/seed_real_medicines.sql). Permitting authenticated INSERT mirrors the
-- already-permissive UPDATE policy and matches the documented intent in
-- docs/ARCHITECTURE.md §9 ("that policies ... permit the account user's
-- writes"). If HQ later wants per-account catalogs, add an account_id column
-- and scope both policies.

-- 1) Products: allow the desktop's authenticated upserts.
DROP POLICY IF EXISTS "authenticated can insert products" ON products;
CREATE POLICY "authenticated can insert products" ON products
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated can delete products" ON products;
CREATE POLICY "authenticated can delete products" ON products
  FOR DELETE TO authenticated USING (true);

-- 2) Batches: restore the repo schema's nullable expiry_date.
ALTER TABLE batches ALTER COLUMN expiry_date DROP NOT NULL;
