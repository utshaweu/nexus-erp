import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, Modal, Input, Select } from '@shared/components/ui'
import toast from '@shared/lib/toast'
import {
  EMPLOYEE_STATUS, EMPLOYMENT_TYPES, GENDER_OPTIONS, COUNTRIES,
} from '@shared/lib/constants'
import { saveEmployee } from '../api/employees'

const employeeSchema = z.object({
  first_name:          z.string().trim().min(1, 'First name is required'),
  last_name:           z.string().trim().min(1, 'Last name is required'),
  email:               z.string().email('Enter a valid email').or(z.literal('')).optional(),
  phone:               z.string().optional(),
  gender:              z.string().optional(),
  date_of_birth:       z.string().optional(),
  address:             z.string().optional(),
  nationality:         z.string().optional(),
  join_date:           z.string().min(1, 'Join date is required'),
  employment_type:     z.enum(['full_time', 'part_time', 'contract', 'intern']),
  status:              z.enum(['active', 'inactive', 'on_leave', 'terminated']),
  department_id:       z.string().optional(),
  position_id:         z.string().optional(),
  manager_id:          z.string().optional(),
  user_id:             z.string().optional(),
  basic_salary:        z.coerce.number({ invalid_type_error: 'Enter a valid amount' }).min(0, 'Must be 0 or more'),
  bank_account_name:   z.string().optional(),
  bank_account_number: z.string().optional(),
  bank_name:           z.string().optional(),
  notes:               z.string().optional(),
})

const DEFAULT_VALUES = {
  first_name: '', last_name: '', email: '', phone: '',
  gender: '', date_of_birth: '', address: '', nationality: '',
  join_date: new Date().toISOString().slice(0, 10),
  employment_type: 'full_time', status: 'active',
  department_id: '', position_id: '', manager_id: '', user_id: '',
  basic_salary: 0,
  bank_account_name: '', bank_account_number: '', bank_name: '',
  notes: '',
}

export default function EmployeeModal({ open, onClose, onSaved, tenantId, employee, departments, positions, allEmployees, tenantUsers }) {
  const isEdit = Boolean(employee)

  const {
    register, handleSubmit, reset, watch,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(employeeSchema), defaultValues: DEFAULT_VALUES })

  const watchedDeptId = watch('department_id')
  const filteredPositions = positions.filter(p =>
    !watchedDeptId || p.department_id === watchedDeptId
  )

  useEffect(() => {
    if (!open) return
    reset(employee
      ? {
          first_name:          employee.first_name,
          last_name:           employee.last_name,
          email:               employee.email               || '',
          phone:               employee.phone               || '',
          gender:              employee.gender              || '',
          date_of_birth:       employee.date_of_birth       || '',
          address:             employee.address             || '',
          nationality:         employee.nationality         || '',
          join_date:           employee.join_date,
          employment_type:     employee.employment_type,
          status:              employee.status,
          department_id:       employee.department_id       || '',
          position_id:         employee.position_id         || '',
          manager_id:          employee.manager_id          || '',
          user_id:             employee.user_id             || '',
          basic_salary:        employee.basic_salary,
          bank_account_name:   employee.bank_account_name   || '',
          bank_account_number: employee.bank_account_number || '',
          bank_name:           employee.bank_name           || '',
          notes:               employee.notes               || '',
        }
      : DEFAULT_VALUES
    )
  }, [open, employee, reset])

  const onSubmit = async (data) => {
    try {
      await saveEmployee(tenantId, employee, data)
      toast.success(isEdit ? 'Employee updated.' : 'Employee created.')
      onSaved(); onClose()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleClose = () => { reset(); onClose() }

  const otherEmployees = allEmployees.filter(e => !isEdit || e.id !== employee?.id)

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isEdit ? `Edit ${employee?.employee_number}` : 'New Employee'}
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-5 max-h-[65vh] overflow-y-auto pr-1">

          {/* Personal */}
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              Personal Information
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="First Name"
                  placeholder="John"
                  error={errors.first_name?.message}
                  {...register('first_name')}
                />
                <Input
                  label="Last Name"
                  placeholder="Doe"
                  error={errors.last_name?.message}
                  {...register('last_name')}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Email (optional)"
                  type="email"
                  placeholder="john@example.com"
                  error={errors.email?.message}
                  {...register('email')}
                />
                <Input
                  label="Phone (optional)"
                  placeholder="+1 234 567 8900"
                  {...register('phone')}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Gender (optional)" {...register('gender')}>
                  <option value="">— Select —</option>
                  {Object.entries(GENDER_OPTIONS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </Select>
                <Input
                  label="Date of Birth (optional)"
                  type="date"
                  {...register('date_of_birth')}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Nationality (optional)" {...register('nationality')}>
                  <option value="">— Select —</option>
                  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
                <Input
                  label="Address (optional)"
                  placeholder="123 Main St, City"
                  {...register('address')}
                />
              </div>
            </div>
          </div>

          {/* Employment */}
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              Employment Details
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Join Date"
                  type="date"
                  error={errors.join_date?.message}
                  {...register('join_date')}
                />
                <Select label="Employment Type" {...register('employment_type')}>
                  {Object.entries(EMPLOYMENT_TYPES).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Department (optional)" {...register('department_id')}>
                  <option value="">— None —</option>
                  {departments.filter(d => d.is_active).map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </Select>
                <Select label="Position (optional)" {...register('position_id')}>
                  <option value="">— None —</option>
                  {filteredPositions.filter(p => p.is_active).map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Manager (optional)" {...register('manager_id')}>
                  <option value="">— None —</option>
                  {otherEmployees.map(e => (
                    <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
                  ))}
                </Select>
                <Select label="Status" {...register('status')}>
                  {Object.entries(EMPLOYEE_STATUS).map(([v, { label }]) => (
                    <option key={v} value={v}>{label}</option>
                  ))}
                </Select>
              </div>
              <Select
                label="Link User Account (optional)"
                {...register('user_id')}
              >
                <option value="">— Not linked —</option>
                {tenantUsers.map(u => (
                  <option key={u.user_id} value={u.user_id}>
                    {u.full_name || u.user_id} ({u.role})
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Compensation */}
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              Compensation & Banking
            </p>
            <div className="space-y-3">
              <Input
                label="Basic Salary"
                type="number" min="0" step="0.01"
                placeholder="0.00"
                error={errors.basic_salary?.message}
                {...register('basic_salary')}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Bank Name (optional)" placeholder="e.g. HSBC" {...register('bank_name')} />
                <Input label="Account Name (optional)" placeholder="Account holder name" {...register('bank_account_name')} />
              </div>
              <Input label="Account Number (optional)" placeholder="Account number" {...register('bank_account_number')} />
            </div>
          </div>

          <Input label="Notes (optional)" placeholder="Any additional notes" {...register('notes')} />

        </div>

        <div className="flex gap-3 pt-4 mt-2 border-t border-surface-200 dark:border-surface-800">
          <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" loading={isSubmitting}>
            {isEdit ? 'Save Changes' : 'Add Employee'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
