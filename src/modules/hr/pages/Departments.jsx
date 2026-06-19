import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search, Pencil, Trash2, Building, Award } from 'lucide-react'
import {
  Button, Badge, Table, Thead, Th, Tbody, Tr, Td, PageHeader, Card,
  Modal, Input, Select, EmptyState,
} from '@shared/components/ui'
import PermissionGate from '@shared/components/PermissionGate'
import Pagination from '@shared/components/Pagination'
import toast from '@shared/lib/toast'
import { supabase } from '@shared/api/supabase'
import { useTenant } from '@core/tenant/TenantContext'
import { PAGE_SIZE_TABLE as PAGE_SIZE } from '@shared/lib/constants'

// ── Validation Schemas ────────────────────────────────────────────────────────

const deptSchema = z.object({
  name:        z.string().trim().min(1, 'Name is required'),
  description: z.string().optional(),
})

const positionSchema = z.object({
  title:         z.string().trim().min(1, 'Title is required'),
  department_id: z.string().optional(),
  description:   z.string().optional(),
})

// ── Department Modal ──────────────────────────────────────────────────────────

function DeptModal({ open, onClose, onSaved, dept }) {
  const { tenantId } = useTenant()
  const isEdit = Boolean(dept)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm({ resolver: zodResolver(deptSchema), defaultValues: { name: '', description: '' } })

  useEffect(() => {
    if (!open) return
    reset(dept ? { name: dept.name, description: dept.description || '' } : { name: '', description: '' })
  }, [open, dept, reset])

  const onSubmit = async (data) => {
    if (isEdit) {
      const { error } = await supabase
        .from('hr_departments')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', dept.id)
      if (error) { toast.error(error.message); return }
      toast.success('Department updated.')
    } else {
      const { error } = await supabase
        .from('hr_departments')
        .insert({ ...data, tenant_id: tenantId })
      if (error) { toast.error(error.message); return }
      toast.success('Department created.')
    }
    onSaved(); onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Department' : 'New Department'} size="sm">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Input
          label="Department Name"
          placeholder="e.g. Engineering"
          error={errors.name?.message}
          {...register('name')}
        />
        <Input
          label="Description (optional)"
          placeholder="Brief description"
          {...register('description')}
        />
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={isSubmitting}>
            {isEdit ? 'Save Changes' : 'Create Department'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Position Modal ────────────────────────────────────────────────────────────

function PositionModal({ open, onClose, onSaved, position, departments }) {
  const { tenantId } = useTenant()
  const isEdit = Boolean(position)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm({
      resolver: zodResolver(positionSchema),
      defaultValues: { title: '', department_id: '', description: '' },
    })

  useEffect(() => {
    if (!open) return
    reset(position
      ? { title: position.title, department_id: position.department_id || '', description: position.description || '' }
      : { title: '', department_id: '', description: '' }
    )
  }, [open, position, reset])

  const onSubmit = async (data) => {
    const payload = {
      title:         data.title,
      department_id: data.department_id || null,
      description:   data.description   || null,
      updated_at:    new Date().toISOString(),
    }
    if (isEdit) {
      const { error } = await supabase.from('hr_positions').update(payload).eq('id', position.id)
      if (error) { toast.error(error.message); return }
      toast.success('Position updated.')
    } else {
      const { error } = await supabase
        .from('hr_positions')
        .insert({ ...payload, tenant_id: tenantId })
      if (error) { toast.error(error.message); return }
      toast.success('Position created.')
    }
    onSaved(); onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Position' : 'New Position'} size="sm">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Input
          label="Position Title"
          placeholder="e.g. Senior Developer"
          error={errors.title?.message}
          {...register('title')}
        />
        <Select label="Department (optional)" {...register('department_id')}>
          <option value="">— None —</option>
          {departments.filter(d => d.is_active).map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </Select>
        <Input
          label="Description (optional)"
          placeholder="Brief description of this role"
          {...register('description')}
        />
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={isSubmitting}>
            {isEdit ? 'Save Changes' : 'Create Position'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Departments Tab ───────────────────────────────────────────────────────────

function DepartmentsTab() {
  const { tenantId } = useTenant()
  const [depts,      setDepts]     = useState([])
  const [total,      setTotal]     = useState(0)
  const [page,       setPage]      = useState(1)
  const [search,     setSearch]    = useState('')
  const [loading,    setLoading]   = useState(true)
  const [showModal,  setShowModal] = useState(false)
  const [editDept,   setEditDept]  = useState(null)
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const fetchDepts = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      let query = supabase
        .from('hr_departments')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('name')
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
      if (search.trim()) query = query.ilike('name', `%${search.trim()}%`)
      const { data, count, error } = await query
      if (error) throw error
      setDepts(data || [])
      setTotal(count || 0)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [tenantId, page, search])

  useEffect(() => { fetchDepts() }, [fetchDepts])
  useEffect(() => { setPage(1) }, [search])

  const openNew    = ()  => { setEditDept(null); setShowModal(true) }
  const openEdit   = (d) => { setEditDept(d);    setShowModal(true) }
  const closeModal = ()  => { setShowModal(false); setEditDept(null) }

  const handleDelete = async (d) => {
    if (!window.confirm(`Delete department "${d.name}"? Employees linked to it will lose their department.`)) return
    const { error } = await supabase.from('hr_departments').delete().eq('id', d.id)
    if (error) { toast.error(error.message); return }
    toast.success('Department deleted.')
    fetchDepts()
  }

  const handleToggleActive = async (d) => {
    const { error } = await supabase
      .from('hr_departments')
      .update({ is_active: !d.is_active, updated_at: new Date().toISOString() })
      .eq('id', d.id)
    if (error) { toast.error(error.message); return }
    toast.success(d.is_active ? 'Deactivated.' : 'Activated.')
    fetchDepts()
  }

  return (
    <Card>
      <div className="flex items-center gap-3 p-4 border-b border-surface-200 dark:border-surface-800">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-xs
                        px-3 py-2 rounded-lg bg-slate-50 dark:bg-surface-800
                        border border-surface-200 dark:border-surface-700">
          <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search departments…"
            className="bg-transparent text-sm text-slate-700 dark:text-slate-300
                       placeholder:text-slate-400 dark:placeholder:text-slate-600 flex-1 outline-none"
          />
        </div>
        <PermissionGate action="create" moduleId="hr">
          <Button size="sm" onClick={openNew}><Plus className="w-4 h-4" />New Department</Button>
        </PermissionGate>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Building className="w-8 h-8 text-pink-400 animate-pulse" />
          <p className="text-sm text-slate-400">Loading departments…</p>
        </div>
      ) : depts.length === 0 ? (
        <EmptyState
          icon={Building}
          title={search ? 'No departments match' : 'No departments yet'}
          description={search ? 'Try adjusting your search.' : 'Create your first department.'}
          action={!search && (
            <PermissionGate action="create" moduleId="hr">
              <Button size="sm" onClick={openNew}><Plus className="w-4 h-4" />New Department</Button>
            </PermissionGate>
          )}
        />
      ) : (
        <Table>
          <Thead>
            <Th>Name</Th>
            <Th>Description</Th>
            <Th>Status</Th>
            <Th></Th>
          </Thead>
          <Tbody>
            {depts.map(d => (
              <Tr key={d.id}>
                <Td>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{d.name}</span>
                </Td>
                <Td>
                  <span className="text-slate-500 text-sm truncate max-w-[260px] block">
                    {d.description || '—'}
                  </span>
                </Td>
                <Td>
                  <Badge color={d.is_active ? 'green' : 'default'}>
                    {d.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </Td>
                <Td onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    <PermissionGate action="edit" moduleId="hr">
                      <Button variant="ghost" size="xs" onClick={() => openEdit(d)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </PermissionGate>
                    <PermissionGate action="edit" moduleId="hr">
                      <Button
                        variant={d.is_active ? 'outline' : 'success'}
                        size="xs"
                        onClick={() => handleToggleActive(d)}
                      >
                        {d.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </PermissionGate>
                    <PermissionGate action="delete" moduleId="hr">
                      <Button variant="danger" size="xs" onClick={() => handleDelete(d)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </PermissionGate>
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      <Pagination
        page={page} totalPages={totalPages} onPageChange={setPage}
        total={total} pageSize={PAGE_SIZE} label="departments"
        className="border-t border-surface-200 dark:border-surface-800"
      />

      <DeptModal
        open={showModal} onClose={closeModal} onSaved={fetchDepts} dept={editDept}
      />
    </Card>
  )
}

// ── Positions Tab ─────────────────────────────────────────────────────────────

function PositionsTab() {
  const { tenantId }   = useTenant()
  const [positions,    setPositions]  = useState([])
  const [departments,  setDepts]      = useState([])
  const [total,        setTotal]      = useState(0)
  const [page,         setPage]       = useState(1)
  const [search,       setSearch]     = useState('')
  const [loading,      setLoading]    = useState(true)
  const [showModal,    setShowModal]  = useState(false)
  const [editPosition, setEditPos]    = useState(null)
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const fetchPositions = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      let query = supabase
        .from('hr_positions')
        .select('*, hr_departments(name)', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('title')
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
      if (search.trim()) query = query.ilike('title', `%${search.trim()}%`)
      const { data, count, error } = await query
      if (error) throw error
      setPositions(data || [])
      setTotal(count || 0)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [tenantId, page, search])

  const fetchDepts = useCallback(async () => {
    if (!tenantId) return
    const { data } = await supabase
      .from('hr_departments')
      .select('id, name, is_active')
      .eq('tenant_id', tenantId)
      .order('name')
    setDepts(data || [])
  }, [tenantId])

  useEffect(() => { fetchPositions() }, [fetchPositions])
  useEffect(() => { fetchDepts()     }, [fetchDepts])
  useEffect(() => { setPage(1) },       [search])

  const openNew    = ()  => { setEditPos(null);     setShowModal(true) }
  const openEdit   = (p) => { setEditPos(p);         setShowModal(true) }
  const closeModal = ()  => { setShowModal(false);   setEditPos(null) }

  const handleDelete = async (p) => {
    if (!window.confirm(`Delete position "${p.title}"?`)) return
    const { error } = await supabase.from('hr_positions').delete().eq('id', p.id)
    if (error) { toast.error(error.message); return }
    toast.success('Position deleted.')
    fetchPositions()
  }

  const handleToggleActive = async (p) => {
    const { error } = await supabase
      .from('hr_positions')
      .update({ is_active: !p.is_active, updated_at: new Date().toISOString() })
      .eq('id', p.id)
    if (error) { toast.error(error.message); return }
    toast.success(p.is_active ? 'Deactivated.' : 'Activated.')
    fetchPositions()
  }

  return (
    <Card>
      <div className="flex items-center gap-3 p-4 border-b border-surface-200 dark:border-surface-800">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-xs
                        px-3 py-2 rounded-lg bg-slate-50 dark:bg-surface-800
                        border border-surface-200 dark:border-surface-700">
          <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search positions…"
            className="bg-transparent text-sm text-slate-700 dark:text-slate-300
                       placeholder:text-slate-400 dark:placeholder:text-slate-600 flex-1 outline-none"
          />
        </div>
        <PermissionGate action="create" moduleId="hr">
          <Button size="sm" onClick={openNew}><Plus className="w-4 h-4" />New Position</Button>
        </PermissionGate>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Award className="w-8 h-8 text-pink-400 animate-pulse" />
          <p className="text-sm text-slate-400">Loading positions…</p>
        </div>
      ) : positions.length === 0 ? (
        <EmptyState
          icon={Award}
          title={search ? 'No positions match' : 'No positions yet'}
          description={search ? 'Try adjusting your search.' : 'Create your first job position.'}
          action={!search && (
            <PermissionGate action="create" moduleId="hr">
              <Button size="sm" onClick={openNew}><Plus className="w-4 h-4" />New Position</Button>
            </PermissionGate>
          )}
        />
      ) : (
        <Table>
          <Thead>
            <Th>Title</Th>
            <Th>Department</Th>
            <Th>Description</Th>
            <Th>Status</Th>
            <Th></Th>
          </Thead>
          <Tbody>
            {positions.map(p => (
              <Tr key={p.id}>
                <Td>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{p.title}</span>
                </Td>
                <Td>
                  <span className="text-slate-500 dark:text-slate-400 text-sm">
                    {p.hr_departments?.name || '—'}
                  </span>
                </Td>
                <Td>
                  <span className="text-slate-500 text-sm truncate max-w-[200px] block">
                    {p.description || '—'}
                  </span>
                </Td>
                <Td>
                  <Badge color={p.is_active ? 'green' : 'default'}>
                    {p.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </Td>
                <Td onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    <PermissionGate action="edit" moduleId="hr">
                      <Button variant="ghost" size="xs" onClick={() => openEdit(p)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </PermissionGate>
                    <PermissionGate action="edit" moduleId="hr">
                      <Button
                        variant={p.is_active ? 'outline' : 'success'}
                        size="xs"
                        onClick={() => handleToggleActive(p)}
                      >
                        {p.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </PermissionGate>
                    <PermissionGate action="delete" moduleId="hr">
                      <Button variant="danger" size="xs" onClick={() => handleDelete(p)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </PermissionGate>
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      <Pagination
        page={page} totalPages={totalPages} onPageChange={setPage}
        total={total} pageSize={PAGE_SIZE} label="positions"
        className="border-t border-surface-200 dark:border-surface-800"
      />

      <PositionModal
        open={showModal}
        onClose={closeModal}
        onSaved={fetchPositions}
        position={editPosition}
        departments={departments}
      />
    </Card>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS = ['Departments', 'Positions']

export default function Departments() {
  const [activeTab, setActiveTab] = useState('Departments')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments & Positions"
        subtitle="Manage organizational structure and job roles"
        breadcrumb="HR / Departments"
      />

      <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-surface-800 w-fit">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab
                ? 'bg-white dark:bg-surface-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Departments' ? <DepartmentsTab /> : <PositionsTab />}
    </div>
  )
}
