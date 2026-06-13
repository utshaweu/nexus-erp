import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search, Mail, Phone, MapPin, Trash2, Pencil, Users } from 'lucide-react'
import {
  Button, Badge, PageHeader, Card, Modal, Input, Select, Spinner, EmptyState,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import Pagination from '@shared/components/Pagination'
import toast from '@shared/lib/toast'
import { supabase } from '@shared/api/supabase'
import { useTenant } from '@core/tenant/TenantContext'
import {
  PAGE_SIZE_GRID as PAGE_SIZE,
  COUNTRIES,
  CUSTOMER_INDUSTRIES as INDUSTRIES,
  CUSTOMER_STATUS_TABS as STATUS_TABS,
} from '@shared/lib/constants'

const customerSchema = z.object({
  name:         z.string().trim().min(1, 'Company name is required'),
  contact_name: z.string().trim().optional(),
  email:        z.string().email('Enter a valid email').or(z.literal('')).optional(),
  phone:        z.string().trim().optional(),
  country:      z.string().trim().optional(),
  address:      z.string().trim().optional(),
  industry:     z.string().trim().optional(),
  status:       z.enum(['active', 'inactive']),
  credit_limit: z.coerce.number().min(0).optional(),
})

function CustomerCard({ customer, onEdit, onDelete }) {
  return (
    <Card className="p-5 hover:border-slate-300 dark:hover:border-surface-700 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 mr-2">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">{customer.name}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{customer.industry || 'General'}</p>
        </div>
        <Badge color={customer.status === 'active' ? 'green' : 'default'}>{customer.status}</Badge>
      </div>

      <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400 mb-4">
        {customer.email && (
          <div className="flex items-center gap-1.5">
            <Mail className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{customer.email}</span>
          </div>
        )}
        {customer.phone && (
          <div className="flex items-center gap-1.5">
            <Phone className="w-3 h-3 flex-shrink-0" />
            <span>{customer.phone}</span>
          </div>
        )}
        {customer.country && (
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span>{customer.country}</span>
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-surface-200 dark:border-surface-800 flex items-center justify-between">
        {customer.contact_name
          ? <span className="text-xs text-slate-500 truncate mr-2">{customer.contact_name}</span>
          : <span />
        }
        <div className="flex gap-1 flex-shrink-0">
          <PermissionGate action="edit" moduleId="sales">
            <Button variant="ghost" size="xs" onClick={() => onEdit(customer)}>
              <Pencil className="w-3 h-3" />
            </Button>
          </PermissionGate>
          <PermissionGate action="delete" moduleId="sales">
            <Button variant="danger" size="xs" onClick={() => onDelete(customer)}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </PermissionGate>
        </div>
      </div>
    </Card>
  )
}

function CustomerModal({ open, onClose, onSaved, customer }) {
  const { tenantId } = useTenant()
  const isEdit = Boolean(customer)

  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: '', contact_name: '', email: '', phone: '',
      country: '', address: '', industry: '', status: 'active', credit_limit: 0,
    },
  })

  useEffect(() => {
    if (open) {
      reset(
        customer
          ? {
              name:         customer.name         || '',
              contact_name: customer.contact_name || '',
              email:        customer.email        || '',
              phone:        customer.phone        || '',
              country:      customer.country      || '',
              address:      customer.address      || '',
              industry:     customer.industry     || '',
              status:       customer.status       || 'active',
              credit_limit: Number(customer.credit_limit) || 0,
            }
          : {
              name: '', contact_name: '', email: '', phone: '',
              country: '', address: '', industry: '', status: 'active', credit_limit: 0,
            },
      )
    }
  }, [open, customer, reset])

  const onSubmit = async (data) => {
    const payload = {
      name:         data.name,
      contact_name: data.contact_name || null,
      email:        data.email        || null,
      phone:        data.phone        || null,
      country:      data.country      || null,
      address:      data.address      || null,
      industry:     data.industry     || null,
      status:       data.status,
      credit_limit: data.credit_limit || 0,
    }

    if (isEdit) {
      const { error } = await supabase
        .from('customers')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', customer.id)
      if (error) { toast.error(error.message); return }
      toast.success('Customer updated.')
    } else {
      const { error } = await supabase.from('customers').insert({ ...payload, tenant_id: tenantId })
      if (error) { toast.error(error.message); return }
      toast.success('Customer added.')
    }

    onSaved()
    onClose()
  }

  const handleClose = () => { reset(); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title={isEdit ? 'Edit Customer' : 'New Customer'} size="md">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input
                label="Company Name"
                placeholder="Customer company name"
                error={errors.name?.message}
                {...register('name')}
              />
            </div>
            <Input
              label="Contact Person"
              placeholder="Full name"
              {...register('contact_name')}
            />
            <Input
              label="Email"
              type="email"
              placeholder="contact@company.com"
              error={errors.email?.message}
              {...register('email')}
            />
            <Input label="Phone" placeholder="+1-555-0000" {...register('phone')} />
            <Select label="Country" {...register('country')}>
              <option value="">Select country…</option>
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
            <div className="col-span-2">
              <Input label="Address" placeholder="Street, city, zip" {...register('address')} />
            </div>
            <Select label="Industry" {...register('industry')}>
              <option value="">Select industry…</option>
              {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
            </Select>
            <Select label="Status" {...register('status')}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
            <div className="col-span-2">
              <Input
                label="Credit Limit ($)"
                type="number"
                placeholder="0"
                min="0"
                step="100"
                {...register('credit_limit')}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>
              {isEdit ? 'Save Changes' : 'Add Customer'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

export default function Customers() {
  const { tenantId }   = useTenant()
  const [customers,    setCustomers]    = useState([])
  const [total,        setTotal]        = useState(0)
  const [page,         setPage]         = useState(1)
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading,      setLoading]      = useState(true)
  const [showModal,    setShowModal]    = useState(false)
  const [editCustomer, setEditCustomer] = useState(null)

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const fetchCustomers = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      let query = supabase
        .from('customers')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('name')
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      if (search.trim()) {
        query = query.or(
          `name.ilike.%${search.trim()}%,contact_name.ilike.%${search.trim()}%,industry.ilike.%${search.trim()}%`,
        )
      }

      const { data, count, error } = await query
      if (error) throw error
      setCustomers(data || [])
      setTotal(count || 0)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [tenantId, page, search, statusFilter])

  useEffect(() => { fetchCustomers() }, [fetchCustomers])
  useEffect(() => { setPage(1) },       [search, statusFilter])

  const openNew    = ()  => { setEditCustomer(null); setShowModal(true)  }
  const openEdit   = (c) => { setEditCustomer(c);    setShowModal(true)  }
  const closeModal = ()  => { setShowModal(false);   setEditCustomer(null) }

  const handleDelete = async (customer) => {
    if (!window.confirm(`Delete customer "${customer.name}"? This cannot be undone.`)) return
    const { error } = await supabase.from('customers').delete().eq('id', customer.id)
    if (error) { toast.error(error.message); return }
    toast.success('Customer deleted.')
    fetchCustomers()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        subtitle={`${total} customer${total !== 1 ? 's' : ''}`}
        breadcrumb="Sales / Customers"
        actions={
          <PermissionGate action="create" moduleId="sales">
            <Button size="sm" onClick={openNew}>
              <Plus className="w-4 h-4" />New Customer
            </Button>
          </PermissionGate>
        }
      />

      <Card>
        <div className="flex items-center gap-3 p-4 border-b border-surface-200 dark:border-surface-800 flex-wrap">
          <div className="flex items-center gap-2 w-64 px-3 py-1.5 rounded-lg
                          bg-slate-50 dark:bg-surface-800
                          border border-surface-200 dark:border-surface-700">
            <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search customers…"
              className="bg-transparent text-sm text-slate-700 dark:text-slate-300
                         placeholder:text-slate-400 dark:placeholder:text-slate-600
                         flex-1 outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5">
            {STATUS_TABS.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  statusFilter === s
                    ? 'bg-brand-600/20 text-brand-600 dark:text-brand-300 border border-brand-600/30'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner className="w-6 h-6" />
          </div>
        ) : customers.length === 0 ? (
          <EmptyState
            icon={Users}
            title={search || statusFilter !== 'all' ? 'No customers match' : 'No customers yet'}
            description={
              search || statusFilter !== 'all'
                ? 'Try adjusting your search or filter.'
                : 'Add your first customer to start tracking sales.'
            }
            action={
              !search && statusFilter === 'all' && (
                <PermissionGate action="create" moduleId="sales">
                  <Button size="sm" onClick={openNew}>
                    <Plus className="w-4 h-4" />Add Customer
                  </Button>
                </PermissionGate>
              )
            }
          />
        ) : (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {customers.map(customer => (
              <CustomerCard
                key={customer.id}
                customer={customer}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          total={total}
          pageSize={PAGE_SIZE}
          label="customers"
          className="border-t border-surface-200 dark:border-surface-800"
        />
      </Card>

      <CustomerModal
        open={showModal}
        onClose={closeModal}
        onSaved={() => { fetchCustomers(); closeModal() }}
        customer={editCustomer}
      />
    </div>
  )
}
