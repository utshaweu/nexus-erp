import { PageHeader, Card } from '@shared/components/ui'
export default function Index() {
  return (
    <div className="space-y-6">
      <PageHeader title="Index" breadcrumb="Configuration / Index"/>
      <Card className="p-8 text-center text-slate-500 text-sm">Index settings — ready for configuration.</Card>
    </div>
  )
}
