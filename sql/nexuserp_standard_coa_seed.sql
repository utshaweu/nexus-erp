-- ============================================================
--  Standard Chart of Accounts — seed script
--  Populates chart_of_accounts for a single tenant with a
--  conventional small/mid-size business account structure.
--
--  HOW TO USE:
--    1. Replace v_tenant_id below with the target tenant's UUID
--       (select id from tenants where name = '...';)
--    2. Run this whole file once in the Supabase SQL editor.
--    3. Safe to re-run — existing codes are skipped (ON CONFLICT).
-- ============================================================

DO $$
DECLARE
  v_tenant_id UUID := '6a05568b-0d65-4eeb-8644-ceba579a002f'; -- REPLACE with your tenant's UUID
BEGIN

  -- ── 1. Header + detail accounts (flat insert, no parent yet) ──────────────
  INSERT INTO chart_of_accounts (tenant_id, code, name, account_type, is_active) VALUES
    -- 1000s — ASSETS
    (v_tenant_id, '1000', 'Assets',                          'asset', true),
    (v_tenant_id, '1010', 'Cash and Cash Equivalents',       'asset', true),
    (v_tenant_id, '1020', 'Petty Cash',                       'asset', true),
    (v_tenant_id, '1030', 'Accounts Receivable',              'asset', true),
    (v_tenant_id, '1040', 'Inventory',                        'asset', true),
    (v_tenant_id, '1050', 'Prepaid Expenses',                 'asset', true),
    (v_tenant_id, '1060', 'Other Current Assets',             'asset', true),
    (v_tenant_id, '1500', 'Property, Plant & Equipment',      'asset', true),
    (v_tenant_id, '1510', 'Furniture and Fixtures',           'asset', true),
    (v_tenant_id, '1520', 'Office Equipment',                 'asset', true),
    (v_tenant_id, '1530', 'Vehicles',                         'asset', true),
    (v_tenant_id, '1540', 'Buildings',                        'asset', true),
    (v_tenant_id, '1590', 'Accumulated Depreciation',         'asset', true),
    (v_tenant_id, '1600', 'Other Non-Current Assets',         'asset', true),

    -- 2000s — LIABILITIES
    (v_tenant_id, '2000', 'Liabilities',                      'liability', true),
    (v_tenant_id, '2010', 'Accounts Payable',                 'liability', true),
    (v_tenant_id, '2020', 'Accrued Liabilities',               'liability', true),
    (v_tenant_id, '2030', 'Sales Tax Payable',                 'liability', true),
    (v_tenant_id, '2040', 'Payroll Liabilities',               'liability', true),
    (v_tenant_id, '2050', 'Short-Term Loans',                  'liability', true),
    (v_tenant_id, '2060', 'Current Portion of Long-Term Debt',  'liability', true),
    (v_tenant_id, '2500', 'Long-Term Liabilities',              'liability', true),
    (v_tenant_id, '2510', 'Long-Term Loans Payable',            'liability', true),
    (v_tenant_id, '2520', 'Deferred Tax Liability',             'liability', true),

    -- 3000s — EQUITY
    (v_tenant_id, '3000', 'Equity',                           'equity', true),
    (v_tenant_id, '3010', 'Owner''s Capital',                 'equity', true),
    (v_tenant_id, '3020', 'Retained Earnings',                 'equity', true),
    (v_tenant_id, '3030', 'Owner''s Drawings',                 'equity', true),
    (v_tenant_id, '3040', 'Additional Paid-in Capital',        'equity', true),

    -- 4000s — REVENUE
    (v_tenant_id, '4000', 'Revenue',                          'revenue', true),
    (v_tenant_id, '4010', 'Sales Revenue',                     'revenue', true),
    (v_tenant_id, '4020', 'Service Revenue',                   'revenue', true),
    (v_tenant_id, '4030', 'Other Income',                      'revenue', true),
    (v_tenant_id, '4040', 'Interest Income',                   'revenue', true),
    (v_tenant_id, '4900', 'Sales Returns and Allowances',      'revenue', true),

    -- 5000s — EXPENSES
    (v_tenant_id, '5000', 'Expenses',                         'expense', true),
    (v_tenant_id, '5010', 'Cost of Goods Sold',                'expense', true),
    (v_tenant_id, '5100', 'Salaries and Wages',                'expense', true),
    (v_tenant_id, '5110', 'Employee Benefits',                 'expense', true),
    (v_tenant_id, '5120', 'Payroll Tax Expense',                'expense', true),
    (v_tenant_id, '5200', 'Rent Expense',                      'expense', true),
    (v_tenant_id, '5210', 'Utilities Expense',                 'expense', true),
    (v_tenant_id, '5220', 'Office Supplies Expense',            'expense', true),
    (v_tenant_id, '5230', 'Insurance Expense',                  'expense', true),
    (v_tenant_id, '5240', 'Depreciation Expense',               'expense', true),
    (v_tenant_id, '5250', 'Repairs and Maintenance',            'expense', true),
    (v_tenant_id, '5260', 'Advertising and Marketing',          'expense', true),
    (v_tenant_id, '5270', 'Travel Expense',                     'expense', true),
    (v_tenant_id, '5280', 'Professional Fees',                  'expense', true),
    (v_tenant_id, '5290', 'Bank Fees and Charges',               'expense', true),
    (v_tenant_id, '5300', 'Telephone and Internet',              'expense', true),
    (v_tenant_id, '5400', 'Interest Expense',                    'expense', true),
    (v_tenant_id, '5500', 'Bad Debt Expense',                    'expense', true),
    (v_tenant_id, '5900', 'Miscellaneous Expense',               'expense', true)
  ON CONFLICT (tenant_id, code) DO NOTHING;

  -- ── 2. Wire up parent/child relationships by code ──────────────────────────
  UPDATE chart_of_accounts c
  SET parent_id = p.id
  FROM (VALUES
    ('1010','1000'), ('1020','1000'), ('1030','1000'), ('1040','1000'),
    ('1050','1000'), ('1060','1000'), ('1500','1000'), ('1600','1000'),
    ('1510','1500'), ('1520','1500'), ('1530','1500'), ('1540','1500'), ('1590','1500'),

    ('2010','2000'), ('2020','2000'), ('2030','2000'), ('2040','2000'),
    ('2050','2000'), ('2060','2000'), ('2500','2000'),
    ('2510','2500'), ('2520','2500'),

    ('3010','3000'), ('3020','3000'), ('3030','3000'), ('3040','3000'),

    ('4010','4000'), ('4020','4000'), ('4030','4000'), ('4040','4000'), ('4900','4000'),

    ('5010','5000'), ('5100','5000'), ('5200','5000'), ('5220','5000'),
    ('5230','5000'), ('5240','5000'), ('5250','5000'), ('5260','5000'),
    ('5270','5000'), ('5280','5000'), ('5290','5000'), ('5300','5000'),
    ('5400','5000'), ('5500','5000'), ('5900','5000'),
    ('5110','5100'), ('5120','5100'),
    ('5210','5200')
  ) AS m(code, parent_code)
  JOIN chart_of_accounts p ON p.code = m.parent_code AND p.tenant_id = v_tenant_id
  WHERE c.code = m.code AND c.tenant_id = v_tenant_id;

END $$;
