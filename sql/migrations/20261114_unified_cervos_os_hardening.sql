-- =============================================================================
-- Cervos OS Unified Hardening & 8-Stakeholder Ledger Migration (2026-11-14)
-- Idempotent migration introducing:
--   1. Append-only inventory ledger (`stock_movements`)
--   2. e-Prescription fulfillment locking (`prescriptions` + `claim_token`)
--   3. Hospital emergency stockout transfer coordination (`hospital_stock_requests`)
--   4. Regulatory TMDA batch recall quarantine (`regulatory_recalls`)
--   5. Replacement of permissive `USING (true)` RLS policies with scoped policies
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,
  branch_id UUID NOT NULL,
  product_id UUID NOT NULL,
  batch_id UUID NOT NULL,
  delta_qty INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (
    reason IN (
      'grn_intake',
      'pos_sale',
      'pos_return',
      'adjustment',
      'expiry_writeoff',
      'recall_quarantine',
      'hospital_transfer_out',
      'hospital_transfer_in'
    )
  ),
  unit_cost_tzs INTEGER,
  unit_sale_tzs INTEGER,
  actor_operator_id UUID,
  device_id TEXT,
  reference_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_branch_created
  ON public.stock_movements (branch_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_token TEXT NOT NULL UNIQUE,
  prescriber_id UUID,
  prescriber_license_no TEXT NOT NULL,
  patient_initials TEXT NOT NULL,
  product_id UUID,
  inn_name TEXT NOT NULL,
  prescribed_qty INTEGER NOT NULL CHECK (prescribed_qty > 0),
  is_controlled BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'issued' CHECK (
    status IN ('issued', 'reserved', 'dispensed', 'expired', 'revoked')
  ),
  claimed_by_branch_id UUID,
  dispensed_by_pharmacist_license_no TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hospital_stock_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_account_id UUID NOT NULL,
  hospital_name TEXT NOT NULL,
  region TEXT NOT NULL,
  product_id UUID,
  inn_name TEXT NOT NULL,
  current_qty INTEGER NOT NULL DEFAULT 0,
  needed_qty INTEGER NOT NULL CHECK (needed_qty > 0),
  urgency TEXT NOT NULL DEFAULT 'urgent' CHECK (urgency IN ('routine', 'urgent', 'life_critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (
    status IN ('open', 'matched', 'in_transit', 'fulfilled', 'cancelled')
  ),
  matched_source_branch_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.regulatory_recalls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recall_code TEXT NOT NULL UNIQUE,
  tmda_notice_ref TEXT NOT NULL,
  inn_name TEXT NOT NULL,
  batch_number TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('class_i_critical', 'class_ii_moderate', 'class_iii_advisory')),
  reason TEXT NOT NULL,
  issued_by_regulator_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enforce RLS across new and hardened tables
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_stock_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regulatory_recalls ENABLE ROW LEVEL SECURITY;

-- Replace insecure `USING (true)` policies where present on sensitive tables
DO $$
BEGIN
  IF to_regclass('public.app_releases') IS NOT NULL THEN
    ALTER TABLE public.app_releases ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "app_releases_all" ON public.app_releases;
    DROP POLICY IF EXISTS "Enable all for app_releases" ON public.app_releases;
    DROP POLICY IF EXISTS "Public read published app_releases" ON public.app_releases;
    CREATE POLICY "Public read published app_releases"
      ON public.app_releases FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;

  IF to_regclass('public.billing_payments') IS NOT NULL THEN
    ALTER TABLE public.billing_payments ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "billing_payments_all" ON public.billing_payments;
    DROP POLICY IF EXISTS "Enable all for billing_payments" ON public.billing_payments;
    DROP POLICY IF EXISTS "Tenant read own billing_payments" ON public.billing_payments;
    CREATE POLICY "Tenant read own billing_payments"
      ON public.billing_payments FOR SELECT
      TO authenticated
      USING (
        account_id IN (
          SELECT id FROM public.accounts WHERE auth_user_id = auth.uid()
        )
      );
  END IF;

  IF to_regclass('public.branch_commands') IS NOT NULL THEN
    ALTER TABLE public.branch_commands ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Tenant access own branch_commands" ON public.branch_commands;
    CREATE POLICY "Tenant access own branch_commands"
      ON public.branch_commands FOR ALL
      TO authenticated
      USING (
        branch_id IN (
          SELECT b.id FROM public.branches b
          JOIN public.accounts a ON a.id = b.account_id
          WHERE a.auth_user_id = auth.uid()
        )
      )
      WITH CHECK (
        branch_id IN (
          SELECT b.id FROM public.branches b
          JOIN public.accounts a ON a.id = b.account_id
          WHERE a.auth_user_id = auth.uid()
        )
      );
  END IF;
END $$;

DROP POLICY IF EXISTS "Tenant stock_movements isolation" ON public.stock_movements;
CREATE POLICY "Tenant stock_movements isolation"
  ON public.stock_movements FOR ALL
  TO authenticated
  USING (
    branch_id IN (
      SELECT b.id FROM public.branches b
      JOIN public.accounts a ON a.id = b.account_id
      WHERE a.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    branch_id IN (
      SELECT b.id FROM public.branches b
      JOIN public.accounts a ON a.id = b.account_id
      WHERE a.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Hospital requests authenticated access" ON public.hospital_stock_requests;
CREATE POLICY "Hospital requests authenticated access"
  ON public.hospital_stock_requests FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Hospital own request mutation" ON public.hospital_stock_requests;
CREATE POLICY "Hospital own request mutation"
  ON public.hospital_stock_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    hospital_account_id IN (
      SELECT id FROM public.accounts WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Regulator recall read" ON public.regulatory_recalls;
CREATE POLICY "Regulator recall read"
  ON public.regulatory_recalls FOR SELECT
  TO authenticated
  USING (true);

