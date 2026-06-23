import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search, Download, Eye, Trash2 } from 'lucide-react'
import {
  Button, Badge, Table, Thead, Th, Tbody, Tr, Td,
  PageHeader, Card, Modal, Input, Select, Spinner,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import Pagination from '@shared/components/Pagination'
import toast from '@shared/lib/toast'
import { supabase } from '@shared/api/supabase'
import { useTenant } from '@core/tenant/TenantContext'
import {
  PAGE_SIZE_TABLE as PAGE_SIZE,
  PURCHASE_ORDER_STATUS as STATUS,
  PURCHASE_ORDER_STATUS_TABS as STATUS_TABS,
} from '@shared/lib/constants'

const orderSchema = z.object({
  vendor_id:     z.string().min(1, 'Vendor is required'),
  reference:     z.string().trim().min(1, 'Reference is required'),
  order_date:    z.string().min(1, 'Order date is required'),
  expected_date: z.string().optional(),
  notes:         z.string().optional(),
})

function NewOrderModal({ open, onClose, vendors, onCreated }) {
  const { tenantId } = useTenant()
  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(orderSchema),
    defaultValues: { vendor_id: '', reference: '', order_date: '', expected_date: '', notes: '' },
  })

  const onSubmit = async (data) => {
    const { data: orderNumber, error: rpcErr } = await supabase.rpc('generate_po_number')
    if (rpcErr) { toast.error('Failed to generate order number.'); return }

    const { error } = await supabase.from('purchase_orders').insert({
      tenant_id:     tenantId,
      order_number:  orderNumber,
      vendor_id:     data.vendor_id,
      reference:     data.reference,
      order_date:    data.order_date,
      expected_date: data.expected_date || null,
      notes:         data.notes         || null,
      status:        'draft',
    })

    if (error) { toast.error(error.message); return }

    toast.success('Purchase order created.')
    reset()
    onCreated()
    onClose()
  }

  const handleClose = () => { reset(); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title="New Purchase Order" size="md">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-4">
          <Select label="Vendor" error={errors.vendor_id?.message} {...register('vendor_id')}>
            <option value="">Select vendor…</option>
            {vendors.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </Select>

          <Input
            label="Reference"
            placeholder="REF-000"
            error={errors.reference?.message}
            {...register('reference')}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Order Date"
              type="date"
              error={errors.order_date?.message}
              {...register('order_date')}
            />
            <Input
              label="Expected Date"
              type="date"
              {...register('expected_date')}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1.5">
              Notes
            </label>
            <textarea
              rows={2}
              className="w-full px-3 py-2 rounded-lg text-sm
                         text-slate-900 dark:text-slate-200
                         placeholder:text-slate-400 dark:placeholder:text-slate-600
                         bg-white dark:bg-surface-900
                         border border-surface-200 dark:border-surface-700
                         hover:border-surface-300 dark:hover:border-surface-600
                         focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500
                         transition-colors resize-none"
              placeholder="Optional notes…"
              {...register('notes')}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>
              Create Order
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

export default function PurchaseOrders() {
  const { tenantId } = useTenant()
  const [orders,       setOrders]       = useState([])
  const [vendors,      setVendors]      = useState([])
  const [total,        setTotal]        = useState(0)
  const [page,         setPage]         = useState(1)
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading,      setLoading]      = useState(true)
  const [showNew,      setShowNew]      = useState(false)

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const fetchOrders = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      // Resolve vendor IDs matching the search term so we can OR-filter
      let vendorIds = []
      if (search.trim()) {
        const { data: vRows } = await supabase
          .from('vendors')
          .select('id')
          .eq('tenant_id', tenantId)
          .ilike('name', `%${search.trim()}%`)
        vendorIds = (vRows || []).map(v => v.id)
      }

      let query = supabase
        .from('purchase_orders')
        .select(
          'id, order_number, status, order_date, total_amount, reference, vendor:vendors(name)',
          { count: 'exact' },
        )
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      if (search.trim()) {
        const orParts = [`order_number.ilike.%${search.trim()}%`]
        if (vendorIds.length > 0) {
          orParts.push(`vendor_id.in.(${vendorIds.join(',')})`)
        }
        query = query.or(orParts.join(','))
      }

      const { data, count, error } = await query
      if (error) throw error
      setOrders(data || [])
      setTotal(count || 0)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [tenantId, page, search, statusFilter])

  const fetchVendors = useCallback(async () => {
    if (!tenantId) return
    const { data } = await supabase
      .from('vendors')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .order('name')
    setVendors(data || [])
  }, [tenantId])

  useEffect(() => { fetchOrders() }, [fetchOrders])
  useEffect(() => { fetchVendors() }, [fetchVendors])

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1) }, [search, statusFilter])

  const handleApprove = async (id) => {
    const { error } = await supabase
      .from('purchase_orders')
      .update({ status: 'approved' })
      .eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Order approved.')
    fetchOrders()
  }

  const handleDelete = async (id, orderNumber) => {
    if (!window.confirm(`Delete order ${orderNumber}? This cannot be undone.`)) return
    const { error } = await supabase.from('purchase_orders').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Order deleted.')
    fetchOrders()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Orders"
        subtitle={`${total} order${total !== 1 ? 's' : ''}`}
        breadcrumb="Purchase / Orders"
        actions={
          <PermissionGate action="create" moduleId="purchase">
            <Button size="sm" onClick={() => setShowNew(true)}>
              <Plus className="w-4 h-4" />New Order
            </Button>
          </PermissionGate>
        }
      />

      <Card>
        {/* Toolbar */}
        <div className="flex items-center gap-3 p-4 border-b border-surface-200 dark:border-surface-800 flex-wrap">
          <div className="flex items-center gap-2 max-w-xs px-3 py-1.5 rounded-lg
                          bg-surface-100 dark:bg-surface-800
                          border border-surface-200 dark:border-surface-700">
            <Search className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search orders, vendors…"
              className="bg-transparent text-sm text-slate-700 dark:text-slate-300
                         placeholder:text-slate-400 dark:placeholder:text-slate-600
                         flex-1 outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {STATUS_TABS.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  statusFilter === s
                    ? 'bg-brand-600/10 dark:bg-brand-600/20 text-brand-700 dark:text-brand-300 border border-brand-600/20 dark:border-brand-600/30'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {s === 'all' ? 'All' : STATUS[s]?.label}
              </button>
            ))}
          </div>

          <PermissionGate action="export" moduleId="purchase">
            <Button variant="secondary" size="sm" className="ml-auto">
              <Download className="w-3.5 h-3.5" />Export
            </Button>
          </PermissionGate>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner className="w-6 h-6" />
          </div>
        ) : (
          <>
            <Table>
              <Thead>
                <Th>Order #</Th>
                <Th>Vendor</Th>
                <Th>Reference</Th>
                <Th>Date</Th>
                <Th>Amount</Th>
                <Th>Status</Th>
                <Th></Th>
              </Thead>
              <Tbody>
                {orders.map(order => {
                  const s = STATUS[order.status] || STATUS.draft
                  return (
                    <Tr key={order.id}>
                      <Td>
                        <Link to={`/purchase/orders/${order.id}`}>
                          <span className="font-mono text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300">
                            {order.order_number}
                          </span>
                        </Link>
                      </Td>
                      <Td>
                        <span className="font-medium text-slate-900 dark:text-slate-200">{order.vendor?.name || '—'}</span>
                      </Td>
                      <Td>
                        <span className="font-mono text-xs text-slate-500">{order.reference || '—'}</span>
                      </Td>
                      <Td>
                        <span className="text-slate-500">{order.order_date}</span>
                      </Td>
                      <Td>
                        <span className="font-semibold">
                          ${(Number(order.total_amount) || 0).toLocaleString()}
                        </span>
                      </Td>
                      <Td><Badge color={s.color}>{s.label}</Badge></Td>
                      <Td>
                        <div className="flex gap-1">
                          <Link to={`/purchase/orders/${order.id}`}>
                            <Button variant="ghost" size="xs">
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                          <PermissionGate action="approve" moduleId="purchase">
                            {order.status === 'pending' && (
                              <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => handleApprove(order.id)}
                              >
                                Approve
                              </Button>
                            )}
                          </PermissionGate>
                          <PermissionGate action="delete" moduleId="purchase">
                            <Button
                              variant="danger"
                              size="xs"
                              onClick={() => handleDelete(order.id, order.order_number)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </PermissionGate>
                        </div>
                      </Td>
                    </Tr>
                  )
                })}
              </Tbody>
            </Table>

            {orders.length === 0 && (
              <div className="py-12 text-center text-slate-500 text-sm">No orders found.</div>
            )}

            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              total={total}
              pageSize={PAGE_SIZE}
              className="border-t border-surface-200 dark:border-surface-800"
            />
          </>
        )}
      </Card>

      <NewOrderModal
        open={showNew}
        onClose={() => setShowNew(false)}
        vendors={vendors}
        onCreated={fetchOrders}
      />
    </div>
  )
}
