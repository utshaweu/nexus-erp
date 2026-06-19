import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { Plus, Search, Pencil, Trash2, Eye, Users, Link as LinkIcon } from 'lucide-react'
import {
  Button, Badge, Table, Thead, Th, Tbody, Tr, Td, PageHeader, Card,
  Modal, Input, Select, EmptyState,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import Pagination from '@shared/components/Pagination'
import toast from '@shared/lib/toast'
import { supabase } from '@shared/api/supabase'
import { useTenant } from '@core/tenant/TenantContext'
import {
  PAGE_SIZE_TABLE as PAGE_SIZE,
  EMPLOYEE_STATUS,
  EMPLOYEE_STATUS_TABS,
  EMPLOYMENT_TYPES,
  GENDER_OPTIONS,
  COUNTRIES,
} from '@shared/lib/constants'

// ── Validation ────────────────────────────────────────────────────────────────

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

// ── Employee Modal ────────────────────────────────────────────────────────────

function EmployeeModal({ open, onClose, onSaved, employee, departments, positions, allEmployees, tenantUsers }) {
  const { tenantId } = useTenant()
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
    const payload = {
      first_name:          data.first_name,
      last_name:           data.last_name,
      email:               data.email               || null,
      phone:               data.phone               || null,
      gender:              data.gender              || null,
      date_of_birth:       data.date_of_birth       || null,
      address:             data.address             || null,
      nationality:         data.nationality         || null,
      join_date:           data.join_date,
      employment_type:     data.employment_type,
      status:              data.status,
      department_id:       data.department_id       || null,
      position_id:         data.position_id         || null,
      manager_id:          data.manager_id          || null,
      user_id:             data.user_id             || null,
      basic_salary:        parseFloat(data.basic_salary) || 0,
      bank_account_name:   data.bank_account_name   || null,
      bank_account_number: data.bank_account_number || null,
      bank_name:           data.bank_name           || null,
      notes:               data.notes               || null,
      updated_at:          new Date().toISOString(),
    }

    if (isEdit) {
      const { error } = await supabase.from('hr_employees').update(payload).eq('id', employee.id)
      if (error) { toast.error(error.message); return }
      toast.success('Employee updated.')
    } else {
      const { data: num, error: numErr } = await supabase.rpc('generate_employee_number')
      if (numErr) { toast.error(numErr.message); return }
      const { error } = await supabase
        .from('hr_employees')
        .insert({ ...payload, tenant_id: tenantId, employee_number: num })
      if (error) { toast.error(error.message); return }
      toast.success('Employee created.')
    }
    onSaved(); onClose()
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Employees() {
  const { tenantId }   = useTenant()
  const [employees,    setEmployees]   = useState([])
  const [allEmployees, setAllEmployees]= useState([])
  const [departments,  setDepartments] = useState([])
  const [positions,    setPositions]   = useState([])
  const [tenantUsers,  setTenantUsers] = useState([])
  const [total,        setTotal]       = useState(0)
  const [page,         setPage]        = useState(1)
  const [search,       setSearch]      = useState('')
  const [statusFilter, setStatusFilter]= useState('all')
  const [loading,      setLoading]     = useState(true)
  const [showModal,    setShowModal]   = useState(false)
  const [editEmployee, setEditEmployee]= useState(null)

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const fetchEmployees = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      let query = supabase
        .from('hr_employees')
        .select(
          '*, hr_departments(name), hr_positions(title)',
          { count: 'exact' }
        )
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

      if (statusFilter !== 'all') query = query.eq('status', statusFilter)
      if (search.trim()) {
        query = query.or(
          `first_name.ilike.%${search.trim()}%,last_name.ilike.%${search.trim()}%,employee_number.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%`
        )
      }

      const { data, count, error } = await query
      if (error) throw error
      setEmployees(data || [])
      setTotal(count || 0)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [tenantId, page, search, statusFilter])

  const fetchDepartments = useCallback(async () => {
    if (!tenantId) return
    const { data } = await supabase
      .from('hr_departments')
      .select('id, name, is_active')
      .eq('tenant_id', tenantId)
      .order('name')
    setDepartments(data || [])
  }, [tenantId])

  const fetchPositions = useCallback(async () => {
    if (!tenantId) return
    const { data } = await supabase
      .from('hr_positions')
      .select('id, title, department_id, is_active')
      .eq('tenant_id', tenantId)
      .order('title')
    setPositions(data || [])
  }, [tenantId])

  const fetchAllEmployees = useCallback(async () => {
    if (!tenantId) return
    const { data } = await supabase
      .from('hr_employees')
      .select('id, first_name, last_name, employee_number')
      .eq('tenant_id', tenantId)
      .in('status', ['active', 'on_leave'])
      .order('first_name')
    setAllEmployees(data || [])
  }, [tenantId])

  const fetchTenantUsers = useCallback(async () => {
    if (!tenantId) return
    const { data } = await supabase
      .from('tenant_users')
      .select('user_id, full_name, role')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('full_name')
    setTenantUsers(data || [])
  }, [tenantId])

  useEffect(() => { fetchEmployees()    }, [fetchEmployees])
  useEffect(() => { fetchAllEmployees() }, [fetchAllEmployees])
  useEffect(() => { fetchDepartments()  }, [fetchDepartments])
  useEffect(() => { fetchPositions()    }, [fetchPositions])
  useEffect(() => { fetchTenantUsers()  }, [fetchTenantUsers])
  useEffect(() => { setPage(1) }, [search, statusFilter])

  const openNew    = ()  => { setEditEmployee(null); setShowModal(true) }
  const openEdit   = (e) => { setEditEmployee(e);    setShowModal(true) }
  const closeModal = ()  => { setShowModal(false); setEditEmployee(null) }

  const handleDelete = async (emp) => {
    if (!window.confirm(`Delete employee ${emp.employee_number} — ${emp.first_name} ${emp.last_name}? This cannot be undone.`)) return
    const { error } = await supabase.from('hr_employees').delete().eq('id', emp.id)
    if (error) { toast.error(error.message); return }
    toast.success('Employee deleted.')
    fetchEmployees()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employees"
        subtitle="Manage your workforce"
        breadcrumb="HR / Employees"
        actions={
          <PermissionGate action="create" moduleId="hr">
            <Button size="sm" onClick={openNew}>
              <Plus className="w-4 h-4" />New Employee
            </Button>
          </PermissionGate>
        }
      />

      <Card>
        {/* Toolbar */}
        <div className="flex items-center gap-3 p-4 border-b border-surface-200 dark:border-surface-800 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-xs
                          px-3 py-2 rounded-lg
                          bg-slate-50 dark:bg-surface-800
                          border border-surface-200 dark:border-surface-700">
            <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, number, email…"
              className="bg-transparent text-sm text-slate-700 dark:text-slate-300
                         placeholder:text-slate-400 dark:placeholder:text-slate-600
                         flex-1 outline-none"
            />
          </div>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-surface-800">
            {EMPLOYEE_STATUS_TABS.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  statusFilter === s
                    ? 'bg-white dark:bg-surface-700 text-slate-800 dark:text-slate-100 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {s === 'all' ? 'All' : EMPLOYEE_STATUS[s]?.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-pink-400 animate-pulse" />
            </div>
            <p className="text-sm text-slate-400">Loading employees…</p>
          </div>
        ) : employees.length === 0 ? (
          <EmptyState
            icon={Users}
            title={search || statusFilter !== 'all' ? 'No employees match' : 'No employees yet'}
            description={
              search || statusFilter !== 'all'
                ? 'Try adjusting your search or filter.'
                : 'Add your first employee to get started.'
            }
            action={!search && statusFilter === 'all' && (
              <PermissionGate action="create" moduleId="hr">
                <Button size="sm" onClick={openNew}><Plus className="w-4 h-4" />New Employee</Button>
              </PermissionGate>
            )}
          />
        ) : (
          <Table>
            <Thead>
              <Th>Employee #</Th>
              <Th>Name</Th>
              <Th>Department</Th>
              <Th>Position</Th>
              <Th>Type</Th>
              <Th>Join Date</Th>
              <Th>Status</Th>
              <Th></Th>
            </Thead>
            <Tbody>
              {employees.map(emp => {
                const s = EMPLOYEE_STATUS[emp.status]
                return (
                  <Tr key={emp.id}>
                    <Td>
                      <span className="font-mono text-xs font-medium
                                       text-pink-600 dark:text-pink-400
                                       bg-pink-50 dark:bg-pink-500/10
                                       px-2 py-0.5 rounded-md">
                        {emp.employee_number}
                      </span>
                    </Td>
                    <Td>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-slate-900 dark:text-slate-100">
                            {emp.first_name} {emp.last_name}
                          </span>
                          {emp.user_id && (
                            <span title="Linked to a user account" className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-500/20">
                              <LinkIcon className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                            </span>
                          )}
                        </div>
                        {emp.email && (
                          <p className="text-xs text-slate-500 mt-0.5">{emp.email}</p>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <span className="text-slate-500 dark:text-slate-400 text-sm">
                        {emp.hr_departments?.name || '—'}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-slate-500 dark:text-slate-400 text-sm">
                        {emp.hr_positions?.title || '—'}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-slate-500 dark:text-slate-400 text-sm">
                        {EMPLOYMENT_TYPES[emp.employment_type] || emp.employment_type}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-sm text-slate-600 dark:text-slate-400">{emp.join_date}</span>
                    </Td>
                    <Td>
                      <Badge color={s?.color || 'default'}>{s?.label || emp.status}</Badge>
                    </Td>
                    <Td onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Link to={`/hr/employees/${emp.id}`}>
                          <Button variant="ghost" size="xs">
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                        <PermissionGate action="edit" moduleId="hr">
                          <Button variant="ghost" size="xs" onClick={() => openEdit(emp)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </PermissionGate>
                        <PermissionGate action="delete" moduleId="hr">
                          <Button variant="danger" size="xs" onClick={() => handleDelete(emp)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </PermissionGate>
                      </div>
                    </Td>
                  </Tr>
                )
              })}
            </Tbody>
          </Table>
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          total={total}
          pageSize={PAGE_SIZE}
          label="employees"
          className="border-t border-surface-200 dark:border-surface-800"
        />
      </Card>

      <EmployeeModal
        open={showModal}
        onClose={closeModal}
        onSaved={() => { fetchEmployees(); fetchAllEmployees() }}
        employee={editEmployee}
        departments={departments}
        positions={positions}
        allEmployees={allEmployees}
        tenantUsers={tenantUsers}
      />
    </div>
  )
}
