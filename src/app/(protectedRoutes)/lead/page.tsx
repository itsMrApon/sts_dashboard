import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/ReusableComponent/PageHeader'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import PipelineIcon from '@/icons/PipelineIcon'
import { Users, Webcam } from 'lucide-react'
import { prismaClient } from '@/lib/prismaClient'
import type { AttendedTypeEnum, WebinarKind } from '@prisma/client'
import { LeadSourceBadge } from './_components/LeadSourceBadge'
import { LeadScoreBadge } from './_components/LeadScoreBadge'

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

const page = async () => {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const user = await prismaClient.user.findUnique({
    where: { clerkId: userId },
    select: { id: true },
  })
  if (!user) redirect('/sign-in')

  const webinars = await prismaClient.webinar.findMany({
    where: { presenterId: user.id },
    include: {
      attendances: {
        include: { user: true },
      },
    },
  })

  const attendees = webinars.flatMap((w) =>
    w.attendances.map((a) => ({
      id: a.user.id,
      name: a.user.name,
      email: a.user.email,
      phone: null as string | null,
      source: w.kind,
      score: null as string | null,
      scoreReason: null as string | null,
      tags: [kindLabel(w.kind), attendedLabel(a.attendedType)],
    })),
  )

  const allLeads = attendees

  return (
    <div className="w-full flex flex-col gap-8">
      <PageHeader
        leftIcon={<Webcam className="w-3 h-3" />}
        mainIcon={<Users className="w-12 h-12" />}
        rightIcon={<PipelineIcon className="w-3 h-3" />}
        heading="The home to all your customers"
        placeholder="Search customer..."
      />

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
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                No leads yet. Leads appear here from your project/product attendees.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export default page
