import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, Modal, Input, Select } from '@shared/components/ui'
import toast from '@shared/lib/toast'
import { fetchProductNameOptions } from '../api/products'
import { saveRFQLine } from '../api/rfqs'

const lineSchema = z.object({
  product_name: z.string().trim().min(1, 'Product is required'),
  quantity:     z.coerce.number({ invalid_type_error: 'Enter a number' }).positive('Must be > 0'),
})

export default function RFQLineModal({ open, onClose, line, lines = [], rfqId, tenantId, onSaved }) {
  const isEdit = Boolean(line)
  const {
    register, handleSubmit, reset, setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(lineSchema),
    defaultValues: { product_name: '', quantity: 1 },
  })

  const [allProducts, setAllProducts] = useState([])
  const [selectedId,  setSelectedId]  = useState('')

  useEffect(() => {
    if (!open) return
    let active = true
    fetchProductNameOptions(tenantId).then(list => {
      if (!active) return
      setAllProducts(list)
      reset(line
        ? { product_name: line.product_name, quantity: Number(line.quantity) }
        : { product_name: '', quantity: 1 })
      const match = line ? list.find(p => p.name === line.product_name) : null
      setSelectedId(match ? match.id : '')
    })
    return () => { active = false }
  }, [open, line, reset, tenantId])

  const handleProductChange = (e) => {
    const val = e.target.value
    setSelectedId(val)
    const p = allProducts.find(prod => prod.id === val)
    setValue('product_name', p ? p.name : '')
  }

  const onSubmit = async (data) => {
    // Block duplicate products on the same RFQ (ignore the row being edited)
    const dupe = (lines || []).some(l =>
      l.id !== line?.id &&
      (l.product_name || '').trim().toLowerCase() === data.product_name.trim().toLowerCase()
    )
    if (dupe) { toast.error('This item is already on the RFQ.'); return }

    try {
      await saveRFQLine(tenantId, rfqId, line, data)
      toast.success(isEdit ? 'Line updated.' : 'Line added.')
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleClose = () => { reset(); setSelectedId(''); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title={isEdit ? 'Edit Line Item' : 'Add Line Item'} size="md">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-4">
          <div>
            <Select
              label="Product"
              value={selectedId}
              onChange={handleProductChange}
            >
              <option value="">Select a product…</option>
              {allProducts.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
            {errors.product_name && (
              <p className="text-red-500 dark:text-red-400 text-xs mt-1">{errors.product_name.message}</p>
            )}
          </div>

          <Input
            label="Quantity"
            type="number"
            step="0.01"
            min="0.01"
            error={errors.quantity?.message}
            {...register('quantity')}
          />

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>
              {isEdit ? 'Save Changes' : 'Add Line'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
