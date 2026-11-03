-- pos_settings: syncable POS terminal settings, one row per (branch, key).
-- Desktop writes bump these; every other device of the same branch pulls
-- them down in the sync cycle, so changes made on one terminal are stored
-- in the database and updated everywhere instead of staying local.
-- Mirrors how the desktop syncs app_settings keys in
-- cervos-desktop/src/lib/sync.ts (SYNCED_SETTING_KEYS: pharmacy_name,
-- tax_rate, low_stock_threshold, expiry_days_threshold, payme_wallet_number).
--
-- `id` is a deterministic UUID the desktop derives from (branch_id, key),
-- so concurrent edit races converge onto one row via upsert(onConflict: 'id').

CREATE TABLE IF NOT EXISTS pos_settings (
  id UUID PRIMARY KEY,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (branch_id, key)
);

CREATE INDEX IF NOT EXISTS pos_settings_branch_idx ON pos_settings (branch_id);

-- Same access rule as expenses: only the owning pharmacy account
-- (matching Supabase auth user) can read or write its branch settings.
ALTER TABLE pos_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pos_settings' AND policyname = 'pos_settings_account_rw'
  ) THEN
    CREATE POLICY pos_settings_account_rw ON pos_settings
      FOR ALL
      USING (
        branch_id IN (
          SELECT b.id FROM branches b
          JOIN accounts a ON a.id = b.account_id
          WHERE a.auth_user_id = auth.uid()
        )
      )
      WITH CHECK (
        branch_id IN (
          SELECT b.id FROM branches b
          JOIN accounts a ON a.id = b.account_id
          WHERE a.auth_user_id = auth.uid()
        )
      );
  END IF;
END $$;
