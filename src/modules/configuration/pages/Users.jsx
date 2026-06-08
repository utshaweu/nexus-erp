import { PageHeader, Card } from '@shared/components/ui'
export default function Users() {
  return (
    <div className="space-y-6">
      <PageHeader title="Users" breadcrumb="Configuration / Users"/>
      <Card className="p-8 text-center text-slate-500 text-sm">Users settings — ready for configuration.</Card>
    </div>
  )
}
