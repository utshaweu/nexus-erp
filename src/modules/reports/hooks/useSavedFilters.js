import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from '@shared/lib/toast'
import { saveFilterSchema } from '../api/reportHelpers'
import { fetchSavedFilters, saveFilter, deleteSavedFilter } from '../api/savedFilters'

export function useSavedFilters(tenantId, reportPage, mainForm, runReport) {
  const [savedFilters, setSavedFilters] = useState([])
  const [showSave, setShowSave] = useState(false)
  const saveForm = useForm({ resolver: zodResolver(saveFilterSchema), defaultValues: { name: '' } })

  const refetch = useCallback(async () => {
    if (!tenantId) return
    setSavedFilters(await fetchSavedFilters(tenantId, reportPage))
  }, [tenantId, reportPage])

  useEffect(() => { refetch() }, [refetch])

  const handleSaveFilter = async (data) => {
    try {
      await saveFilter(tenantId, reportPage, data.name, mainForm.getValues())
      toast.success('Filter saved.')
      saveForm.reset()
      setShowSave(false)
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const applyFilter = (sf) => {
    mainForm.reset(sf.filters)
    mainForm.handleSubmit(runReport)()
  }

  const deleteFilter = async (id) => {
    try {
      await deleteSavedFilter(id)
      toast.success('Filter deleted.')
      refetch()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const closeSave = () => { setShowSave(false); saveForm.reset() }

  return { savedFilters, saveForm, showSave, setShowSave, closeSave, handleSaveFilter, applyFilter, deleteFilter }
}
