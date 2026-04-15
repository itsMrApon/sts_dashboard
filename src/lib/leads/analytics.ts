import { prismaClient } from '@/lib/prismaClient'

export async function getLeadJourneyEvents(
  userId: string,
  leadId: string,
) {
  return prismaClient.eventLog.findMany({
    where: { userId, leadId },
    orderBy: { createdAt: 'asc' },
  })
}

export async function getTopObjections(userId: string) {
  const transcripts = await prismaClient.callTranscript.findMany({
    where: { userId },
    select: { objections: true },
  })

  const all = transcripts.flatMap(
    (t) => (t.objections as string[]) || [],
  )

  const counts = all.reduce(
    (acc, obj) => ({
      ...acc,
      [obj]: (acc[obj] || 0) + 1,
    }),
    {} as Record<string, number>,
  )

  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([objection, count]) => ({ objection, count }))
}

export async function getConversionBySource(userId: string) {
  const leads = await prismaClient.huntedLead.findMany({
    where: { userId },
    select: { source: true, outreachSent: true },
  })

  const grouped = leads.reduce(
    (acc, lead) => {
      if (!acc[lead.source]) {
        acc[lead.source] = { total: 0, sent: 0 }
      }
      acc[lead.source].total++
      if (lead.outreachSent) acc[lead.source].sent++
      return acc
    },
    {} as Record<string, { total: number; sent: number }>,
  )

  return Object.entries(grouped).map(([source, data]) => ({
    source,
    total: data.total,
    sent: data.sent,
    rate: data.total > 0
      ? Math.round((data.sent / data.total) * 100)
      : 0,
  }))
}
