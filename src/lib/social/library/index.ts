import { N8N_WORKFLOW_ITEMS } from './items/n8nWorkflows.generated'
import { PLUGIN_ITEMS } from './items/plugins'
import { PROMPT_ITEMS } from './items/prompts'
import { REPORT_ITEMS } from './items/reports'
import { SKILL_ITEMS } from './items/skills'
import type { SocialChannel, SocialFormat, SocialItem, SocialKind } from './types'

export * from './types'

/** Hand-made cards first, then the generated n8n workflows. */
export const SOCIAL_LIBRARY: SocialItem[] = [
  ...SKILL_ITEMS,
  ...PROMPT_ITEMS,
  ...PLUGIN_ITEMS,
  ...REPORT_ITEMS,
  ...N8N_WORKFLOW_ITEMS,
]

/** URL segment ↔ kind. `/social/all` shows everything, `/social/saved` what the creator saved. */
export const KIND_SEGMENTS = ['all', 'skills', 'prompts', 'workflows', 'plugins', 'reports', 'saved'] as const
export type KindSegment = (typeof KIND_SEGMENTS)[number]

export const SEGMENT_KIND: Record<Exclude<KindSegment, 'all' | 'saved'>, SocialKind> = {
  skills: 'skill',
  prompts: 'prompt',
  workflows: 'workflow',
  plugins: 'plugin',
  reports: 'report',
}

export const KIND_SEGMENT: Record<SocialKind, Exclude<KindSegment, 'all' | 'saved'>> = {
  skill: 'skills',
  prompt: 'prompts',
  workflow: 'workflows',
  plugin: 'plugins',
  report: 'reports',
}

export const KIND_LABEL: Record<SocialKind, string> = {
  skill: 'Skill',
  prompt: 'Prompt',
  workflow: 'Workflow',
  plugin: 'Plugin',
  report: 'Report',
}

export const SEGMENT_LABEL: Record<KindSegment, string> = {
  all: 'All',
  skills: 'Skills',
  prompts: 'Prompts',
  workflows: 'Workflows',
  plugins: 'Plugins',
  reports: 'Reports',
  saved: 'Saved',
}

export const KIND_HINT: Record<SocialKind, string> = {
  skill: 'teach your agent a craft: editing, captions, copy',
  prompt: 'one task, ready to paste: calendars, carousels, ads',
  workflow: 'n8n automations to import into your own n8n',
  plugin: 'MCP servers and plugins that give your agent new tools',
  report: 'numbers and insights, sent to you on a schedule',
}

export const CHANNEL_LABEL: Record<SocialChannel, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  x: 'X',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  blog: 'Blog / SEO',
  email: 'Email',
  print: 'Print',
}

export const FORMAT_LABEL: Record<SocialFormat, string> = {
  video: 'Video',
  image: 'Image',
  post: 'Post',
  carousel: 'Carousel',
  article: 'Article',
  audio: 'Audio',
  research: 'Research',
  ads: 'Ads',
  automation: 'Automation',
}

export function isKindSegment(value: string): value is KindSegment {
  return (KIND_SEGMENTS as readonly string[]).includes(value)
}

export function countByKind(): Record<SocialKind, number> {
  const counts: Record<SocialKind, number> = { skill: 0, prompt: 0, workflow: 0, plugin: 0, report: 0 }
  for (const item of SOCIAL_LIBRARY) counts[item.kind] += 1
  return counts
}
