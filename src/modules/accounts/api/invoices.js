import { supabase } from '@shared/api/supabase'
import { PAGE_SIZE_TABLE as PAGE_SIZE } from '@shared/lib/constants'
import { computeLineItemTotals } from './lineItems'

export async function fetchInvoices(tenantId, { page, search, filter }) {
  if (!tenantId) return { items: [], total: 0 }

  let query = supabase
    .from('invoices')
    .select('*, customer:customer_id(name)', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('invoice_date', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (filter !== 'all') query = query.eq('status', filter)
  if (search.trim()) query = query.ilike('invoice_number', `%${search.trim()}%`)

  const { data, count, error } = await query
  if (error) throw error
  return { items: data || [], total: count || 0 }
}

export async function fetchInvoiceLines(invoiceId) {
  const { data } = await supabase
    .from('invoice_lines')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('id')
  return data || []
}

/** Creates or updates an invoice header + wholesale-replaces its lines. */
export async function saveInvoice(tenantId, invoice, data) {
  const isEdit = Boolean(invoice)
  const { subtotal, tax_amount, total_amount } = computeLineItemTotals(data.lines)
  const header = {
    customer_id:  data.customer_id,
    invoice_date: data.invoice_date,
    due_date:     data.due_date || null,
    notes:        data.notes    || null,
    status:       data.status,
    subtotal, tax_amount, total_amount,
  }

  let invoiceId = invoice?.id
  if (isEdit) {
    const { error } = await supabase.from('invoices').update(header).eq('id', invoiceId)
    if (error) throw error
    await supabase.from('invoice_lines').delete().eq('invoice_id', invoiceId)
  } else {
    const { data: num, error: numErr } = await supabase.rpc('generate_invoice_number')
    if (numErr) throw numErr
    const { data: inv, error } = await supabase
      .from('invoices')
      .insert({ ...header, tenant_id: tenantId, invoice_number: num })
      .select('id')
      .single()
    if (error) throw error
    invoiceId = inv.id
  }

  const lines = data.lines.map(l => ({
    tenant_id: tenantId, invoice_id: invoiceId,
    description: l.description, quantity: l.quantity, unit_price: l.unit_price, tax_rate: l.tax_rate,
    total_price: Number(l.quantity) * Number(l.unit_price) * (1 + Number(l.tax_rate) / 100),
  }))
  const { error: lineErr } = await supabase.from('invoice_lines').insert(lines)
  if (lineErr) throw lineErr
}

export async function deleteInvoice(invoice) {
  await supabase.from('invoice_lines').delete().eq('invoice_id', invoice.id)
  const { error } = await supabase.from('invoices').delete().eq('id', invoice.id)
  if (error) throw error
}

export async function fetchActiveCustomers(tenantId) {
  if (!tenantId) return []
  const { data } = await supabase
    .from('customers')
    .select('id, name')
    .eq('tenant_id', tenantId).eq('status', 'active').order('name')
  return data || []
}

export async function fetchActiveProductsForSale(tenantId) {
  if (!tenantId) return []
  const { data } = await supabase
    .from('products')
    .select('id, name, sale_price')
    .eq('tenant_id', tenantId).eq('status', 'active').order('name')
  return data || []
}
