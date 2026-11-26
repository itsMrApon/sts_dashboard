import 'server-only'
import type { LeadOutboundStatus, Prisma } from '@prisma/client'
import { prismaClient } from '@/lib/prismaClient'
import { int, str, type AgentTool } from '../types'

const STATUSES: LeadOutboundStatus[] = ['NEW', 'ON_PROCESS', 'DONE']

/** Leads (Lead → List), as the agent may see them: who, where they came from and where they stand. Never their email or phone. */
export const LEAD_TOOLS: AgentTool[] = [
  {
    kind: 'read',
    name: 'list_leads',
    area: 'leads',
    title: 'Leads',
    description:
      'The creator’s leads from Lead → List, latest first: name, company, position, website, source, status (NEW, ON_PROCESS, DONE), next follow-up date, the creator’s notes and the latest activity. Contact details are never included; use draft_email_to_lead to write to one.',
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Matches name, company, position or notes.' },
        status: { type: 'string', enum: STATUSES },
        limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Default 25.' },
      },
      additionalProperties: false,
    },
    async run(ctx, input) {
      const search = str(input, 'search', { max: 100 })
      const status = str(input, 'status', { max: 12 }).toUpperCase() as LeadOutboundStatus
      const where: Prisma.CallIntelLeadWhereInput = { userId: ctx.userId }
      if (STATUSES.includes(status)) where.outboundStatus = status
      if (search) {
        where.OR = ['name', 'company', 'position', 'notes'].map((field) => ({ [field]: { contains: search, mode: 'insensitive' } }))
      }
      const rows = await prismaClient.callIntelLead.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: int(input, 'limit', { min: 1, max: 100, fallback: 25 }),
        select: {
          id: true,
          name: true,
          company: true,
          position: true,
          website: true,
          source: true,
          outboundStatus: true,
          nextFollowUpAt: true,
          notes: true,
          activities: { orderBy: { createdAt: 'desc' }, take: 1, select: { type: true, note: true, createdAt: true } },
        },
      })
      if (rows.length === 0) return 'No leads match.'
      const leads = rows.map(({ activities, outboundStatus, ...lead }) => ({ ...lead, status: outboundStatus, lastActivity: activities[0] ?? null }))
      return { text: JSON.stringify(leads, null, 2), structured: { leads } }
    },
  },
]
