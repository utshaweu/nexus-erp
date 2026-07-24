import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, Modal, Input, Select } from '@shared/components/ui'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import { ACCOUNT_TYPES } from '@shared/lib/constants'
import { saveAccount } from '../api/chartOfAccounts'

const coaSchema = z.object({
  code:         z.string().trim().min(1, 'Account code is required'),
  name:         z.string().trim().min(1, 'Account name is required'),
  account_type: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']),
  parent_id:    z.string().optional(),
  is_active:    z.string(),
})

const DEFAULT_VALUES = {
  code: '', name: '', account_type: 'asset', parent_id: '', is_active: 'true',
}

export default function COAModal({ open, onClose, onSaved, account, allAccounts }) {
  const { tenantId } = useTenant()
  const isEdit = Boolean(account)

  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(coaSchema), defaultValues: DEFAULT_VALUES })

  useEffect(() => {
    if (!open) return
    reset(account ? {
      code:         account.code         || '',
      name:         account.name         || '',
      account_type: account.account_type || 'asset',
      parent_id:    account.parent_id    || '',
      is_active:    account.is_active !== false ? 'true' : 'false',
    } : DEFAULT_VALUES)
  }, [open, account, reset])

  const onSubmit = async (data) => {
    try {
      await saveAccount(tenantId, account, data)
      toast.success(isEdit ? 'Account updated.' : 'Account created.')
      onSaved(); onClose()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleClose = () => { reset(); onClose() }

  const parentOptions = allAccounts.filter(a => !account || a.id !== account.id)

  return (
    <Modal open={open} onClose={handleClose} title={isEdit ? 'Edit Account' : 'New Account'} size="md">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-4">

          <div className="grid grid-cols-2 gap-4">
            <Input label="Account Code" placeholder="e.g. 1010" error={errors.code?.message} {...register('code')} />
            <Select label="Type" error={errors.account_type?.message} {...register('account_type')}>
              {Object.entries(ACCOUNT_TYPES).map(([v, { label }]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </Select>
          </div>

          <Input label="Account Name" placeholder="e.g. Cash and Cash Equivalents" error={errors.name?.message} {...register('name')} />

          <Select label="Parent Account (optional)" {...register('parent_id')}>
            <option value="">No parent</option>
            {parentOptions.map(a => (
              <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
            ))}
          </Select>

          <Select label="Status" {...register('is_active')}>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </Select>

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>Cancel</Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>
              {isEdit ? 'Save Changes' : 'Create Account'}
            </Button>
          </div>

        </div>
      </form>
    </Modal>
  )
}
