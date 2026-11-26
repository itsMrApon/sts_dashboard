import 'server-only'
import { SOCIAL_LIBRARY } from '@/lib/social/library'
import { buildSocialPrompt } from '@/lib/social/library/buildPrompt'
import type { AgentClient } from '@/lib/social/library/types'
import { AgentInputError, int, str, type AgentTool } from '../types'

const CLIENTS: AgentClient[] = ['claude', 'codex', 'cursor']

/** The Social library: the agent can find a card and read its full brief itself. */
export const SOCIAL_TOOLS: AgentTool[] = [
  {
    kind: 'read',
    name: 'search_social_library',
    area: 'social',
    title: 'Search the Social library',
    description:
      'Find skills, prompts, n8n workflows, plugins and reports in sts-ai → Social for a content job (e.g. "ugc ad", "instagram carousel", "youtube shorts"). Then call get_social_brief with the id.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        kind: { type: 'string', enum: ['skill', 'prompt', 'workflow', 'plugin', 'report'] },
        limit: { type: 'integer', minimum: 1, maximum: 30, description: 'Default 10.' },
      },
      additionalProperties: false,
    },
    async run(_ctx, input) {
      const words = str(input, 'query', { max: 120 }).toLowerCase().split(/\s+/).filter(Boolean)
      const kind = str(input, 'kind', { max: 10 })
      const matches = SOCIAL_LIBRARY.filter((item) => !kind || item.kind === kind)
        .map((item) => {
          const hay = `${item.title} ${item.summary} ${item.channels.join(' ')} ${item.formats.join(' ')}`.toLowerCase()
          return { item, hits: words.filter((w) => hay.includes(w)).length }
        })
        .filter((m) => words.length === 0 || m.hits > 0)
        .sort((a, b) => b.hits - a.hits)
        .slice(0, int(input, 'limit', { min: 1, max: 30, fallback: 10 }))
        .map(({ item }) => ({ id: item.id, kind: item.kind, title: item.title, summary: item.summary, channels: item.channels }))
      if (matches.length === 0) return 'Nothing matches. Try other words.'
      return { text: JSON.stringify(matches, null, 2), structured: { items: matches } }
    },
  },
  {
    kind: 'read',
    name: 'get_social_brief',
    area: 'social',
    title: 'Get a Social card’s brief',
    description: 'The full brief of one Social library card (goal, tools to connect, steps, deliverable), the same text as its Copy prompt.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, client: { type: 'string', enum: CLIENTS, description: 'Default claude.' } },
      required: ['id'],
      additionalProperties: false,
    },
    async run(ctx, input) {
      const id = str(input, 'id', { max: 120, required: true })
      const item = SOCIAL_LIBRARY.find((entry) => entry.id === id)
      if (!item) throw new AgentInputError('No card with that id. Call search_social_library.')
      const requested = str(input, 'client', { max: 10 }) as AgentClient
      const client = CLIENTS.includes(requested) ? requested : CLIENTS.includes(ctx.client as AgentClient) ? (ctx.client as AgentClient) : 'claude'
      return buildSocialPrompt(item, client)
    },
  },
]
