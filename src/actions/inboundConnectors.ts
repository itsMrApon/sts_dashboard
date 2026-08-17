'use server'

import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache'
import type { InboundConnectorInput } from '@/lib/inboundConnectors'
import { prismaClient } from '@/lib/prismaClient'
import { onAuthenticateUser } from './auth'

async function requireUser(resolvedUserId?: string) {
  if (resolvedUserId) return { id: resolvedUserId }
  const authResult = await onAuthenticateUser()
  if (!authResult.user) return null
  return { id: authResult.user.id }
}

async function requireWorkspaceForUser(workspaceId: string, userId: string) {
  return prismaClient.workspace.findFirst({
    where: { id: workspaceId, userId },
    select: { id: true, name: true, publishProfileId: true },
  })
}

const getPartnerConnectorsCached = unstable_cache(
  async (userId: string, workspaceId: string) => {
    const rows = await prismaClient.workspacePartnerConnector.findMany({
      where: { workspaceId, userId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        workspaceId: true,
        kind: true,
        label: true,
        mcpUrl: true,
        authType: true,
        enabled: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    return rows.map((row) => ({
      ...row,
      tenantId: row.workspaceId,
    }))
  },
  ['partner-connectors-v1'],
  { revalidate: 15, tags: ['partner-connectors'] },
)

export async function getPartnerConnectorsForWorkspace(
  workspaceId: string,
  resolvedUserId?: string,
) {
  const user = await requireUser(resolvedUserId)
  if (!user) return []

  // Ownership is enforced by userId + workspaceId filter (no extra workspace lookup).
  return getPartnerConnectorsCached(user.id, workspaceId)
}

/** @deprecated Use getPartnerConnectorsForWorkspace */
export const getInboundConnectorsForTenant = getPartnerConnectorsForWorkspace

export async function createPartnerConnector(input: InboundConnectorInput) {
  const user = await requireUser()
  if (!user) return { success: false as const, error: 'UNAUTHENTICATED' }

  const workspaceId = input.workspaceId ?? input.tenantId
  if (!workspaceId) {
    return { success: false as const, error: 'workspaceId is required' }
  }

  const workspace = await requireWorkspaceForUser(workspaceId, user.id)
  if (!workspace) return { success: false as const, error: 'Workspace not found' }

  const label = input.label.trim()
  const mcpUrl = input.mcpUrl.trim()
  if (!label) return { success: false as const, error: 'Label is required' }
  if (!mcpUrl) return { success: false as const, error: 'MCP URL is required' }

  const kind = input.kind.trim().toLowerCase() || 'custom'
  const existing = await prismaClient.workspacePartnerConnector.findFirst({
    where: { workspaceId, userId: user.id, kind },
    select: { id: true, label: true },
  })
  if (existing) {
    return {
      success: false as const,
      error: `${existing.label} already exists for this workspace. Remove it first to replace this partner.`,
    }
  }

  try {
    const connector = await prismaClient.workspacePartnerConnector.create({
      data: {
        workspaceId,
        userId: user.id,
        kind,
        label,
        mcpUrl,
        authType: input.authType?.trim() || 'none',
        authSecret: input.authSecret?.trim() || null,
        enabled: input.enabled !== false,
      },
    })

    revalidatePath('/tenants/partners')
    revalidatePath('/tenants')
    revalidateTag('partner-connectors')
    return { success: true as const, connector }
  } catch (error) {
    console.error('createPartnerConnector', error)
    return { success: false as const, error: 'Failed to create connector' }
  }
}

/** @deprecated Use createPartnerConnector */
export const createInboundConnector = createPartnerConnector

export async function deletePartnerConnector(connectorId: string) {
  const user = await requireUser()
  if (!user) return { success: false as const, error: 'UNAUTHENTICATED' }

  const deleted = await prismaClient.workspacePartnerConnector.deleteMany({
    where: { id: connectorId, userId: user.id },
  })
  if (deleted.count === 0) return { success: false as const, error: 'Connector not found' }

  revalidatePath('/tenants/partners')
  revalidatePath('/tenants')
  revalidateTag('partner-connectors')
  return { success: true as const }
}

/** @deprecated Use deletePartnerConnector */
export const deleteInboundConnector = deletePartnerConnector

export async function togglePartnerConnector(connectorId: string, enabled: boolean) {
  const user = await requireUser()
  if (!user) return { success: false as const, error: 'UNAUTHENTICATED' }

  const updated = await prismaClient.workspacePartnerConnector.updateMany({
    where: { id: connectorId, userId: user.id },
    data: { enabled },
  })
  if (updated.count === 0) return { success: false as const, error: 'Connector not found' }

  revalidatePath('/tenants/partners')
  revalidatePath('/tenants')
  revalidateTag('partner-connectors')
  return { success: true as const }
}

/** @deprecated Use togglePartnerConnector */
export const toggleInboundConnector = togglePartnerConnector
