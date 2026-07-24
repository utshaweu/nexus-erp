import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, FileText } from 'lucide-react'
import {
  Button, Badge, Table, Thead, Th, Tbody, Tr, Td, PageHeader, Card,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import Pagination from '@shared/components/Pagination'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import { PAGE_SIZE_TABLE as PAGE_SIZE, INVOICE_STATUS, INVOICE_STATUS_TABS } from '@shared/lib/constants'
import { fetchInvoices, deleteInvoice, fetchActiveCustomers, fetchActiveProductsForSale } from '../api/invoices'
import { useResourceList } from '../hooks/useResourceList'
import ListToolbar from '../components/ListToolbar'
import { ListLoading, ListEmptyState } from '../components/ListStates'
import InvoiceModal from '../components/InvoiceModal'

const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const STATUS_TABS = INVOICE_STATUS_TABS.map(s => ({ value: s, label: s === 'all' ? 'All' : INVOICE_STATUS[s]?.label }))

export default function Invoices() {
  const { tenantId } = useTenant()
  const [customers, setCustomers] = useState([])
  const [products, setProducts]   = useState([])

  const fetchFn = useCallback(params => fetchInvoices(tenantId, params), [tenantId])
  const {
    items: invoices, total, page, setPage, search, setSearch, filter: statusFilter, setFilter: setStatusFilter,
    loading, refetch, showModal, editItem: editInvoice, openNew, openEdit, closeModal,
  } = useResourceList(fetchFn, [tenantId])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  useEffect(() => { fetchActiveCustomers(tenantId).then(setCustomers) }, [tenantId])
  useEffect(() => { fetchActiveProductsForSale(tenantId).then(setProducts) }, [tenantId])

  const handleDelete = async (inv) => {
    if (!window.confirm(`Delete invoice ${inv.invoice_number}? This cannot be undone.`)) return
    try {
      await deleteInvoice(inv)
      toast.success('Invoice deleted.')
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const searching = Boolean(search || statusFilter !== 'all')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        subtitle="Manage customer invoices and track payments"
        breadcrumb="Accounts / Invoices"
        actions={
          <PermissionGate action="create" moduleId="accounts">
            <Button size="sm" onClick={openNew} className="gap-1.5">
              <Plus className="w-4 h-4" />New Invoice
            </Button>
          </PermissionGate>
        }
      />

      <Card>
        <ListToolbar
          search={search} onSearchChange={setSearch}
          placeholder="Search by invoice number…"
          tabs={STATUS_TABS} activeTab={statusFilter} onTabChange={setStatusFilter}
        />

        {loading ? (
          <ListLoading color="purple" icon={FileText} label="Loading invoices…" />
        ) : invoices.length === 0 ? (
          <ListEmptyState
            color="purple" icon={FileText} searching={searching}
            title="No invoices yet" description="Create your first invoice to start tracking payments."
            searchingTitle="No invoices match" searchingDescription="Try adjusting your search or filter."
            action={
              <PermissionGate action="create" moduleId="accounts">
                <Button size="sm" onClick={openNew} className="gap-1.5">
                  <Plus className="w-4 h-4" />Create First Invoice
                </Button>
              </PermissionGate>
            }
          />
        ) : (
          <Table>
            <Thead>
              <Th>Invoice #</Th>
              <Th>Customer</Th>
              <Th>Invoice Date</Th>
              <Th>Due Date</Th>
              <Th>Total</Th>
              <Th>Paid</Th>
              <Th>Status</Th>
              <Th></Th>
            </Thead>
            <Tbody>
              {invoices.map(inv => (
                <Tr key={inv.id} onClick={() => openEdit(inv)}>
                  <Td>
                    <span className="font-mono text-xs font-medium
                                     text-purple-600 dark:text-purple-400
                                     bg-purple-50 dark:bg-purple-500/10
                                     px-2 py-0.5 rounded-md">
                      {inv.invoice_number}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {inv.customer?.name || '—'}
                    </span>
                  </Td>
                  <Td><span className="text-sm text-slate-600 dark:text-slate-400">{inv.invoice_date}</span></Td>
                  <Td><span className="text-sm text-slate-600 dark:text-slate-400">{inv.due_date || '—'}</span></Td>
                  <Td>
                    <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                      ${fmt(inv.total_amount)}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-mono text-sm text-emerald-600 dark:text-emerald-400">
                      ${fmt(inv.paid_amount)}
                    </span>
                  </Td>
                  <Td>
                    <Badge color={INVOICE_STATUS[inv.status]?.color || 'default'}>
                      {INVOICE_STATUS[inv.status]?.label || inv.status}
                    </Badge>
                  </Td>
                  <Td onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <PermissionGate action="edit" moduleId="accounts">
                        <Button variant="ghost" size="xs" onClick={() => openEdit(inv)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </PermissionGate>
                      <PermissionGate action="delete" moduleId="accounts">
                        <Button variant="danger" size="xs" onClick={() => handleDelete(inv)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </PermissionGate>
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}

        <Pagination
          page={page} totalPages={totalPages} onPageChange={setPage}
          total={total} pageSize={PAGE_SIZE} label="invoices"
          className="border-t border-surface-200 dark:border-surface-800"
        />
      </Card>

      <InvoiceModal
        open={showModal} onClose={closeModal} onSaved={refetch}
        invoice={editInvoice} customers={customers} products={products}
      />
    </div>
  )
}
