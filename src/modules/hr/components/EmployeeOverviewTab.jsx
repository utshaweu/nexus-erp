import { User, Briefcase, DollarSign } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@shared/components/ui'
import { EMPLOYMENT_TYPES, GENDER_OPTIONS } from '@shared/lib/constants'

const fmt = (n) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function Row({ label, value }) {
  return (
    <div className="flex justify-between items-start gap-4 text-sm py-1
                    border-b border-surface-100 dark:border-surface-800 last:border-0">
      <span className="text-slate-500 dark:text-slate-400 flex-shrink-0">{label}</span>
      <span className="text-slate-900 dark:text-slate-100 font-medium text-right">{value}</span>
    </div>
  )
}

export default function EmployeeOverviewTab({ employee }) {
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-4 h-4 text-pink-400" />Personal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Row label="Gender"       value={GENDER_OPTIONS[employee.gender]   || '—'} />
          <Row label="Date of Birth" value={employee.date_of_birth           || '—'} />
          <Row label="Nationality"  value={employee.nationality              || '—'} />
          <Row label="Address"      value={employee.address                  || '—'} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-pink-400" />Employment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Row label="Join Date"       value={employee.join_date} />
          <Row label="Employment Type" value={EMPLOYMENT_TYPES[employee.employment_type] || employee.employment_type} />
          <Row label="Department"      value={employee.hr_departments?.name   || '—'} />
          <Row label="Position"        value={employee.hr_positions?.title    || '—'} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-pink-400" />Compensation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Row label="Basic Salary"    value={`$${fmt(employee.basic_salary)}`} />
          <Row label="Bank Name"       value={employee.bank_name           || '—'} />
          <Row label="Account Name"    value={employee.bank_account_name   || '—'} />
          <Row label="Account Number"  value={employee.bank_account_number || '—'} />
        </CardContent>
      </Card>

      {employee.notes && (
        <Card>
          <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{employee.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
