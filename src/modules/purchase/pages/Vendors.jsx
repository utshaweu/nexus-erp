import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search, Star, Phone, Mail, MapPin, Trash2, Pencil, Building2 } from 'lucide-react'
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
  VENDOR_CATEGORIES as CATEGORIES,
  VENDOR_STATUS_TABS as STATUS_TABS,
  VENDOR_STATUS_LABEL as STATUS_LABEL,
} from '@shared/lib/constants'

const vendorSchema = z.object({
  name:         z.string().trim().min(1, 'Company name is required'),
  contact_name: z.string().trim().optional(),
  email:        z.string().email('Enter a valid email').or(z.literal('')).optional(),
  phone:        z.string().trim().optional(),
  country:      z.string().trim().optional(),
  address:      z.string().trim().optional(),
  category:     z.string().min(1, 'Category is required'),
  status:       z.enum(['active', 'inactive', 'blacklisted']),
})

// ── Stars ───────────────────────────────────────────────────────────────────

function Stars({ rating }) {
  const r = Math.round(Number(rating) || 0)
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className="w-3 h-3"
          fill={i <= r ? '#f59e0b' : 'none'}
          stroke={i <= r ? '#f59e0b' : '#94a3b8'}
        />
      ))}
      <span className="ml-1 text-xs text-slate-400 dark:text-slate-500">
        {Number(rating) || 0}
      </span>
    </div>
  )
}

// ── VendorCard ───────────────────────────────────────────────────────────────

