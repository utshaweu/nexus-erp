import { PageHeader, Card } from '@shared/components/ui'
export default function Operations() {
  return (
    <div className="space-y-6">
      <PageHeader title="Operations Reports" breadcrumb="Reports / Operations"/>
      <Card className="p-8 text-center text-slate-500 text-sm">Operations reports — aggregates data from installed modules.</Card>
    </div>
  )
}
