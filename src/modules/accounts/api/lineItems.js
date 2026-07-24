import { z } from 'zod'

// Shared by Invoices and Bills — both post a product-driven line (qty × unit
// price × tax), just against a different price field (sale_price / cost_price).
export const lineItemSchema = z.object({
  description: z.string().trim().min(1, 'Select a product'),
  quantity:    z.coerce.number({ invalid_type_error: 'Enter a number' }).min(0.01, 'Must be > 0'),
  unit_price:  z.coerce.number({ invalid_type_error: 'Enter a number' }).min(0, 'Must be ≥ 0'),
  tax_rate:    z.coerce.number({ invalid_type_error: 'Enter a number' }).min(0).max(100),
})

export const DEFAULT_LINE_ITEM = { description: '', quantity: 1, unit_price: 0, tax_rate: 0 }

export const lineItemTotal = (l) =>
  Number(l.quantity || 0) * Number(l.unit_price || 0) * (1 + Number(l.tax_rate || 0) / 100)

export const computeLineItemTotals = (lines = []) => {
  const subtotal   = lines.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unit_price || 0), 0)
  const tax_amount = lines.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unit_price || 0) * Number(l.tax_rate || 0) / 100, 0)
  return { subtotal, tax_amount, total_amount: subtotal + tax_amount }
}
