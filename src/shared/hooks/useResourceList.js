import { useState, useEffect, useCallback, useRef } from 'react'
import toast from '@shared/lib/toast'

/**
 * Paginated list + search + single-filter + CRUD-modal state, shared across
 * every module's list pages (Invoices/Bills/Journals/ChartOfAccounts,
 * Customers/Quotations/SalesOrders/OffersDiscounts, AssetList/Categories/...,
 * Employees/Departments/..., Products/StockMoves, PurchaseOrders/RFQ/Vendors).
 * `fetchFn({ page, search, filter })` must resolve `{ items, total }`.
 */
export function useResourceList(fetchFn, extraDeps = []) {
  const [items, setItems]         = useState([])
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(1)
  const [search, setSearch]       = useState('')
  const [filter, setFilter]       = useState('all')
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem]   = useState(null)

  const requestId = useRef(0)

  const refetch = useCallback(async () => {
    const thisRequest = ++requestId.current
    setLoading(true)
    try {
      const { items, total } = await fetchFn({ page, search, filter })
      if (thisRequest !== requestId.current) return // stale response or unmounted
      setItems(items)
      setTotal(total)
    } catch (err) {
      if (thisRequest !== requestId.current) return
      toast.error(err.message)
    } finally {
      if (thisRequest === requestId.current) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, filter, ...extraDeps])

  useEffect(() => {
    refetch()
    return () => { requestId.current++ }
  }, [refetch])
  useEffect(() => { setPage(1) }, [search, filter])

  const openNew    = ()     => { setEditItem(null); setShowModal(true) }
  const openEdit   = (item) => { setEditItem(item); setShowModal(true) }
  const closeModal = ()     => { setShowModal(false); setEditItem(null) }

  return {
    items, total, page, setPage, search, setSearch, filter, setFilter, loading,
    refetch, showModal, editItem, openNew, openEdit, closeModal,
  }
}
