-- ============================================================
--  NexusERP — Reports Module Addendum
--  Run AFTER nexuserp_complete_migration.sql and all other addenda.
--  Safe to re-run (idempotent via CREATE … IF NOT EXISTS).
--
--  Adds:
--    1. report_saved_filters  — persisted report filter configurations
--    2. get_trial_balance()   — trial balance aggregation RPC
--    3. get_income_summary()  — monthly revenue vs expense RPC
--    4. Performance indexes
-- ============================================================

-- ────────────────────────────────────────────────────────────
--  1 — SAVED REPORT FILTERS
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS report_saved_filters (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  name        TEXT        NOT NULL,
  report_page TEXT        NOT NULL,   -- 'financial' | 'operations' | 'hr'
  filters     JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE report_saved_filters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_report_saved_filters" ON report_saved_filters;
DROP POLICY IF EXISTS "tenant_report_saved_filters"      ON report_saved_filters;
CREATE POLICY "super_admin_report_saved_filters" ON report_saved_filters
  FOR ALL USING (is_super_admin());
CREATE POLICY "tenant_report_saved_filters"      ON report_saved_filters
  FOR ALL USING (tenant_id = current_tenant_id());

-- ────────────────────────────────────────────────────────────
--  2 — TRIAL BALANCE RPC
--  Aggregates posted journal_entry_lines per account for a
--  given date range. Returns one row per chart-of-accounts
--  entry (even if no transactions exist — balance = 0).
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_trial_balance(
  p_tenant_id UUID,
  p_date_from TEXT,
  p_date_to   TEXT
)
RETURNS TABLE (
  account_code TEXT,
  account_name TEXT,
  account_type TEXT,
  total_debit  NUMERIC,
  total_credit NUMERIC,
  balance      NUMERIC
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT
    coa.code                                             AS account_code,
    coa.name                                             AS account_name,
    coa.account_type                                     AS account_type,
    COALESCE(SUM(f.debit),  0)                          AS total_debit,
    COALESCE(SUM(f.credit), 0)                          AS total_credit,
    COALESCE(SUM(f.debit - f.credit), 0)               AS balance
  FROM chart_of_accounts coa
  LEFT JOIN (
    -- journal_entry_lines uses 'debit'/'credit' columns
    -- (created by nexuserp_supplement_migration.sql)
    SELECT jel.account_id, jel.debit, jel.credit
    FROM journal_entry_lines jel
    INNER JOIN journal_entries je
      ON  je.id         = jel.journal_entry_id
      AND je.tenant_id  = p_tenant_id
      AND je.status     = 'posted'
      AND je.entry_date BETWEEN p_date_from::DATE AND p_date_to::DATE
  ) f ON f.account_id = coa.id
  WHERE coa.tenant_id = p_tenant_id
  GROUP BY coa.id, coa.code, coa.name, coa.account_type
  ORDER BY coa.code;
$$;

-- ────────────────────────────────────────────────────────────
--  3 — INCOME SUMMARY RPC
--  Revenue = sent+paid invoices; Expenses = posted+paid bills.
--  Grouped by calendar month within the requested range.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_income_summary(
  p_tenant_id UUID,
  p_date_from TEXT,
  p_date_to   TEXT
)
RETURNS TABLE (
  period     TEXT,
  revenue    NUMERIC,
  expenses   NUMERIC,
  net_profit NUMERIC
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  WITH months AS (
    SELECT TO_CHAR(gs.d, 'YYYY-MM') AS period
    FROM generate_series(
      date_trunc('month', p_date_from::DATE),
      date_trunc('month', p_date_to::DATE),
      '1 month'::INTERVAL
    ) AS gs(d)
  ),
  rev AS (
    SELECT
      TO_CHAR(invoice_date, 'YYYY-MM') AS period,
      SUM(total_amount)                AS revenue
    FROM invoices
    WHERE tenant_id = p_tenant_id
      AND status IN ('sent', 'paid')
      AND invoice_date BETWEEN p_date_from::DATE AND p_date_to::DATE
    GROUP BY 1
  ),
  exp AS (
    SELECT
      TO_CHAR(bill_date, 'YYYY-MM') AS period,
      SUM(total_amount)             AS expenses
    FROM bills
    WHERE tenant_id = p_tenant_id
      AND status IN ('posted', 'paid')
      AND bill_date BETWEEN p_date_from::DATE AND p_date_to::DATE
    GROUP BY 1
  )
  SELECT
    m.period,
    COALESCE(r.revenue,  0)                           AS revenue,
    COALESCE(e.expenses, 0)                           AS expenses,
    COALESCE(r.revenue, 0) - COALESCE(e.expenses, 0) AS net_profit
  FROM months m
  LEFT JOIN rev r ON r.period = m.period
  LEFT JOIN exp e ON e.period = m.period
  ORDER BY m.period;
$$;

-- ────────────────────────────────────────────────────────────
--  4 — PERFORMANCE INDEXES
-- ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_report_saved_filters_tenant
  ON report_saved_filters(tenant_id);
CREATE INDEX IF NOT EXISTS idx_report_saved_filters_page
  ON report_saved_filters(tenant_id, report_page);
