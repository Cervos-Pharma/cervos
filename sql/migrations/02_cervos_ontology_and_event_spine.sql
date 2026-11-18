-- =============================================================================
-- Cervos Ontology & Event Spine Migration v1 (`cp` control plane + `dp` data plane)
-- Specification: Cervos Ontology and Event Spine, Spec v1 (18 Nov 2026)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS cp;
CREATE SCHEMA IF NOT EXISTS dp;

-- -----------------------------------------------------------------------------
-- 1. CONTROL PLANE (`cp`): Governance, Identity Mapping, Commands, Privacy Log
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cp.legacy_id_map (
  legacy_id   text NOT NULL,
  entity_type text NOT NULL,
  id          uuid NOT NULL,
  source      text NOT NULL DEFAULT 'workspace_db',
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (legacy_id, entity_type)
);

CREATE TABLE IF NOT EXISTS cp.org (
  id                  uuid PRIMARY KEY,
  org_type            text NOT NULL CHECK (org_type IN ('pharmacy', 'supplier', 'clinic', 'researcher', 'investor', 'regulator', 'hq')),
  name                text NOT NULL,
  region              text NOT NULL,
  verification_status text NOT NULL DEFAULT 'skipped',
  plan_id             text,
  tin                 text,
  licence_refs        jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cp.branch (
  id               uuid PRIMARY KEY,
  org_id           uuid NOT NULL REFERENCES cp.org(id) ON DELETE CASCADE,
  name             text NOT NULL,
  region           text NOT NULL,
  address          text NOT NULL DEFAULT '',
  lat              double precision,
  lng              double precision,
  status           text NOT NULL DEFAULT 'active',
  pos_activated_at timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cp.person (
  id           uuid PRIMARY KEY,
  email        text UNIQUE,
  username     text UNIQUE,
  display_name text NOT NULL,
  phone        text,
  password_hash text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cp.membership (
  id           uuid PRIMARY KEY,
  person_id    uuid NOT NULL REFERENCES cp.person(id) ON DELETE CASCADE,
  org_id       uuid NOT NULL REFERENCES cp.org(id) ON DELETE CASCADE,
  branch_id    uuid REFERENCES cp.branch(id) ON DELETE CASCADE,
  role         text NOT NULL,
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  pin_hash     text,
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active', 'suspended')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cp.device (
  id                 uuid PRIMARY KEY,
  org_id             uuid NOT NULL REFERENCES cp.org(id) ON DELETE CASCADE,
  branch_id          uuid REFERENCES cp.branch(id) ON DELETE SET NULL,
  platform           text NOT NULL,
  app_version        text NOT NULL DEFAULT '1.0.0',
  model_pack_version text,
  last_sync_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cp.access_state (
  id            uuid PRIMARY KEY,
  org_id        uuid NOT NULL REFERENCES cp.org(id) ON DELETE CASCADE,
  branch_id     uuid REFERENCES cp.branch(id) ON DELETE CASCADE,
  state         text NOT NULL CHECK (state IN ('trial', 'active', 'grace', 'overdue', 'locked', 'suspended')),
  cause         text NOT NULL,
  decided_by    text NOT NULL,
  source_event  uuid,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cp.package (
  id                         text PRIMARY KEY,
  audience                   text NOT NULL CHECK (audience IN ('pharmacy', 'hospital', 'supplier')),
  name                       text NOT NULL,
  price_monthly_tzs          bigint NOT NULL CHECK (price_monthly_tzs >= 5000),
  price_annual_tzs           bigint NOT NULL,
  price_per_branch_monthly   bigint NOT NULL CHECK (price_per_branch_monthly >= 5000),
  included_admins_per_branch int NOT NULL DEFAULT 1,
  included_ops_per_branch    int NOT NULL DEFAULT 1,
  extra_operator_monthly_tzs bigint NOT NULL DEFAULT 5000,
  max_branches               int,
  max_operators              int,
  features                   jsonb NOT NULL DEFAULT '[]'::jsonb,
  active                     boolean NOT NULL DEFAULT true,
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cp.command_log (
  id             uuid PRIMARY KEY,
  org_id         uuid,
  branch_id      uuid,
  device_id      uuid,
  command_name   text NOT NULL,
  payload        jsonb NOT NULL DEFAULT '{}'::jsonb,
  status         text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'acked', 'failed')),
  actor_id       text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  acked_at       timestamptz
);

CREATE TABLE IF NOT EXISTS cp.ticket (
  id             uuid PRIMARY KEY,
  ticket_ref     text UNIQUE NOT NULL,
  org_id         uuid REFERENCES cp.org(id) ON DELETE SET NULL,
  contact_email  text NOT NULL,
  subject        text NOT NULL,
  category       text NOT NULL,
  priority       text NOT NULL,
  status         text NOT NULL,
  assigned_to    uuid REFERENCES cp.person(id) ON DELETE SET NULL,
  internal_note  text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cp.ticket_message (
  id         uuid PRIMARY KEY,
  ticket_id  uuid NOT NULL REFERENCES cp.ticket(id) ON DELETE CASCADE,
  author_role text NOT NULL CHECK (author_role IN ('hq', 'customer')),
  author_name text NOT NULL,
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cp.model_registry (
  id                uuid PRIMARY KEY,
  model_id          text NOT NULL,
  version           text NOT NULL,
  code_hash         text NOT NULL,
  feature_version   text NOT NULL,
  metrics           jsonb NOT NULL DEFAULT '{}'::jsonb,
  status            text NOT NULL DEFAULT 'shadow' CHECK (status IN ('shadow', 'champion', 'demoted')),
  deployed_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cp.data_release_log (
  id                    uuid PRIMARY KEY,
  recipient             text NOT NULL,
  project               text NOT NULL,
  query_summary         text NOT NULL,
  contributing_orgs     int NOT NULL CHECK (contributing_orgs >= 5),
  max_dominance_pct     numeric(5,2) NOT NULL CHECK (max_dominance_pct <= 50.00),
  epsilon_spent         numeric(6,4) NOT NULL,
  approved_by           text NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cp.rate_limit_bucket (
  bucket_key   text PRIMARY KEY,
  attempts     int NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz
);

-- -----------------------------------------------------------------------------
-- 2. DATA PLANE (`dp`): Immutable Partitioned Event Spine, Ontology, Graph
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dp.product_master (
  id               uuid PRIMARY KEY,
  inn              text NOT NULL,
  strength         text NOT NULL,
  form             text NOT NULL,
  route            text NOT NULL,
  atc_code         text NOT NULL,
  controlled_class text NOT NULL DEFAULT 'none',
  barcodes         jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS dp.manufacturer (
  id                uuid PRIMARY KEY,
  name              text NOT NULL,
  country           text NOT NULL DEFAULT 'TZ',
  tmda_registration text
);

CREATE TABLE IF NOT EXISTS dp.product_alias (
  id         uuid PRIMARY KEY,
  org_id     uuid NOT NULL,
  raw_text   text NOT NULL,
  master_id  uuid NOT NULL REFERENCES dp.product_master(id),
  confidence numeric(4,2) NOT NULL,
  status     text NOT NULL CHECK (status IN ('auto', 'review_queue', 'reviewed', 'rejected', 'unresolved')),
  UNIQUE (org_id, raw_text)
);

CREATE TABLE IF NOT EXISTS dp.lot (
  id               uuid PRIMARY KEY,
  master_id        uuid NOT NULL REFERENCES dp.product_master(id),
  manufacturer_id  uuid REFERENCES dp.manufacturer(id),
  batch_number     text NOT NULL,
  expiry_date      date NOT NULL,
  first_seen_event uuid NOT NULL,
  UNIQUE (master_id, manufacturer_id, batch_number)
);

CREATE TABLE IF NOT EXISTS dp.stock_holding (
  branch_id      uuid NOT NULL,
  lot_id         uuid NOT NULL REFERENCES dp.lot(id),
  org_id         uuid NOT NULL,
  qty            integer NOT NULL,
  avg_cost_tzs   numeric(14,2) NOT NULL DEFAULT 0,
  quarantined    boolean NOT NULL DEFAULT false,
  last_event_seq bigint NOT NULL,
  PRIMARY KEY (branch_id, lot_id)
);

CREATE TABLE IF NOT EXISTS dp.edge (
  src_type     text NOT NULL,
  src_id       uuid NOT NULL,
  rel          text NOT NULL,
  dst_type     text NOT NULL,
  dst_id       uuid NOT NULL,
  valid_from   timestamptz NOT NULL,
  valid_to     timestamptz,
  source_event uuid NOT NULL,
  PRIMARY KEY (src_type, src_id, rel, dst_type, dst_id, valid_from)
);

CREATE TABLE IF NOT EXISTS dp.patient_ref (
  org_id     uuid NOT NULL,
  pseudonym  text NOT NULL,
  cipher_pii bytea,
  PRIMARY KEY (org_id, pseudonym)
);

CREATE TABLE IF NOT EXISTS dp.order (
  id             uuid PRIMARY KEY,
  buyer_org_id   uuid NOT NULL,
  supplier_org_id uuid NOT NULL,
  branch_id      uuid NOT NULL,
  state          text NOT NULL CHECK (state IN ('placed', 'confirmed', 'dispatched', 'delivered', 'disputed', 'cancelled', 'closed')),
  total_tzs      bigint NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dp.escrow_account (
  order_id     uuid PRIMARY KEY REFERENCES dp.order(id) ON DELETE CASCADE,
  org_id       uuid NOT NULL,
  state        text NOT NULL CHECK (state IN ('held', 'released', 'refunded', 'disputed')),
  held_tzs     bigint NOT NULL DEFAULT 0,
  released_tzs bigint NOT NULL DEFAULT 0,
  refunded_tzs bigint NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dp.payment (
  id              uuid PRIMARY KEY,
  org_id          uuid NOT NULL,
  provider        text NOT NULL,
  provider_ref    text,
  idempotency_key text UNIQUE NOT NULL,
  amount_tzs      bigint NOT NULL,
  state           text NOT NULL CHECK (state IN ('pending', 'completed', 'failed')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dp.disbursement (
  id           uuid PRIMARY KEY,
  org_id       uuid NOT NULL,
  payment_id   uuid REFERENCES dp.payment(id),
  order_id     uuid REFERENCES dp.order(id),
  net_amount   bigint NOT NULL,
  state        text NOT NULL CHECK (state IN ('queued', 'sent', 'failed')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dp.recall (
  id            uuid PRIMARY KEY,
  regulator_ref text UNIQUE NOT NULL,
  scope         text NOT NULL CHECK (scope IN ('master', 'lot')),
  severity      text NOT NULL,
  state         text NOT NULL CHECK (state IN ('issued', 'matched', 'notified', 'acknowledged', 'quarantined', 'closed')),
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  issued_at     timestamptz NOT NULL DEFAULT now()
);

-- Partitioned Append-Only Event Log
CREATE TABLE IF NOT EXISTS dp.events (
  global_seq      bigint GENERATED ALWAYS AS IDENTITY,
  event_id        uuid NOT NULL,
  org_id          uuid NOT NULL,
  branch_id       uuid,
  device_id       uuid,
  actor_id        uuid,
  actor_kind      text NOT NULL CHECK (actor_kind IN ('staff', 'hq', 'agent', 'system', 'device', 'webhook')),
  type            text NOT NULL,
  schema_version  int NOT NULL DEFAULT 1,
  occurred_at     timestamptz NOT NULL,
  hlc             text NOT NULL,
  received_at     timestamptz NOT NULL DEFAULT now(),
  idempotency_key text NOT NULL,
  correlation_id  uuid,
  causation_id    uuid,
  payload         jsonb NOT NULL,
  pii_class       text NOT NULL DEFAULT 'none' CHECK (pii_class IN ('none', 'pseudonymous', 'personal', 'sensitive')),
  prev_hash       bytea,
  hash            bytea,
  source          text NOT NULL CHECK (source IN ('desktop', 'pwa', 'mobile', 'supplier', 'hq', 'system', 'import')),
  PRIMARY KEY (received_at, event_id),
  UNIQUE (org_id, idempotency_key, received_at)
) PARTITION BY RANGE (received_at);

CREATE TABLE IF NOT EXISTS dp.events_default PARTITION OF dp.events DEFAULT;

-- Append-only enforcement
REVOKE UPDATE, DELETE ON TABLE dp.events FROM PUBLIC, anon, authenticated;

-- Strict tenant-scoped Row-Level Security (zero permissive USING (true))
ALTER TABLE dp.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE dp.stock_holding ENABLE ROW LEVEL SECURITY;
ALTER TABLE dp.product_alias ENABLE ROW LEVEL SECURITY;
ALTER TABLE dp.order ENABLE ROW LEVEL SECURITY;
ALTER TABLE dp.escrow_account ENABLE ROW LEVEL SECURITY;
ALTER TABLE dp.payment ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'dp' AND tablename = 'events' AND policyname = 'dp_events_tenant_iso') THEN
    CREATE POLICY dp_events_tenant_iso ON dp.events
      USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'dp' AND tablename = 'stock_holding' AND policyname = 'dp_stock_tenant_iso') THEN
    CREATE POLICY dp_stock_tenant_iso ON dp.stock_holding
      USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'dp' AND tablename = 'order' AND policyname = 'dp_order_tenant_iso') THEN
    CREATE POLICY dp_order_tenant_iso ON dp.order
      USING (buyer_org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid
          OR supplier_org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'dp' AND tablename = 'payment' AND policyname = 'dp_payment_tenant_iso') THEN
    CREATE POLICY dp_payment_tenant_iso ON dp.payment
      USING (org_id = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
  END IF;
END $$;
