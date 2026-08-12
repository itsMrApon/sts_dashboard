import Link from 'next/link'
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
import { Megaphone, Users, Webcam } from 'lucide-react'
import { prismaClient } from '@/lib/prismaClient'
import type { AttendedTypeEnum, WebinarKind } from '@prisma/client'
import { LeadSourceBadge } from './_components/LeadSourceBadge'
import { LeadScoreBadge } from './_components/LeadScoreBadge'
import { isScrapeAgentConfigured } from '@/lib/leads/scrapeAgentClient'

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

type ListLead = {
  id: string
  href: string | null
  name: string
  email: string | null
  phone: string | null
  source: string
  score: string | null
  tags: string[]
  hasWebsite: boolean
  hasScrape: boolean
}

const page = async () => {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const user = await prismaClient.user.findUnique({
    where: { clerkId: userId },
    select: { id: true },
  })
  if (!user) redirect('/sign-in')

  const [webinars, hunted] = await Promise.all([
    prismaClient.webinar.findMany({
      where: { presenterId: user.id },
      include: {
        attendances: {
          include: { user: true },
        },
      },
    }),
    prismaClient.huntedLead.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        website: true,
        source: true,
        score: true,
        niche: true,
        location: true,
        websiteScrapeJson: true,
      },
    }),
  ])

  const attendees: ListLead[] = webinars.flatMap((w) =>
    w.attendances.map((a) => ({
      id: a.user.id,
      href: null,
      name: a.user.name,
      email: a.user.email,
      phone: null as string | null,
      source: w.kind,
      score: null as string | null,
      tags: [kindLabel(w.kind), attendedLabel(a.attendedType)],
      hasWebsite: false,
      hasScrape: false,
    })),
  )

  const huntedRows: ListLead[] = hunted.map((lead) => ({
    id: lead.id,
    href: `/lead/${lead.id}`,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    source: lead.source,
    score: lead.score,
    tags: [lead.niche, lead.location].filter(Boolean) as string[],
    hasWebsite: Boolean(lead.website?.trim()),
    hasScrape: lead.websiteScrapeJson != null,
  }))

  const allLeads = [...huntedRows, ...attendees]
  const scrapeReady = isScrapeAgentConfigured()

  return (
    <div className="w-full flex flex-col gap-8">
      <PageHeader
        leftIcon={<Webcam className="w-3 h-3" />}
        mainIcon={<Users className="w-12 h-12" />}
        rightIcon={<Megaphone className="w-3 h-3" />}
        heading="The home to all your customers"
        placeholder="Search customer..."
      />

      {!scrapeReady ? (
        <p className="text-muted-foreground text-xs">
          Website scrape (ScrapeGraphAI) is offline — set{' '}
          <code>SCRAPE_AGENT_URL</code> and run the Python scrape agent. Open a
          Google lead to use the scrape panel.
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">
          Open a Google lead → <strong>Website scrape</strong> tab (replaces
          Fathom-style summaries for outbound leads).
        </p>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-sm text-muted-foreground">Name</TableHead>
            <TableHead className="text-sm text-muted-foreground">Email</TableHead>
            <TableHead className="text-sm text-muted-foreground">Phone</TableHead>
            <TableHead className="text-sm text-muted-foreground">Source</TableHead>
            <TableHead className="text-sm text-muted-foreground">Score</TableHead>
            <TableHead className="text-sm text-muted-foreground">Scrape</TableHead>
            <TableHead className="text-right text-sm text-muted-foreground">
              Tags
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {allLeads.map((lead, idx) => (
            <TableRow key={`${lead.id}-${idx}`} className="border-0">
              <TableCell className="font-medium">
                {lead.href ? (
                  <Link
                    href={lead.href}
                    className="underline-offset-2 hover:underline"
                  >
                    {lead.name}
                  </Link>
                ) : (
                  lead.name
                )}
              </TableCell>
              <TableCell>{lead.email || '—'}</TableCell>
              <TableCell>{lead.phone || '—'}</TableCell>
              <TableCell>
                <LeadSourceBadge source={lead.source} />
              </TableCell>
              <TableCell>
                <LeadScoreBadge score={lead.score} />
              </TableCell>
              <TableCell>
                {lead.hasScrape ? (
                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs">
                    Scraped
                  </Badge>
                ) : lead.hasWebsite ? (
                  <Badge variant="outline" className="text-xs">
                    Ready
                  </Badge>
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
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
              <TableCell
                colSpan={7}
                className="text-center text-muted-foreground py-8"
              >
                No leads yet. Google Maps / Search hunted leads and project
                attendees appear here.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export default page
