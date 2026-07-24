import { useState, useEffect, useCallback } from 'react'
import { Tag, Plus, Search, Gift, CalendarDays, CheckCircle2 } from 'lucide-react'
import { Button, Card, Spinner, PageHeader, StatCard, EmptyState } from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import Pagination from '@shared/components/Pagination'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import { PAGE_SIZE_TABLE as PAGE_SIZE, OFFER_TYPES, OFFER_STATUS_TABS } from '@shared/lib/constants'
import { fetchOffers, fetchOfferStats, deleteOffer, toggleOfferActive } from '../api/offers'
import OfferModal from '../components/OfferModal'
import OffersTable from '../components/OffersTable'

export default function OffersDiscounts() {
  const { tenantId } = useTenant()
  const [offers,       setOffers]       = useState([])
  const [total,        setTotal]        = useState(0)
  const [page,         setPage]         = useState(1)
  const [search,       setSearch]       = useState('')
  const [typeFilter,   setTypeFilter]   = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading,      setLoading]      = useState(true)
  const [showModal,    setShowModal]    = useState(false)
  const [editOffer,    setEditOffer]    = useState(null)
  const [stats,        setStats]        = useState({ active: 0, withCoupon: 0, expiringSoon: 0, totalRedeemed: 0 })

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const loadOffers = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const { items, total } = await fetchOffers(tenantId, { page, search, typeFilter, statusFilter })
      setOffers(items)
      setTotal(total)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [tenantId, page, search, typeFilter, statusFilter])

  const loadStats = useCallback(async () => {
    if (!tenantId) return
    setStats(await fetchOfferStats(tenantId))
  }, [tenantId])

  useEffect(() => { loadOffers() }, [loadOffers])
  useEffect(() => { loadStats()  }, [loadStats])
  useEffect(() => { setPage(1) },  [search, typeFilter, statusFilter])

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete offer "${name}"? This cannot be undone.`)) return
    try {
      await deleteOffer(id)
      toast.success('Offer deleted.')
      loadOffers()
      loadStats()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleToggle = async (offer) => {
    try {
      await toggleOfferActive(offer)
      toast.success(offer.is_active ? 'Offer deactivated.' : 'Offer activated.')
      loadOffers()
      loadStats()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const openCreate = () => { setEditOffer(null); setShowModal(true) }
  const openEdit   = (o) => { setEditOffer(o);   setShowModal(true) }
  const closeModal = () => { setShowModal(false); setEditOffer(null) }
  const afterSave  = () => { loadOffers(); loadStats() }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Offers & Discounts"
        subtitle="Manage promotions, coupons, and discount rules"
        breadcrumb="Sales / Offers"
        actions={
          <PermissionGate action="create" moduleId="sales">
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4" />New Offer
            </Button>
          </PermissionGate>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Offers"  value={stats.active}        icon={Tag}          color="#10b981" />
        <StatCard label="Coupon Codes"   value={stats.withCoupon}    icon={Gift}         color="#3b82f6" />
        <StatCard label="Expiring Soon"  value={stats.expiringSoon}  icon={CalendarDays} color="#f59e0b" />
        <StatCard label="Total Redeemed" value={stats.totalRedeemed} icon={CheckCircle2} color="#a855f7" />
      </div>

      <Card>
        {/* Toolbar */}
        <div className="p-4 border-b border-surface-200 dark:border-surface-800 space-y-3">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 max-w-xs px-3 py-1.5 rounded-lg
                            bg-surface-100 dark:bg-surface-800
                            border border-surface-200 dark:border-surface-700">
              <Search className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or coupon code…"
                className="bg-transparent text-sm text-slate-700 dark:text-slate-300
                           placeholder:text-slate-400 dark:placeholder:text-slate-600
                           flex-1 outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5">
              {['all', 'percentage', 'fixed_amount', 'buy_x_get_y'].map(t => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    typeFilter === t
                      ? 'bg-brand-600/10 dark:bg-brand-600/20 text-brand-700 dark:text-brand-300 border border-brand-600/20 dark:border-brand-600/30'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  {t === 'all' ? 'All Types' : OFFER_TYPES[t]?.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 ml-auto">
              {OFFER_STATUS_TABS.map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    statusFilter === s
                      ? 'bg-brand-600/10 dark:bg-brand-600/20 text-brand-700 dark:text-brand-300 border border-brand-600/20 dark:border-brand-600/30'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner className="w-6 h-6" />
          </div>
        ) : offers.length === 0 ? (
          <EmptyState
            icon={Tag}
            title="No offers found"
            description="Create your first promotion or discount rule to attract more customers."
            action={
              <PermissionGate action="create" moduleId="sales">
                <Button size="sm" onClick={openCreate}>
                  <Plus className="w-4 h-4" />New Offer
                </Button>
              </PermissionGate>
            }
          />
        ) : (
          <>
            <OffersTable offers={offers} onEdit={openEdit} onToggle={handleToggle} onDelete={handleDelete} />

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

      <OfferModal
        open={showModal}
        onClose={closeModal}
        offer={editOffer}
        onSaved={afterSave}
      />
    </div>
  )
}
