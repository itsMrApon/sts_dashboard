'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LeadSourceBadge } from './LeadSourceBadge'
import { LeadScoreBadge } from './LeadScoreBadge'
import { refreshLeadWebsiteScrape } from '@/actions/leads'
import type { LeadWebsiteScrape } from '@/lib/leads/scrapeAgentClient'

export type HuntedLeadProfileView = {
  id: string
  name: string
  email: string | null
  phone: string | null
  website: string | null
  address: string | null
  businessName: string | null
  source: string
  score: string
  scoreReason: string | null
  niche: string | null
  location: string | null
  websiteScrape: unknown
  createdAt: string
  scrapeAgentReady: boolean
}

function asScrape(value: unknown): LeadWebsiteScrape | null {
  if (!value || typeof value !== 'object') return null
  return value as LeadWebsiteScrape
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null
  return (
    <div>
      <p className="mb-1 text-xs font-medium">{title}</p>
      <ul className="list-disc space-y-1 pl-4 text-sm">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

export function HuntedLeadProfile({ lead }: { lead: HuntedLeadProfileView }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const scrape = asScrape(lead.websiteScrape)

  function runScrape() {
    startTransition(async () => {
      try {
        const res = await refreshLeadWebsiteScrape(lead.id)
        if (res.ok) {
          toast.success('Website scrape updated')
          router.refresh()
        } else {
          toast.error(res.error || 'Scrape failed')
        }
      } catch {
        toast.error('Connection lost. Is the scrape agent running?')
      }
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="h-8 px-2">
          <Link href="/lead">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to list
          </Link>
        </Button>
        <LeadSourceBadge source={lead.source} />
        <LeadScoreBadge score={lead.score} />
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{lead.name}</h1>
        <p className="text-muted-foreground text-sm">
          {[lead.businessName, lead.location, lead.niche]
            .filter(Boolean)
            .join(' · ') || 'Google lead'}
        </p>
      </div>

      <Tabs defaultValue="scrape" className="flex min-h-0 flex-1 flex-col gap-3">
        <TabsList className="bg-muted h-auto w-max min-w-full flex-wrap justify-start p-1">
          <TabsTrigger value="scrape">Website scrape</TabsTrigger>
          <TabsTrigger value="details">Lead details</TabsTrigger>
        </TabsList>

        {/* Replaces Fathom summary: ScrapeGraphAI website enrichment */}
        <TabsContent
          value="scrape"
          className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
        >
          <Card className="h-full min-h-0 gap-0 overflow-hidden py-0 shadow-none">
            <CardHeader className="shrink-0 flex-row items-center justify-between gap-2 py-4">
              <CardTitle className="text-base">
                Website scrape (ScrapeGraphAI)
              </CardTitle>
              <Button
                size="sm"
                variant="secondary"
                disabled={pending || !lead.website}
                onClick={runScrape}
              >
                {pending ? 'Scraping…' : 'Refresh scrape'}
              </Button>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-4 text-sm">
              {!lead.website ? (
                <p className="text-muted-foreground text-sm">
                  No website on this lead. ScrapeGraphAI needs a URL from Google
                  Maps / Search.
                </p>
              ) : !lead.scrapeAgentReady ? (
                <div className="space-y-2">
                  <p className="text-sm">
                    Scrape agent is not configured for this app.
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Set <code>SCRAPE_AGENT_URL=http://127.0.0.1:8100</code> and
                    run{' '}
                    <code>
                      cd agents/python/scrape-agent && uv run python -m
                      agent.main
                    </code>
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Website on file:{' '}
                    <a
                      href={
                        lead.website.startsWith('http')
                          ? lead.website
                          : `https://${lead.website}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-2"
                    >
                      {lead.website}
                    </a>
                  </p>
                </div>
              ) : !scrape ? (
                <div className="space-y-2">
                  <p className="text-muted-foreground text-sm">
                    No website scrape yet. Click <strong>Refresh scrape</strong>{' '}
                    to pull company summary, services, and contacts via
                    ScrapeGraphAI.
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Target:{' '}
                    <a
                      href={
                        lead.website.startsWith('http')
                          ? lead.website
                          : `https://${lead.website}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-2"
                    >
                      {lead.website}
                    </a>
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-muted-foreground text-xs">
                    Via ScrapeGraphAI
                    {scrape.scrapedAt
                      ? ` · ${new Date(scrape.scrapedAt).toLocaleString()}`
                      : ''}
                  </p>
                  {scrape.error ? (
                    <p className="text-destructive text-xs">{scrape.error}</p>
                  ) : null}
                  {scrape.companySummary ? (
                    <div>
                      <p className="mb-1 text-xs font-medium">Summary</p>
                      <p>{scrape.companySummary}</p>
                    </div>
                  ) : null}
                  <ListBlock title="Services" items={scrape.services || []} />
                  <ListBlock
                    title="Highlights"
                    items={scrape.highlights || []}
                  />
                  <ListBlock title="Flags" items={scrape.flags || []} />
                  {(scrape.contactEmails?.length ||
                    scrape.contactPhones?.length) ? (
                    <div>
                      <p className="mb-1 text-xs font-medium">Contacts found</p>
                      <ul className="text-muted-foreground list-disc space-y-0.5 pl-4 text-xs">
                        {(scrape.contactEmails || []).map((email) => (
                          <li key={email}>{email}</li>
                        ))}
                        {(scrape.contactPhones || []).map((phone) => (
                          <li key={phone}>{phone}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {(scrape.socialLinks?.length ?? 0) > 0 ? (
                    <div>
                      <p className="mb-1 text-xs font-medium">Social</p>
                      <ul className="list-disc space-y-1 pl-4 text-xs">
                        {(scrape.socialLinks || []).map((link) => (
                          <li key={link}>
                            <a
                              href={link}
                              target="_blank"
                              rel="noreferrer"
                              className="underline underline-offset-2"
                            >
                              {link}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <a
                    href={scrape.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs underline underline-offset-2"
                  >
                    {scrape.url.replace(/^https?:\/\//, '')}
                  </a>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="details"
          className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
        >
          <Card className="h-full shadow-none">
            <CardHeader className="py-4">
              <CardTitle className="text-base">Lead details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Email: </span>
                {lead.email || '—'}
              </p>
              <p>
                <span className="text-muted-foreground">Phone: </span>
                {lead.phone || '—'}
              </p>
              <p>
                <span className="text-muted-foreground">Website: </span>
                {lead.website || '—'}
              </p>
              <p>
                <span className="text-muted-foreground">Address: </span>
                {lead.address || '—'}
              </p>
              {lead.scoreReason ? (
                <p>
                  <span className="text-muted-foreground">Score reason: </span>
                  {lead.scoreReason}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
