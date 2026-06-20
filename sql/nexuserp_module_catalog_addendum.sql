-- ============================================================
--  NexusERP — Module Catalogue Addendum Migration
--  Run this AFTER nexuserp_complete_migration.sql
--
--  Adds a GLOBAL `module_catalog` table that holds the display
--  metadata for every module (name, description, features,
--  menu_items, icon, colour, category, version, dependencies).
--
--  This is the database source for what used to be hardcoded in
--  each src/modules/<name>/index.js manifest. Code manifests stay
--  as the fallback + the owner of non-serialisable fields
--  (routes, storeSlice, onInstall/onUninstall). The registry
--  merges DB rows OVER the code manifest at login.
--
--  The catalogue is GLOBAL (not tenant-scoped). Which modules a
--  tenant has *installed* still lives in `tenant_modules`.
-- ============================================================

CREATE TABLE IF NOT EXISTS module_catalog (
  module_id    TEXT          PRIMARY KEY,
  name         TEXT          NOT NULL,
  description  TEXT,
  version      TEXT          DEFAULT '1.0.0',
  icon         TEXT,                       -- Lucide icon name (resolved to a component in the app)
  color        TEXT,
  category     TEXT,
  features     JSONB         NOT NULL DEFAULT '[]'::jsonb,
  dependencies JSONB         NOT NULL DEFAULT '[]'::jsonb,
  menu_items   JSONB         NOT NULL DEFAULT '[]'::jsonb,
  sort_order   INT           NOT NULL DEFAULT 0,
  is_active    BOOLEAN       NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ── RLS ───────────────────────────────────────────────────────
-- Catalogue is global, non-sensitive metadata: any authenticated
-- user may READ it; only super admins may modify it.
ALTER TABLE module_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_module_catalog"        ON module_catalog;
DROP POLICY IF EXISTS "super_admin_module_catalog" ON module_catalog;

CREATE POLICY "read_module_catalog"
  ON module_catalog FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "super_admin_module_catalog"
  ON module_catalog FOR ALL
  USING (is_super_admin());

CREATE INDEX IF NOT EXISTS idx_module_catalog_active ON module_catalog (is_active, sort_order);

-- ── Seed: exact metadata mirroring the current code manifests ──
-- Idempotent: re-running refreshes every column from these values.
INSERT INTO module_catalog
  (module_id, name, description, version, icon, color, category, features, dependencies, menu_items, sort_order)
VALUES
  (
    'purchase', 'Purchase',
    'Manage purchase orders, vendor relationships, RFQs, and procurement workflows.',
    '1.0.0', 'ShoppingCart', '#f59e0b', 'Operations',
    '["Purchase Orders","Request for Quotations (RFQ)","Vendor Management","Purchase Approvals","Purchase Analytics"]'::jsonb,
    '[]'::jsonb,
    '[
      {"id":"purchase-dashboard","label":"Dashboard","path":"/purchase","icon":"LayoutDashboard","order":1,"requiredPermission":{"action":"view","moduleId":"purchase"}},
      {"id":"purchase-orders","label":"Purchase Orders","path":"/purchase/orders","icon":"FileText","order":2,"requiredPermission":{"action":"view","moduleId":"purchase"}},
      {"id":"purchase-rfq","label":"RFQ","path":"/purchase/rfq","icon":"ClipboardList","order":3,"requiredPermission":{"action":"view","moduleId":"purchase"}},
      {"id":"purchase-vendors","label":"Vendors","path":"/purchase/vendors","icon":"Building2","order":4,"requiredPermission":{"action":"view","moduleId":"purchase"}}
    ]'::jsonb,
    1
  ),
  (
    'sales', 'Sales',
    'Drive revenue with quotations, sales orders, customer management, and pipeline analytics.',
    '1.0.0', 'TrendingUp', '#10b981', 'Operations',
    '["Quotations & Sales Orders","Customer Management","Offers & Discount Rules","Coupon Code Management","Sales Pipeline","Revenue Analytics"]'::jsonb,
    '[]'::jsonb,
    '[
      {"id":"sales-dashboard","label":"Dashboard","path":"/sales","icon":"LayoutDashboard","order":1,"requiredPermission":{"action":"view","moduleId":"sales"}},
      {"id":"sales-orders","label":"Sales Orders","path":"/sales/orders","icon":"FileText","order":2,"requiredPermission":{"action":"view","moduleId":"sales"}},
      {"id":"sales-quotations","label":"Quotations","path":"/sales/quotations","icon":"ClipboardList","order":3,"requiredPermission":{"action":"view","moduleId":"sales"}},
      {"id":"sales-customers","label":"Customers","path":"/sales/customers","icon":"Users","order":4,"requiredPermission":{"action":"view","moduleId":"sales"}},
      {"id":"sales-offers","label":"Offers & Discounts","path":"/sales/offers","icon":"Tag","order":5,"requiredPermission":{"action":"view","moduleId":"sales"}}
    ]'::jsonb,
    2
  ),
  (
    'inventory', 'Inventory',
    'Track stock levels, warehouses, product movements, and reorder rules.',
    '1.0.0', 'Package', '#3b82f6', 'Operations',
    '["Product Catalog","Stock Management","Warehouse Locations","Delivery & Receipts","Reorder Rules"]'::jsonb,
    '["purchase"]'::jsonb,
    '[
      {"id":"inv-dashboard","label":"Dashboard","path":"/inventory","icon":"LayoutDashboard","order":1},
      {"id":"inv-products","label":"Products","path":"/inventory/products","icon":"Package","order":2},
      {"id":"inv-stock","label":"Stock Moves","path":"/inventory/stock","icon":"ArrowLeftRight","order":3},
      {"id":"inv-warehouses","label":"Warehouses","path":"/inventory/warehouses","icon":"Warehouse","order":4}
    ]'::jsonb,
    3
  ),
  (
    'accounts', 'Accounts',
    'Full financial management: invoices, bills, journals, reconciliation, and financial reports.',
    '1.0.0', 'DollarSign', '#8b5cf6', 'Finance',
    '["Chart of Accounts","Customer Invoices","Vendor Bills","Payment Reconciliation","Journal Entries","P&L & Balance Sheet"]'::jsonb,
    '[]'::jsonb,
    '[
      {"id":"acc-dashboard","label":"Dashboard","path":"/accounts","icon":"LayoutDashboard","order":1},
      {"id":"acc-invoices","label":"Invoices","path":"/accounts/invoices","icon":"FileText","order":2},
      {"id":"acc-bills","label":"Bills","path":"/accounts/bills","icon":"Receipt","order":3},
      {"id":"acc-journals","label":"Journals","path":"/accounts/journals","icon":"BookOpen","order":4},
      {"id":"acc-coa","label":"Chart of Accounts","path":"/accounts/coa","icon":"List","order":5}
    ]'::jsonb,
    4
  ),
  (
    'hr', 'Human Resources',
    'Manage employees, departments, attendance, leave, and payroll.',
    '1.0.0', 'Users', '#ec4899', 'Human Resources',
    '["Employee Directory","Departments & Positions","Attendance Tracking","Leave Management","Payroll"]'::jsonb,
    '[]'::jsonb,
    '[
      {"id":"hr-dashboard","label":"Dashboard","path":"/hr","icon":"LayoutDashboard","order":1},
      {"id":"hr-employees","label":"Employees","path":"/hr/employees","icon":"Users","order":2},
      {"id":"hr-departments","label":"Departments","path":"/hr/departments","icon":"Building","order":3},
      {"id":"hr-attendance","label":"Attendance","path":"/hr/attendance","icon":"Clock","order":4},
      {"id":"hr-movement","label":"Movement","path":"/hr/movement","icon":"ArrowLeftRight","order":5},
      {"id":"hr-leave","label":"Leave","path":"/hr/leave","icon":"Calendar","order":6},
      {"id":"hr-payroll","label":"Payroll","path":"/hr/payroll","icon":"DollarSign","order":7}
    ]'::jsonb,
    5
  ),
  (
    'configuration', 'Configuration',
    'System-wide settings: company info, users, roles, fiscal years, and module settings.',
    '1.0.0', 'Settings', '#64748b', 'System',
    '["Company Settings","Users & Roles","Module Settings","Fiscal Periods","Currency"]'::jsonb,
    '[]'::jsonb,
    '[
      {"id":"cfg-company","label":"Company","path":"/configuration/company","icon":"Building2","order":1},
      {"id":"cfg-users","label":"Users & Roles","path":"/configuration/users","icon":"UserCog","order":2},
      {"id":"cfg-modules","label":"Module Settings","path":"/configuration/modules","icon":"Puzzle","order":3},
      {"id":"cfg-fiscal","label":"Fiscal Periods","path":"/configuration/fiscal","icon":"CalendarDays","order":4}
    ]'::jsonb,
    6
  ),
  (
    'reports', 'Reports',
    'Dynamic reports across all installed modules. Export to PDF and Excel.',
    '1.0.0', 'BarChart2', '#a855f7', 'Analytics',
    '["Cross-module Analytics","Financial Reports","Operations Reports","Export to PDF & Excel","Scheduled Reports","Custom Dashboards"]'::jsonb,
    '[]'::jsonb,
    '[
      {"id":"rpt-overview","label":"Overview","path":"/reports","icon":"BarChart2","order":1},
      {"id":"rpt-financial","label":"Financial","path":"/reports/financial","icon":"DollarSign","order":2},
      {"id":"rpt-operations","label":"Operations","path":"/reports/operations","icon":"Activity","order":3},
      {"id":"rpt-hr","label":"HR Reports","path":"/reports/hr","icon":"Users","order":4}
    ]'::jsonb,
    7
  ),
  (
    'assets', 'Assets',
    'Track and manage fixed assets, depreciation schedules, maintenance, and disposal.',
    '1.0.0', 'Cpu', '#f97316', 'Finance',
    '["Asset Registry","Depreciation Schedules","Asset Categories","Maintenance Tracking","Asset Disposal","Asset Reports"]'::jsonb,
    '["accounts"]'::jsonb,
    '[
      {"id":"asset-dashboard","label":"Dashboard","path":"/assets","icon":"LayoutDashboard","order":1},
      {"id":"asset-list","label":"Assets","path":"/assets/list","icon":"Cpu","order":2},
      {"id":"asset-depreciation","label":"Depreciation","path":"/assets/depreciation","icon":"TrendingDown","order":3},
      {"id":"asset-categories","label":"Categories","path":"/assets/categories","icon":"Tag","order":4},
      {"id":"asset-maintenance","label":"Maintenance","path":"/assets/maintenance","icon":"Wrench","order":5}
    ]'::jsonb,
    8
  ),
  (
    'approval', 'Approvals',
    'Configurable multi-level approval workflows for any ERP document or request.',
    '1.0.0', 'CheckSquare', '#06b6d4', 'Operations',
    '["Multi-level Approval Workflows","Approval Templates","Delegation Support","Approval History & Audit Trail","Email & In-app Notifications","Approval Dashboard"]'::jsonb,
    '[]'::jsonb,
    '[
      {"id":"approval-dashboard","label":"Dashboard","path":"/approval","icon":"LayoutDashboard","order":1},
      {"id":"approval-pending","label":"Pending Approvals","path":"/approval/pending","icon":"Clock","order":2},
      {"id":"approval-my","label":"My Requests","path":"/approval/my-requests","icon":"Send","order":3},
      {"id":"approval-workflows","label":"Workflows","path":"/approval/workflows","icon":"GitBranch","order":4},
      {"id":"approval-history","label":"History","path":"/approval/history","icon":"History","order":5}
    ]'::jsonb,
    9
  )
ON CONFLICT (module_id) DO UPDATE SET
  name         = EXCLUDED.name,
  description  = EXCLUDED.description,
  version      = EXCLUDED.version,
  icon         = EXCLUDED.icon,
  color        = EXCLUDED.color,
  category     = EXCLUDED.category,
  features     = EXCLUDED.features,
  dependencies = EXCLUDED.dependencies,
  menu_items   = EXCLUDED.menu_items,
  sort_order   = EXCLUDED.sort_order,
  updated_at   = now();
