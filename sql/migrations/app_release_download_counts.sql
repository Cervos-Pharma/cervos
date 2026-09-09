-- ═══════════════════════════════════════════════════════════════════════
-- Cervos — Real download counters for app_releases
-- Backs the public landing page "Downloads" stat with an actual counter
-- incremented on every real download redirect, instead of a made-up number.
--
-- Run this once in Supabase Dashboard → SQL Editor. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE app_releases ADD COLUMN IF NOT EXISTS download_count INTEGER NOT NULL DEFAULT 0;

-- Atomic increment so concurrent downloads never lose a count under a
-- read-modify-write race.
CREATE OR REPLACE FUNCTION increment_release_download_count(p_release_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE app_releases
  SET download_count = download_count + 1
  WHERE id = p_release_id;
END;
$$ LANGUAGE plpgsql;
