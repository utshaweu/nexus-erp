import { PageHeader, Card } from '@shared/components/ui'
export default function Financial() {
  return (
    <div className="space-y-6">
      <PageHeader title="Financial Reports" breadcrumb="Reports / Financial"/>
      <Card className="p-8 text-center text-slate-500 text-sm">Financial reports — aggregates data from installed modules.</Card>
    </div>
  )
}
