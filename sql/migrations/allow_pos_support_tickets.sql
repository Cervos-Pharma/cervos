-- Migration: allow support tickets from the desktop POS ("source = pos")
-- Run in Supabase Dashboard → SQL Editor (idempotent).
--
-- Found while verifying the POS Support page (2026-10-16). The POST endpoint
-- (/api/support/tickets) inserts `source: "pos"`, but the live
-- support_tickets_source_check constraint only enumerates the older sources
-- (the web portal inserts "web"). Every POS ticket fails with 23514 /
-- HTTP 500: new row for relation "support_tickets" violates check constraint
-- "support_tickets_source_check".
--
-- The repo has no CREATE TABLE for support_tickets, so first confirm the
-- live definition (SQL Editor):
--
--   SELECT pg_get_constraintdef(oid)
--   FROM   pg_constraint
--   WHERE  conname = 'support_tickets_source_check';
--
-- Then extend the value list with 'pos' and apply (idempotent):

ALTER TABLE support_tickets
  DROP CONSTRAINT IF EXISTS support_tickets_source_check;

ALTER TABLE support_tickets
  ADD CONSTRAINT support_tickets_source_check
  CHECK (source IN ('web', 'pos'));
