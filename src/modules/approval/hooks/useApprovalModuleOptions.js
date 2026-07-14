import { useModule } from '@shared/hooks/useModule'

/**
 * Installed modules (excluding approval itself) as {value,label} options —
 * shared by every module picker in this module (workflow builder, new
 * request form, pending/history filters) so they always match whatever
 * modules the tenant actually has installed.
 */
export function useApprovalModuleOptions() {
  const { installedModules } = useModule()
  return installedModules
    .filter(m => m.id !== 'approval')
    .map(m => ({ value: m.id, label: m.name || m.id }))
}
