import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, Modal, Input, Select } from '@shared/components/ui'
import toast from '@shared/lib/toast'
import { useTenant } from '@core/tenant/TenantContext'
import useStore from '@core/store/useStore'
import { saveAttendanceEntry } from '../api/attendance'

export const ATTENDANCE_STATUS = {
  present:  { label: 'Present',   color: 'green'   },
  absent:   { label: 'Absent',    color: 'red'     },
  late:     { label: 'Late',      color: 'yellow'  },
  half_day: { label: 'Half Day',  color: 'orange'  },
  holiday:  { label: 'Holiday',   color: 'blue'    },
  on_leave: { label: 'On Leave',  color: 'purple'  },
}

const attendanceSchema = z.object({
  status:         z.enum(['present', 'absent', 'late', 'half_day', 'holiday', 'on_leave']),
  check_in_time:  z.string().optional(),
  check_out_time: z.string().optional(),
  notes:          z.string().optional(),
})

export default function AttendanceModal({ open, onClose, onSaved, record, employee, date }) {
  const { tenantId } = useTenant()
  const session      = useStore(s => s.session)
  const isEdit       = Boolean(record)

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } =
    useForm({
      resolver: zodResolver(attendanceSchema),
      defaultValues: { status: 'present', check_in_time: '', check_out_time: '', notes: '' },
    })

  const status = watch('status')
  const showTimes = ['present', 'late', 'half_day'].includes(status)

  useEffect(() => {
    if (!open) return
    reset(record
      ? {
          status:         record.status,
          check_in_time:  record.check_in_time  || '',
          check_out_time: record.check_out_time || '',
          notes:          record.notes           || '',
        }
      : { status: 'present', check_in_time: '', check_out_time: '', notes: '' }
    )
  }, [open, record, reset])

  const onSubmit = async (data) => {
    try {
      await saveAttendanceEntry(tenantId, record, employee, date, data, session?.user?.id)
      toast.success(isEdit ? 'Attendance updated.' : 'Attendance marked.')
      onSaved(); onClose()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const empName = employee ? `${employee.first_name} ${employee.last_name}` : ''

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit Attendance — ${empName}` : `Mark Attendance — ${empName}`}
      size="sm"
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div className="p-3 rounded-lg bg-slate-50 dark:bg-surface-800 text-sm">
          <span className="text-slate-500">Date: </span>
          <span className="font-semibold text-slate-900 dark:text-slate-100">{date}</span>
          {employee && (
            <>
              <span className="text-slate-400 mx-2">·</span>
              <span className="font-mono text-xs text-pink-500">{employee.employee_number}</span>
            </>
          )}
        </div>

        <Select label="Status" error={errors.status?.message} {...register('status')}>
          {Object.entries(ATTENDANCE_STATUS).map(([v, { label }]) => (
            <option key={v} value={v}>{label}</option>
          ))}
        </Select>

        {showTimes && (
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Check-In Time"
              type="time"
              {...register('check_in_time')}
            />
            <Input
              label="Check-Out Time"
              type="time"
              {...register('check_out_time')}
            />
          </div>
        )}

        <Input
          label="Notes (optional)"
          placeholder="Any remarks"
          {...register('notes')}
        />

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={isSubmitting}>
            {isEdit ? 'Update' : 'Mark Attendance'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
