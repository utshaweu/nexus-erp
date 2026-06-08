import { PageHeader, Card } from '@shared/components/ui'
export default function HRReports() {
  return (
    <div className="space-y-6">
      <PageHeader title="HRReports Reports" breadcrumb="Reports / HRReports"/>
      <Card className="p-8 text-center text-slate-500 text-sm">HRReports reports — aggregates data from installed modules.</Card>
    </div>
  )
}
