-- Expenses: branch expenditure records created in the POS (Finance tab) and
-- synced up to the portal for profit/loss analysis. Mirrors the local SQLite
-- table in cervos-desktop/src/lib/database.ts.

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  expense_date DATE NOT NULL,
  operator_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS expenses_branch_date_idx ON expenses (branch_id, expense_date);

-- Only the owning pharmacy account can read/write its branch expenses.
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'expenses' AND policyname = 'expenses_account_rw'
  ) THEN
    CREATE POLICY expenses_account_rw ON expenses
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
