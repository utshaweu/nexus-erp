import { PageHeader, Card } from '@shared/components/ui'
export default function Overview() {
  return (
    <div className="space-y-6">
      <PageHeader title="Overview Reports" breadcrumb="Reports / Overview"/>
      <Card className="p-8 text-center text-slate-500 text-sm">Overview reports — aggregates data from installed modules.</Card>
    </div>
  )
}
