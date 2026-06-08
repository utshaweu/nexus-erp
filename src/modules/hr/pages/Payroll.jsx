import { PageHeader, Card } from '@shared/components/ui'
export default function Payroll() {
  return (
    <div className="space-y-6">
      <PageHeader title="Payroll" breadcrumb="HR / Payroll"/>
      <Card className="p-8 text-center text-slate-500 text-sm">Payroll — ready for Supabase integration.</Card>
    </div>
  )
}
