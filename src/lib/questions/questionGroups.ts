import 'server-only'
import { prismaClient } from '@/lib/prismaClient'

export type QuestionGroupView = {
  id: string
  label: string
  examples: string[]
  askedCount: number
  wentQuietCount: number
  status: 'OPEN' | 'ANSWERED' | 'IGNORED'
  answer: string | null
  lastAskedAt: string | null
}

const STATUSES = new Set(['OPEN', 'ANSWERED', 'IGNORED'])

/** One project's question groups (or General with projectId null), most asked first. */
export async function loadQuestionGroups(userId: string, projectId: string | null): Promise<QuestionGroupView[]> {
  const rows = await prismaClient.questionGroup.findMany({
    where: { userId, webinarId: projectId },
    orderBy: [{ askedCount: 'desc' }, { lastAskedAt: 'desc' }],
    take: 200,
  })
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    examples: Array.isArray(row.examples) ? row.examples.filter((item): item is string => typeof item === 'string') : [],
    askedCount: row.askedCount,
    wentQuietCount: row.wentQuietCount,
    status: (STATUSES.has(row.status) ? row.status : 'OPEN') as QuestionGroupView['status'],
    answer: row.answer,
    lastAskedAt: row.lastAskedAt?.toISOString() ?? null,
  }))
}

/** General answers for the public business page FAQ (project answers stay on their project). */
export async function loadSiteAnswers(userId: string, limit = 12) {
  const rows = await prismaClient.questionGroup.findMany({
    where: { userId, webinarId: null, status: 'ANSWERED', answer: { not: null } },
    orderBy: [{ askedCount: 'desc' }, { answeredAt: 'desc' }],
    take: limit,
    select: { label: true, answer: true },
  })
  return rows.flatMap((row) => (row.answer ? [{ question: row.label, answer: row.answer }] : []))
}

/**
 * The creator's approved answers, for the agents' instructions. Project answers come first for
 * that project's chats; General answers apply everywhere.
 */
export async function loadApprovedAnswers(userId: string, projectId: string | null = null, limit = 30) {
  const rows = await prismaClient.questionGroup.findMany({
    where: {
      userId,
      status: 'ANSWERED',
      answer: { not: null },
      OR: projectId ? [{ webinarId: projectId }, { webinarId: null }] : [{ webinarId: null }, { webinarId: { not: null } }],
    },
    orderBy: [{ askedCount: 'desc' }, { answeredAt: 'desc' }],
    take: limit,
    select: { label: true, answer: true },
  })
  return rows.flatMap((row) => (row.answer ? [{ question: row.label, answer: row.answer }] : []))
}
