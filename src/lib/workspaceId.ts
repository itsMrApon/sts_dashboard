/** Accept legacy `tenantId` query/body fields during workspace migration. */
export function resolveWorkspaceId(
  params: { tenantId?: string | null; workspaceId?: string | null } | undefined,
): string | undefined {
  const id = params?.workspaceId ?? params?.tenantId
  return id || undefined
}

export type WorkspaceIdParams = {
  tenantId?: string
  workspaceId?: string
}
