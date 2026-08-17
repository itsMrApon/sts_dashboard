export type PublishModuleId = 'core' | 'industry' | 'social' | 'blog'

export type PublishModulesState = Record<PublishModuleId, boolean>

export const PUBLISH_MODULE_CATALOG: Array<{
  id: PublishModuleId
  label: string
  description: string
  defaultEnabled: boolean
}> = [
  {
    id: 'core',
    label: 'Core',
    description: 'Terms, legal, and shared policy text for public/MCP context',
    defaultEnabled: true,
  },
  {
    id: 'industry',
    label: 'Industry Module',
    description: 'Vertical facts, services catalog, and industry summary',
    defaultEnabled: true,
  },
  {
    id: 'social',
    label: 'Social',
    description: 'Public social handles and channel links',
    defaultEnabled: true,
  },
  {
    id: 'blog',
    label: 'Blog',
    description: 'Industry copy blocks for blog sections on partner sites',
    defaultEnabled: false,
  },
]

export const DEFAULT_PUBLISH_MODULES: PublishModulesState = {
  core: true,
  industry: true,
  social: true,
  blog: false,
}

export function normalizePublishModules(raw: unknown): PublishModulesState {
  const input =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}

  return {
    core: typeof input.core === 'boolean' ? input.core : DEFAULT_PUBLISH_MODULES.core,
    industry:
      typeof input.industry === 'boolean' ? input.industry : DEFAULT_PUBLISH_MODULES.industry,
    social: typeof input.social === 'boolean' ? input.social : DEFAULT_PUBLISH_MODULES.social,
    blog: typeof input.blog === 'boolean' ? input.blog : DEFAULT_PUBLISH_MODULES.blog,
  }
}

/** Strip disabled outbound sections from a compact profile payload. */
export function applyPublishModulesToCompact(
  compact: Record<string, unknown>,
  modules: PublishModulesState,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...compact }

  if (!modules.core && next.core) delete next.core
  if (!modules.industry && next.industry) delete next.industry
  if (!modules.social && next.social) delete next.social
  if (!modules.blog) {
    delete next.blog
  }

  return next
}
