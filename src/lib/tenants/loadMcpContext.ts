import { getTenantMcpResource } from '@/actions/tenants'

export async function loadMcpContextForTenant(
  tenantId: string,
  resourcePaths: string[],
): Promise<Record<string, unknown>> {
  const context: Record<string, unknown> = {}

  await Promise.all(
    resourcePaths.map(async (path) => {
      const result = await getTenantMcpResource(tenantId, path)
      if (result.success) {
        context[path] = result.data
      } else {
        context[path] = { error: result.error }
      }
    }),
  )

  return context
}
