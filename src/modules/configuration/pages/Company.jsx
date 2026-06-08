import { PageHeader, Card } from '@shared/components/ui'
export default function Company() {
  return (
    <div className="space-y-6">
      <PageHeader title="Company" breadcrumb="Configuration / Company"/>
      <Card className="p-8 text-center text-slate-500 text-sm">Company settings — ready for configuration.</Card>
    </div>
  )
}
