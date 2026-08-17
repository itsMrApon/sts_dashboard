import { prismaClient } from '@/lib/prismaClient'
import { normalizeIndustryInput } from '@/lib/tenantContext'
import {
  applyPublishModulesToCompact,
  normalizePublishModules,
} from '@/lib/tenants/publishModules'

export type PublishedWorkspaceProfileResult =
  | {
      ok: true
      workspaceId: string
      publishProfileId: string | null
      workspaceName: string
      contextVersion: string | null
      publishedAt: Date | null
      compact: Record<string, unknown>
      industry: Record<string, unknown>
    }
  | { ok: false; status: number; code: string; message: string }

export async function loadPublishedWorkspaceProfile(
  workspaceId: string,
): Promise<PublishedWorkspaceProfileResult> {
  const workspace = await prismaClient.workspace.findFirst({
    where: {
      id: workspaceId,
      contextStatus: 'PUBLISHED',
    },
    include: {
      publishProfile: { select: { id: true, name: true } },
    },
  })

  if (!workspace?.compactProfileJson) {
    return {
      ok: false,
      status: 404,
      code: 'PROFILE_NOT_PUBLISHED',
      message: 'No published profile found for this workspace.',
    }
  }

  const modules = normalizePublishModules(
    (workspace as { publishModulesJson?: unknown }).publishModulesJson,
  )
  const compact = applyPublishModulesToCompact(
    workspace.compactProfileJson as Record<string, unknown>,
    modules,
  )
  const industry = normalizeIndustryInput(
    compact.industry && typeof compact.industry === 'object'
      ? (compact.industry as Parameters<typeof normalizeIndustryInput>[0])
      : null,
  )

  return {
    ok: true,
    workspaceId: workspace.id,
    publishProfileId: workspace.publishProfileId,
    workspaceName:
      workspace.publishProfile?.name ??
      workspace.name ??
      (typeof compact.businessName === 'string' ? compact.businessName : workspace.name),
    contextVersion: workspace.contextVersion,
    publishedAt: workspace.publishedAt,
    compact,
    industry,
  }
}

/** @deprecated use loadPublishedWorkspaceProfile */
export const loadPublishedBusinessProfile = async (id: string) => {
  // Legacy callers may still pass publishProfileId — resolve workspace first.
  const byWorkspace = await loadPublishedWorkspaceProfile(id)
  if (byWorkspace.ok) return byWorkspace

  const workspace = await prismaClient.workspace.findFirst({
    where: { publishProfileId: id, contextStatus: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    select: { id: true },
  })
  if (!workspace) {
    return {
      ok: false as const,
      status: 404,
      code: 'PROFILE_NOT_PUBLISHED',
      message: 'No published profile found for this id.',
    }
  }
  return loadPublishedWorkspaceProfile(workspace.id)
}
