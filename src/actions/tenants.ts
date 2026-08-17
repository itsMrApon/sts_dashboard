'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath, unstable_cache } from 'next/cache'
import { prismaClient } from '@/lib/prismaClient'
import { ContextStatusEnum, VideoType } from '@prisma/client'
import { onAuthenticateUser } from './auth'
import {
  buildCompactProfile,
  buildContextVersion,
  INDUSTRY_VERTICALS,
  normalizeIndustryInput,
  type TenantContextDraft,
} from '@/lib/tenantContext'
import {
  applyPublishModulesToCompact,
  normalizePublishModules,
  type PublishModulesState,
} from '@/lib/tenants/publishModules'

export async function createWorkspace(data: {
  name: string
  publishProfileId?: string
  webinarId?: string
  pitchMessage: string
  videoUrl?: string
  videoType?: string
}) {
  const { userId } = await auth()
  if (!userId) return { success: false, error: 'UNAUTHENTICATED' }

  const user = await prismaClient.user.findUnique({
    where: { clerkId: userId },
    select: { id: true },
  })
  if (!user) return { success: false, error: 'User not found' }

  let publishProfileId = data.publishProfileId || null
  if (publishProfileId) {
    const biz = await prismaClient.publishProfile.findFirst({
      where: { id: publishProfileId, userId: user.id },
      select: { id: true },
    })
    if (!biz) return { success: false, error: 'Publish profile not found' }
  } else {
    const profile = await prismaClient.publishProfile.create({
      data: {
        userId: user.id,
        name: data.name.trim(),
      },
      select: { id: true },
    })
    publishProfileId = profile.id
  }

  const workspace = await prismaClient.workspace.create({
    data: {
      userId: user.id,
      publishProfileId,
      name: data.name.trim(),
      webinarId: data.webinarId || null,
      pitchMessage: data.pitchMessage,
      videoUrl: data.videoUrl || null,
      videoType: (data.videoType as VideoType) || 'LINK',
      publishModulesJson: normalizePublishModules(null),
    },
  })

  revalidatePath('/tenants')
  revalidatePath('/tenants/publish')
  return { success: true, workspace, tenant: workspace }
}

/** @deprecated Use updateWorkspace */
export async function updateTenant(
  workspaceId: string,
  data: Parameters<typeof updateWorkspace>[1],
) {
  return updateWorkspace(workspaceId, data)
}

export async function updateWorkspace(
  workspaceId: string,
  data: {
    name?: string
    pitchMessage?: string
    videoUrl?: string
    videoType?: string
    publishProfileId?: string | null
    webinarId?: string | null
  },
) {
  const { userId } = await auth()
  if (!userId) return { success: false, error: 'UNAUTHENTICATED' }

  const user = await prismaClient.user.findUnique({
    where: { clerkId: userId },
    select: { id: true },
  })
  if (!user) return { success: false, error: 'User not found' }

  const existing = await prismaClient.workspace.findFirst({
    where: { id: workspaceId, userId: user.id },
  })
  if (!existing) return { success: false, error: 'Workspace not found' }

  if (data.publishProfileId) {
    const biz = await prismaClient.publishProfile.findFirst({
      where: { id: data.publishProfileId, userId: user.id },
      select: { id: true },
    })
    if (!biz) return { success: false, error: 'Business not found' }
  }

  const workspace = await prismaClient.workspace.update({
    where: { id: workspaceId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.pitchMessage !== undefined && { pitchMessage: data.pitchMessage }),
      ...(data.videoUrl !== undefined && { videoUrl: data.videoUrl }),
      ...(data.videoType !== undefined && { videoType: data.videoType as VideoType }),
      ...(data.publishProfileId !== undefined && { publishProfileId: data.publishProfileId }),
      ...(data.webinarId !== undefined && { webinarId: data.webinarId }),
    },
  })

  revalidatePath('/tenants')
  revalidatePath(`/tenants/${workspaceId}`)
  return { success: true, workspace, tenant: workspace }
}

