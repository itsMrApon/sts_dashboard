import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { unstable_cache } from 'next/cache'
import { prismaClient } from '@/lib/prismaClient'
import type { AttendedTypeEnum, WebinarKind } from '@prisma/client'
import { LeadSourceBadge } from './LeadSourceBadge'
import { LeadScoreBadge } from './LeadScoreBadge'

function kindLabel(kind: WebinarKind): string {
  return kind === 'PRODUCT' ? 'Product' : 'Project'
}

const attendedLabels: Record<AttendedTypeEnum, string> = {
  REGISTERED: 'Registered',
  ATTENDED: 'Attended',
  ADDED_TO_CART: 'Added to cart',
  FOLLOW_UP: 'Follow up',
  BREAKOUT_ROOM: 'Breakout',
  CONVERTED: 'Converted',
}

function attendedLabel(t: AttendedTypeEnum): string {
  return attendedLabels[t] ?? t
}

type LeadRow = {
  id: string
  name: string
  email: string
  phone: string | null
  source: WebinarKind
  score: string | null
  tags: string[]
}

const getLeadsCached = unstable_cache(
  async (userId: string): Promise<LeadRow[]> => {
    // Indexed presenterId lookup first, then attendance by webinarId IN (...).
    const webinars = await prismaClient.webinar.findMany({
      where: { presenterId: userId },
      select: { id: true, kind: true },
    })
    if (webinars.length === 0) return []

    const kindByWebinarId = new Map(webinars.map((w) => [w.id, w.kind]))
    const webinarIds = webinars.map((w) => w.id)

    const attendances = await prismaClient.attendance.findMany({
      where: { webinarId: { in: webinarIds } },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: {
        attendedType: true,
        webinarId: true,
        user: { select: { id: true, name: true, email: true } },
      },
    })

    return attendances.map((a) => {
      const kind = kindByWebinarId.get(a.webinarId) ?? 'PROJECT'
      return {
        id: a.user.id,
        name: a.user.name,
        email: a.user.email,
        phone: null,
        source: kind,
        score: null,
        tags: [kindLabel(kind), attendedLabel(a.attendedType)],
      }
    })
  },
  ['lead-page-rows-v2'],
  { revalidate: 30 },
)

export async function LeadsTable({ userId }: { userId: string }) {
  const allLeads = await getLeadsCached(userId)

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-sm text-muted-foreground">Name</TableHead>
          <TableHead className="text-sm text-muted-foreground">Email</TableHead>
          <TableHead className="text-sm text-muted-foreground">Phone</TableHead>
          <TableHead className="text-sm text-muted-foreground">Source</TableHead>
          <TableHead className="text-sm text-muted-foreground">Score</TableHead>
          <TableHead className="text-right text-sm text-muted-foreground">Tags</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {allLeads.map((lead, idx) => (
          <TableRow key={`${lead.id}-${idx}`} className="border-0">
            <TableCell className="font-medium">{lead.name}</TableCell>
            <TableCell>{lead.email || '—'}</TableCell>
            <TableCell>{lead.phone || '—'}</TableCell>
            <TableCell>
              <LeadSourceBadge source={lead.source} />
            </TableCell>
            <TableCell>
              <LeadScoreBadge score={lead.score} />
            </TableCell>
            <TableCell className="text-right">
              {lead.tags?.map((tag: string, i: number) => (
                <Badge key={i} variant="outline" className="ml-1">
                  {tag}
                </Badge>
              ))}
            </TableCell>
          </TableRow>
        ))}
        {allLeads.length === 0 && (
          <TableRow>
            <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
              No leads yet. Leads appear here from your project/product attendees.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}

export function LeadsTableFallback() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-sm text-muted-foreground">Name</TableHead>
          <TableHead className="text-sm text-muted-foreground">Email</TableHead>
          <TableHead className="text-sm text-muted-foreground">Phone</TableHead>
          <TableHead className="text-sm text-muted-foreground">Source</TableHead>
          <TableHead className="text-sm text-muted-foreground">Score</TableHead>
          <TableHead className="text-right text-sm text-muted-foreground">Tags</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
            Loading leads…
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}
