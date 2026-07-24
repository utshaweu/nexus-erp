import { useState, useEffect, useCallback } from 'react'
import toast from '@shared/lib/toast'

/**
 * Paginated list + search + single-filter + CRUD-modal state, shared by
 * AssetList/Categories/Maintenance (and the paginate/filter half by
 * Depreciation, which has no create/edit modal of its own).
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

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const { items, total } = await fetchFn({ page, search, filter })
      setItems(items)
      setTotal(total)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, filter, ...extraDeps])

  useEffect(() => { refetch() }, [refetch])
  useEffect(() => { setPage(1) }, [search, filter])

  const openNew    = ()     => { setEditItem(null); setShowModal(true) }
  const openEdit   = (item) => { setEditItem(item); setShowModal(true) }
  const closeModal = ()     => { setShowModal(false); setEditItem(null) }

  return {
    items, total, page, setPage, search, setSearch, filter, setFilter, loading,
    refetch, showModal, editItem, openNew, openEdit, closeModal,
  }
}
