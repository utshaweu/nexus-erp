// ── Pagination ───────────────────────────────────────────────────────────────
export const PAGE_SIZE_TABLE = 10   // table-based list pages
export const PAGE_SIZE_GRID  = 12   // card-grid pages (vendors, customers)

// ── Countries ─────────────────────────────────────────────────────────────────
export const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Argentina','Australia','Austria','Azerbaijan',
  'Bangladesh','Belgium','Bolivia','Brazil','Cambodia','Canada','Chile','China',
  'Colombia','Croatia','Czech Republic','Denmark','Ecuador','Egypt','Ethiopia',
  'Finland','France','Georgia','Germany','Ghana','Greece','Hungary','India',
  'Indonesia','Iran','Iraq','Ireland','Israel','Italy','Japan','Jordan','Kazakhstan',
  'Kenya','Kuwait','Malaysia','Mexico','Morocco','Myanmar','Nepal','Netherlands',
  'New Zealand','Nigeria','Norway','Oman','Pakistan','Peru','Philippines','Poland',
  'Portugal','Qatar','Romania','Russia','Saudi Arabia','Serbia','Singapore',
  'South Africa','South Korea','Spain','Sri Lanka','Sweden','Switzerland','Taiwan',
  'Tanzania','Thailand','Tunisia','Turkey','Uganda','Ukraine',
  'United Arab Emirates','United Kingdom','United States','Uzbekistan',
  'Venezuela','Vietnam','Yemen',
]

// ── Vendor constants ──────────────────────────────────────────────────────────
export const VENDOR_CATEGORIES   = ['General', 'Technology', 'Raw Materials', 'Logistics', 'Services']
export const VENDOR_STATUS_TABS  = ['all', 'active', 'inactive', 'blacklisted']
export const VENDOR_STATUS_LABEL = { all: 'All', active: 'Active', inactive: 'Inactive', blacklisted: 'Blacklisted' }

// ── Customer constants ────────────────────────────────────────────────────────
export const CUSTOMER_INDUSTRIES  = [
  'Technology', 'Retail', 'Finance', 'Manufacturing', 'Consulting',
  'Healthcare', 'Education', 'Logistics', 'Services', 'Other',
]
export const CUSTOMER_STATUS_TABS = ['all', 'active', 'inactive']

// ── Purchase Order status ─────────────────────────────────────────────────────
export const PURCHASE_ORDER_STATUS = {
  draft:     { label: 'Draft',     color: 'default' },
  pending:   { label: 'Pending',   color: 'yellow'  },
  approved:  { label: 'Approved',  color: 'green'   },
  received:  { label: 'Received',  color: 'blue'    },
  cancelled: { label: 'Cancelled', color: 'red'     },
}
export const PURCHASE_ORDER_STATUS_TABS = ['all', 'draft', 'pending', 'approved', 'received', 'cancelled']

// ── RFQ status ────────────────────────────────────────────────────────────────
export const RFQ_STATUS = {
  draft:     { label: 'Draft',           color: 'default' },
  sent:      { label: 'Sent',            color: 'blue'    },
  received:  { label: 'Received',        color: 'green'   },
  expired:   { label: 'Expired',         color: 'red'     },
  converted: { label: 'Converted to PO', color: 'purple'  },
}
export const RFQ_STATUS_TABS = ['all', 'draft', 'sent', 'received', 'expired', 'converted']

// ── Sales Order status ────────────────────────────────────────────────────────
export const SALES_ORDER_STATUS = {
  draft:     { label: 'Draft',     color: 'default' },
  confirmed: { label: 'Confirmed', color: 'blue'    },
  invoiced:  { label: 'Invoiced',  color: 'purple'  },
  done:      { label: 'Done',      color: 'green'   },
  cancelled: { label: 'Cancelled', color: 'red'     },
}
export const SALES_ORDER_STATUS_TABS = ['all', 'draft', 'confirmed', 'invoiced', 'done', 'cancelled']

// ── Quotation status ──────────────────────────────────────────────────────────
export const QUOTATION_STATUS = {
  draft:     { label: 'Draft',     color: 'default' },
  sent:      { label: 'Sent',      color: 'blue'    },
  accepted:  { label: 'Accepted',  color: 'green'   },
  expired:   { label: 'Expired',   color: 'red'     },
  cancelled: { label: 'Cancelled', color: 'red'     },
}
export const QUOTATION_STATUS_TABS = ['all', 'draft', 'sent', 'accepted', 'expired', 'cancelled']

// ── Inventory — Products ──────────────────────────────────────────────────────
export const PRODUCT_CATEGORIES = [
  'Electronics', 'Furniture', 'Supplies', 'Parts', 'Tools',
  'Raw Materials', 'Finished Goods', 'Other',
]
export const PRODUCT_UNITS = [
  'unit', 'piece', 'pair', 'set', 'box', 'carton',
  'kg', 'g', 'litre', 'ml', 'm', 'cm',
]
export const PRODUCT_STATUS = {
  active:   { label: 'Active',   color: 'green'   },
  inactive: { label: 'Inactive', color: 'yellow'  },
  archived: { label: 'Archived', color: 'default' },
}
export const PRODUCT_STATUS_TABS = ['all', 'active', 'inactive', 'archived']

// ── Inventory — Stock Moves ───────────────────────────────────────────────────
export const STOCK_MOVE_TYPES = {
  incoming:   { label: 'Incoming',          color: 'green'  },
  outgoing:   { label: 'Outgoing',          color: 'red'    },
  internal:   { label: 'Internal Transfer', color: 'blue'   },
  adjustment: { label: 'Adjustment',        color: 'purple' },
}
export const STOCK_MOVE_TYPE_TABS = ['all', 'incoming', 'outgoing', 'internal', 'adjustment']