function VendorCard({ vendor, onEdit, onDelete }) {
  const statusColor =
    vendor.status === 'active'      ? 'green'   :
    vendor.status === 'blacklisted' ? 'red'      : 'default'

  return (
    <Card className="p-5 hover:border-slate-300 dark:hover:border-surface-700 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 mr-2">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
            {vendor.name}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">{vendor.category}</p>
        </div>
        <Badge color={statusColor}>{vendor.status}</Badge>
      </div>

      {/* Rating */}
      <Stars rating={vendor.rating} />

      {/* Contact info */}
      <div className="mt-3 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
        {vendor.email && (
          <div className="flex items-center gap-1.5">
            <Mail className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{vendor.email}</span>
          </div>
        )}
        {vendor.phone && (
          <div className="flex items-center gap-1.5">
            <Phone className="w-3 h-3 flex-shrink-0" />
            <span>{vendor.phone}</span>
          </div>
        )}
        {vendor.country && (
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span>{vendor.country}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-surface-200 dark:border-surface-800 flex items-center justify-between">
        {vendor.contact_name
          ? <span className="text-xs text-slate-500 truncate mr-2">{vendor.contact_name}</span>
          : <span />
        }
        <div className="flex gap-1 flex-shrink-0">
          <PermissionGate action="edit" moduleId="purchase">
            <Button variant="ghost" size="xs" onClick={() => onEdit(vendor)}>
              <Pencil className="w-3 h-3" />
            </Button>
          </PermissionGate>
          <PermissionGate action="delete" moduleId="purchase">
            <Button variant="danger" size="xs" onClick={() => onDelete(vendor)}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </PermissionGate>
        </div>
      </div>
    </Card>
  )
}

// ── VendorModal ──────────────────────────────────────────────────────────────

function VendorModal({ open, onClose, onSaved, vendor }) {
  const { tenantId } = useTenant()
  const isEdit = Boolean(vendor)

  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(vendorSchema),
    defaultValues: {
      name: '', contact_name: '', email: '', phone: '',
      country: '', address: '', category: '', status: 'active',
    },
  })

  useEffect(() => {
    if (open) {
      reset(
        vendor
          ? {
              name:         vendor.name         || '',
              contact_name: vendor.contact_name || '',
              email:        vendor.email        || '',
              phone:        vendor.phone        || '',
              country:      vendor.country      || '',
              address:      vendor.address      || '',
              category:     vendor.category     || '',
              status:       vendor.status       || 'active',
            }
          : { name: '', contact_name: '', email: '', phone: '', country: '', address: '', category: '', status: 'active' },
      )
    }
  }, [open, vendor, reset])

  const onSubmit = async (data) => {
    const payload = {
      name:         data.name,
      contact_name: data.contact_name || null,
      email:        data.email        || null,
      phone:        data.phone        || null,
      country:      data.country      || null,
      address:      data.address      || null,
      category:     data.category,
      status:       data.status,
    }

    if (isEdit) {
      const { error } = await supabase
        .from('vendors')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', vendor.id)
      if (error) { toast.error(error.message); return }
      toast.success('Vendor updated.')
    } else {
      const { error } = await supabase.from('vendors').insert({ ...payload, tenant_id: tenantId })
      if (error) { toast.error(error.message); return }
      toast.success('Vendor added.')
    }

    onSaved()
    onClose()
  }

  const handleClose = () => { reset(); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title={isEdit ? 'Edit Vendor' : 'New Vendor'} size="md">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input
                label="Company Name"
                placeholder="Vendor company name"
                error={errors.name?.message}
                {...register('name')}
              />
            </div>
            <Input
              label="Contact Person"
              placeholder="Full name"
              error={errors.contact_name?.message}
              {...register('contact_name')}
            />
            <Input
              label="Email"
              type="email"
              placeholder="vendor@company.com"
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
            <div>
              <Select label="Category" error={errors.category?.message} {...register('category')}>
                <option value="">Select category…</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
            <div>
              <Select label="Status" {...register('status')}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="blacklisted">Blacklisted</option>
              </Select>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>
              {isEdit ? 'Save Changes' : 'Add Vendor'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Vendors() {
  const { tenantId } = useTenant()
  const [vendors,      setVendors]      = useState([])
  const [total,        setTotal]        = useState(0)
  const [page,         setPage]         = useState(1)
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading,      setLoading]      = useState(true)
  const [showModal,    setShowModal]    = useState(false)
  const [editVendor,   setEditVendor]   = useState(null)

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const fetchVendors = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      let query = supabase
        .from('vendors')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('name')
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      if (search.trim()) {
        query = query.or(
          `name.ilike.%${search.trim()}%,contact_name.ilike.%${search.trim()}%,category.ilike.%${search.trim()}%`,
        )
      }

      const { data, count, error } = await query
      if (error) throw error
      setVendors(data || [])
      setTotal(count || 0)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [tenantId, page, search, statusFilter])

  useEffect(() => { fetchVendors() }, [fetchVendors])
  useEffect(() => { setPage(1) },     [search, statusFilter])

  const openNew    = ()       => { setEditVendor(null);   setShowModal(true)  }
  const openEdit   = (v)      => { setEditVendor(v);      setShowModal(true)  }
  const closeModal = ()       => { setShowModal(false);   setEditVendor(null) }

  const handleDelete = async (vendor) => {
    if (!window.confirm(`Delete vendor "${vendor.name}"? This cannot be undone.`)) return
    const { error } = await supabase.from('vendors').delete().eq('id', vendor.id)
    if (error) { toast.error(error.message); return }
    toast.success('Vendor deleted.')
    fetchVendors()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendors"
        subtitle={`${total} vendor${total !== 1 ? 's' : ''}`}
        breadcrumb="Purchase / Vendors"
        actions={
          <PermissionGate action="create" moduleId="purchase">
            <Button size="sm" onClick={openNew}>
              <Plus className="w-4 h-4" />New Vendor
            </Button>
          </PermissionGate>
        }
      />

      <Card>
        {/* Toolbar */}
        <div className="flex items-center gap-3 p-4 border-b border-surface-200 dark:border-surface-800 flex-wrap">
          {/* Search */}
          <div className="flex items-center gap-2 w-64 px-3 py-1.5 rounded-lg
                          bg-slate-50 dark:bg-surface-800
                          border border-surface-200 dark:border-surface-700">
            <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search vendors…"
              className="bg-transparent text-sm text-slate-700 dark:text-slate-300
                         placeholder:text-slate-400 dark:placeholder:text-slate-600
                         flex-1 outline-none"
            />
          </div>

          {/* Status tabs */}
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
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner className="w-6 h-6" />
          </div>
        ) : vendors.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={search || statusFilter !== 'all' ? 'No vendors match' : 'No vendors yet'}
            description={
              search || statusFilter !== 'all'
                ? 'Try adjusting your search or filter.'
                : 'Add your first vendor to start managing procurement.'
            }
            action={
              !search && statusFilter === 'all' && (
                <PermissionGate action="create" moduleId="purchase">
                  <Button size="sm" onClick={openNew}>
                    <Plus className="w-4 h-4" />Add Vendor
                  </Button>
                </PermissionGate>
              )
            }
          />
        ) : (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {vendors.map(vendor => (
              <VendorCard
                key={vendor.id}
                vendor={vendor}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          total={total}
          pageSize={PAGE_SIZE}
          label="vendors"
          className="border-t border-surface-200 dark:border-surface-800"
        />
      </Card>

      <VendorModal
        open={showModal}
        onClose={closeModal}
        onSaved={() => { fetchVendors(); closeModal() }}
        vendor={editVendor}
      />
    </div>
  )
}