const getTenantsCached = unstable_cache(
  async (userId: string) =>
    prismaClient.workspace.findMany({
      where: { userId },
      include: {
        publishProfile: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ['tenants-list'],
  { revalidate: 10 },
)

export async function getTenants(resolvedUserId?: string) {
  let userId = resolvedUserId
  if (!userId) {
    const authResult = await onAuthenticateUser()
    if (!authResult.user) return []
    userId = authResult.user.id
  }

  return getTenantsCached(userId!)
}

const getTenantByIdCached = unstable_cache(
  async (userId: string, tenantId: string) =>
    prismaClient.workspace.findFirst({
      where: { id: tenantId, userId },
      select: {
        id: true,
        userId: true,
        publishProfileId: true,
        webinarId: true,
        name: true,
        pitchMessage: true,
        videoUrl: true,
        videoType: true,
        createdAt: true,
        updatedAt: true,
        contextStatus: true,
        contextVersion: true,
        compactTokenEstimate: true,
        contextVertical: true,
        contextCoreJson: true,
        contextIndustryJson: true,
        contextSocialJson: true,
        compactProfileJson: true,
        publishModulesJson: true,
        publishProfile: { select: { id: true, name: true } },
      },
    }),
  ['tenant-by-id-v1'],
  { revalidate: 10 },
)

export async function getTenantById(tenantId: string, resolvedUserId?: string) {
  let userId = resolvedUserId
  if (!userId) {
    const authResult = await onAuthenticateUser()
    if (!authResult.user) return null
    userId = authResult.user.id
  }

  return getTenantByIdCached(userId!, tenantId)
}

/** Slim workspace row for nav/partners — no context JSON payload. */
const getWorkspaceMetaCached = unstable_cache(
  async (userId: string, workspaceId: string) =>
    prismaClient.workspace.findFirst({
      where: { id: workspaceId, userId },
      select: {
        id: true,
        name: true,
        publishProfileId: true,
      },
    }),
  ['workspace-meta-v1'],
  { revalidate: 30 },
)

export async function getWorkspaceMeta(workspaceId: string, resolvedUserId?: string) {
  let userId = resolvedUserId
  if (!userId) {
    const authResult = await onAuthenticateUser()
    if (!authResult.user) return null
    userId = authResult.user.id
  }

  return getWorkspaceMetaCached(userId!, workspaceId)
}

export async function deleteTenant(tenantId: string) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return { success: false, error: 'UNAUTHENTICATED' }

  const user = await prismaClient.user.findUnique({
    where: { clerkId },
    select: { id: true },
  })
  if (!user) return { success: false, error: 'User not found' }

  try {
    await prismaClient.workspace.deleteMany({
      where: { id: tenantId, userId: user.id },
    })

    revalidatePath('/tenants')
    return { success: true }
  } catch (error) {
    console.error('deleteTenant error', error)
    return { success: false, error: 'Failed to delete tenant' }
  }
}

const getTenantForUser = async (tenantId: string) => {
  const { userId } = await auth()
  if (!userId) return { ok: false as const, error: 'UNAUTHENTICATED' }

  const user = await prismaClient.user.findUnique({
    where: { clerkId: userId },
    select: { id: true },
  })
  if (!user) return { ok: false as const, error: 'User not found' }

  const tenant = await prismaClient.workspace.findFirst({
    where: { id: tenantId, userId: user.id },
    include: { publishProfile: true },
  })
  if (!tenant) return { ok: false as const, error: 'Tenant not found' }

  return { ok: true as const, user, tenant }
}

const splitSqlRowValues = (row: string) => {
  const values: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < row.length; i++) {
    const ch = row[i]
    if (ch === "'" && row[i - 1] !== '\\') {
      inQuotes = !inQuotes
      current += ch
      continue
    }
    if (ch === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
      continue
    }
    current += ch
  }
  if (current.trim()) values.push(current.trim())
  return values
}

const parseSqlString = (raw: string) => {
  if (raw === 'NULL') return ''
  const unwrapped = raw.startsWith("'") && raw.endsWith("'") ? raw.slice(1, -1) : raw
  return unwrapped.replaceAll("\\'", "'")
}

const normalizeType = (value: string) => {
  const text = value.trim().toLowerCase()
  if (text === 'insurance' || text === 'primary') return 'insurance'
  if (text === 'tax' || text === 'secondary') return 'tax'
  if (text === 'other' || text === 'support') return 'other'
  return 'insurance'
}

const parseServicesSql = (sql: string) => {
  const match = sql.match(/INSERT INTO `services`[\s\S]*?VALUES\s*([\s\S]*?);/)
  if (!match) return []
  const tuples = [...match[1].matchAll(/\(([\s\S]*?)\)(?:,|$)/g)].map((m) => m[1])

  return tuples
    .map((tuple, idx) => {
      const cols = splitSqlRowValues(tuple)
      if (cols.length < 15) return null
      return {
        type: normalizeType(parseSqlString(cols[2]) || 'insurance'),
        category: `Category ${Number(cols[3]) || 0}`,
        title: parseSqlString(cols[1]),
        description: parseSqlString(cols[4]),
        detailsShort: parseSqlString(cols[5]),
        detailsLong: parseSqlString(cols[6]),
        price: parseSqlString(cols[7]),
        sortOrder: Number(cols[12]) || idx + 1,
        isActive: cols[11] !== '0',
      }
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
}

const splitCsvLine = (line: string) => {
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === ',' && !inQuotes) {
      cells.push(current.trim())
      current = ''
      continue
    }
    current += ch
  }
  cells.push(current.trim())
  return cells
}

const findColumnIndex = (headers: string[], aliases: string[]) =>
  headers.findIndex((header) => aliases.includes(header.trim().toLowerCase()))

const parseServicesCsv = (csv: string) => {
  const rows = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (rows.length < 2) return []

  const headers = splitCsvLine(rows[0]).map((h) => h.trim().toLowerCase())
  const idx = {
    type: findColumnIndex(headers, ['type', 'service_type', 'track']),
    category: findColumnIndex(headers, ['category', 'category_name']),
    title: findColumnIndex(headers, ['title', 'name', 'service']),
    description: findColumnIndex(headers, ['description', 'summary']),
    detailsShort: findColumnIndex(headers, ['details_short', 'detailsshort', 'short_details']),
    detailsLong: findColumnIndex(headers, ['details_long', 'detailslong', 'long_details']),
    price: findColumnIndex(headers, ['price', 'package', 'amount']),
    sortOrder: findColumnIndex(headers, ['sort_order', 'sortorder', 'order']),
    isActive: findColumnIndex(headers, ['is_active', 'isactive', 'active']),
  }

  return rows
    .slice(1)
    .map((row, rowIndex) => {
      const cols = splitCsvLine(row)
      const title = idx.title >= 0 ? cols[idx.title] || '' : ''
      if (!title) return null

      const activeRaw = idx.isActive >= 0 ? String(cols[idx.isActive] || '').toLowerCase() : '1'
      return {
        type: normalizeType(idx.type >= 0 ? cols[idx.type] || 'insurance' : 'insurance'),
        category: idx.category >= 0 ? cols[idx.category] || 'General' : 'General',
        title,
        description: idx.description >= 0 ? cols[idx.description] || title : title,
        detailsShort: idx.detailsShort >= 0 ? cols[idx.detailsShort] || '' : '',
        detailsLong: idx.detailsLong >= 0 ? cols[idx.detailsLong] || '' : '',
        price: idx.price >= 0 ? cols[idx.price] || '' : '',
        sortOrder: idx.sortOrder >= 0 ? Number(cols[idx.sortOrder] || rowIndex + 1) : rowIndex + 1,
        isActive: !['0', 'false', 'no'].includes(activeRaw),
      }
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
}

export async function saveTenantContextDraft(tenantId: string, draft: TenantContextDraft) {
  const result = await getTenantForUser(tenantId)
  if (!result.ok) return { success: false, error: result.error }

  const vertical =
    draft.vertical && INDUSTRY_VERTICALS.includes(draft.vertical as (typeof INDUSTRY_VERTICALS)[number])
      ? draft.vertical
      : null

  const normalizedIndustry = normalizeIndustryInput(draft.industry)

  const fullProfile = {
    core: draft.core,
    industry: normalizedIndustry,
    social: draft.social,
    blog: draft.blog || {},
  }

  await prismaClient.workspace.update({
    where: { id: tenantId },
    data: {
      contextVertical: vertical,
      contextCoreJson: draft.core,
      contextIndustryJson: normalizedIndustry,
      contextSocialJson: draft.social,
      fullProfileJson: fullProfile,
      contextStatus:
        result.tenant.contextStatus === ContextStatusEnum.PUBLISHED
          ? ContextStatusEnum.PUBLISHED
          : ContextStatusEnum.DRAFT,
    },
  })

  revalidatePath('/tenants')
  revalidatePath(`/tenants/${tenantId}`)
  revalidatePath('/tenants/publish')
  revalidatePath('/messages/publish')
  revalidatePath('/messages')
  return { success: true }
}

export async function importServicesCatalogToTenant(
  tenantId: string,
  input: { content: string; format?: 'auto' | 'sql' | 'csv' },
) {
  const result = await getTenantForUser(tenantId)
  if (!result.ok) return { success: false, error: result.error }

  try {
    const content = input.content?.trim()
    if (!content) return { success: false, error: 'File content is empty' }

    const format =
      input.format && input.format !== 'auto'
        ? input.format
        : content.includes('INSERT INTO') && content.includes('services')
          ? 'sql'
          : 'csv'

    const typeSort = format === 'sql' ? parseServicesSql(content) : parseServicesCsv(content)
    if (!typeSort.length) {
      return { success: false, error: 'No service rows found in uploaded file' }
    }

    const existingIndustry = normalizeIndustryInput(
      result.tenant.contextIndustryJson as TenantContextDraft['industry'] | null,
    )

    await prismaClient.workspace.update({
      where: { id: tenantId },
      data: {
        contextIndustryJson: {
          ...existingIndustry,
          typeSort,
        },
        contextStatus:
          result.tenant.contextStatus === ContextStatusEnum.PUBLISHED
            ? ContextStatusEnum.PUBLISHED
            : ContextStatusEnum.DRAFT,
      },
    })

    revalidatePath('/tenants')
    revalidatePath(`/tenants/${tenantId}`)
    revalidatePath('/tenants/publish')
    revalidatePath('/messages/publish')
    revalidatePath('/messages')

    return { success: true, typeSort, importedCount: typeSort.length, format }
  } catch (error) {
    console.error('importServicesCatalogToTenant error', error)
    return { success: false, error: 'Failed to import services from file' }
  }
}

export async function publishTenantContext(tenantId: string) {
  const result = await getTenantForUser(tenantId)
  if (!result.ok) return { success: false, error: result.error }

  const channels = await prismaClient.outreachChannel.findMany({
    where: {
      publishProfileId: result.tenant.publishProfileId?? undefined,
      userId: result.user.id,
      status: 'ACTIVE',
    },
    select: {
      platform: true,
      accountLabel: true,
      pageUrl: true,
    },
  })

  const draft: TenantContextDraft = {
    vertical: result.tenant.contextVertical || undefined,
    core: (result.tenant.contextCoreJson as TenantContextDraft['core']) || {},
    industry: normalizeIndustryInput(
      result.tenant.contextIndustryJson as TenantContextDraft['industry'] | null,
    ),
    social: (result.tenant.contextSocialJson as TenantContextDraft['social']) || {},
    blog:
      ((result.tenant.fullProfileJson as { blog?: TenantContextDraft['blog'] } | null)?.blog) ||
      {},
  }

  const { compact, compactTokenEstimate } = buildCompactProfile(
    result.tenant.name,
    result.tenant.publishProfile?.name || null,
    draft,
    channels,
  )
  const modules = {
    core: true,
    industry: true,
    social: true,
    blog: Boolean(draft.blog?.intro?.trim()),
  }
  const version = buildContextVersion()

  await prismaClient.workspace.update({
    where: { id: tenantId },
    data: {
      compactProfileJson: applyPublishModulesToCompact(compact, modules),
      compactTokenEstimate,
      contextVersion: version,
      contextStatus: ContextStatusEnum.PUBLISHED,
      publishedAt: new Date(),
    },
  })

  revalidatePath('/tenants')
  revalidatePath(`/tenants/${tenantId}`)
  revalidatePath('/tenants/publish')
  revalidatePath('/messages/publish')
  revalidatePath('/messages')
  return { success: true, contextVersion: version, compactTokenEstimate }
}

export async function getTenantContextStatus(tenantId: string) {
  const result = await getTenantForUser(tenantId)
  if (!result.ok) return { success: false, error: result.error }

  return {
    success: true,
    data: {
      status: result.tenant.contextStatus,
      version: result.tenant.contextVersion,
      compactTokenEstimate: result.tenant.compactTokenEstimate,
      publishedAt: result.tenant.publishedAt,
    },
  }
}

export async function getTenantCompactContext(tenantId: string) {
  const result = await getTenantForUser(tenantId)
  if (!result.ok) return { success: false, error: result.error }

  return {
    success: true,
    data: result.tenant.compactProfileJson,
  }
}

export async function getTenantMcpResource(tenantId: string, resourcePath: string) {
  const result = await getTenantForUser(tenantId)
  if (!result.ok) return { success: false, error: result.error }

  const compact = (result.tenant.compactProfileJson as Record<string, unknown>) || {}
  const links = {
    stripeOrderUrl: null,
    webinarLinks: [],
    projectLinks: [],
    chatRoomName: result.tenant.webinarId || null,
  }

  switch (resourcePath) {
    case 'core/compact':
      return { success: true, data: compact.core || null }
    case 'industry/compact':
      return { success: true, data: compact.industry || null }
    case 'social/compact':
      return { success: true, data: compact.social || null }
    case 'services/list':
      return {
        success: true,
        data: {
          tenantId: result.tenant.id,
          tenantName: result.tenant.name,
          businessName: result.tenant.publishProfile?.name || null,
          vertical: result.tenant.contextVertical || null,
        },
      }
    case 'pricing':
      return {
        success: true,
        data: {
          cta: (compact.core as { cta?: unknown } | undefined)?.cta || null,
        },
      }
    case 'links':
      return { success: true, data: links }
    default:
      return { success: false, error: 'Unknown resource path' }
  }
}

export async function getTenantsByBusinessId(publishProfileId: string) {
  const authResult = await onAuthenticateUser()
  if (!authResult.user) return []

  return prismaClient.workspace.findMany({
    where: {
      userId: authResult.user.id,
      publishProfileId,
    },
    select: {
      id: true,
      name: true,
      contextStatus: true,
      contextVersion: true,
      compactTokenEstimate: true,
      contextVertical: true,
    },
    orderBy: { updatedAt: 'desc' },
  })
}

/** Backward compatible alias to MCP publishing flow. */
export async function pushTenantContextToN8n(tenantId: string) {
  const published = await publishTenantContext(tenantId)
  if (!published.success) {
    return { success: false, error: published.error || 'Context publish failed' }
  }

  return { success: true }
}

/** @deprecated Use createWorkspace */
export async function updatePublishModules(
  workspaceId: string,
  modules: PublishModulesState,
): Promise<{ success: true; modules: PublishModulesState } | { success: false; error: string }> {
  const result = await getTenantForUser(workspaceId)
  if (!result.ok) return { success: false, error: result.error }

  const normalized = normalizePublishModules(modules)

  await prismaClient.workspace.update({
    where: { id: workspaceId },
    data: { publishModulesJson: normalized },
  })

  // If already published, refresh compact so toggles apply immediately.
  if (result.tenant.contextStatus === ContextStatusEnum.PUBLISHED) {
    await publishTenantContext(workspaceId)
  }

  revalidatePath('/tenants')
  revalidatePath(`/tenants/${workspaceId}`)
  revalidatePath('/tenants/publish')
  revalidatePath('/messages/publish')
  revalidatePath('/messages')
  return { success: true, modules: normalized }
}

export const createTenant = createWorkspace

/** @deprecated Use getWorkspaces */
export const getWorkspaces = getTenants

export async function getWorkspaceById(workspaceId: string) {
  return getTenantById(workspaceId)
}

export async function deleteWorkspace(workspaceId: string) {
  return deleteTenant(workspaceId)
}
