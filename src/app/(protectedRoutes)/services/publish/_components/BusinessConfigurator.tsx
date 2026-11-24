'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Briefcase,
  CalendarDays,
  FileCheck2,
  Globe,
  Link2,
  Loader2,
  PanelBottom,
  PhoneCall,
  Radio,
  Rocket,
  Share2,
  ShoppingBag,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { toast } from '@/lib/toast'
import { draftBusinessSection, fillFromWebsite, publishBusinessSite, saveBusinessSite } from '@/actions/businessSite'
import { PublicServiceShell } from '@/app/(publicRoutes)/_components/PublicServiceShell'
import { BusinessSite } from '@/app/(publicRoutes)/business/[roomName]/_components/BusinessSite'
import { useWebsiteGate } from '@/components/services/connection/WebsiteConnection'
import { ServiceStudio } from '@/components/services/studio/ServiceStudio'
import { StudioSection, type StudioAccent } from '@/components/services/studio/StudioPrimitives'
import { Button } from '@/components/ui/button'
import type { BusinessSiteContent, SiteSection } from '@/lib/business/siteContent'
import type { GuideService } from '@/lib/services/snippets'
import { BusinessProductsCard } from '../../_components/BusinessProductsCard'
import { SakugaTabs } from '@/components/sakuga/SakugaTabs'
import { DocsSection, FooterSection, KeyDatesSection, LiveSection, ServicesSection, SocialSection } from './sections'
import type { BusinessOffer, LiveSession } from '@/lib/business/businessOffers'
import type { PublicServiceLinks } from '@/lib/public/publicService'
import { guardAction } from '@/lib/clientActionErrors'

type Status = 'DRAFT' | 'PUBLISHED' | 'STALE'

const SECTIONS: { id: SiteSection; label: string; ai: boolean; icon: LucideIcon; accent: StudioAccent }[] = [
  { id: 'footer', label: 'Contact', ai: true, icon: PanelBottom, accent: 'sky' },
  { id: 'social', label: 'Links', ai: false, icon: Share2, accent: 'emerald' },
  { id: 'services', label: 'Menu', ai: true, icon: Briefcase, accent: 'amber' },
  { id: 'docs', label: 'Docs', ai: false, icon: FileCheck2, accent: 'emerald' },
  { id: 'live', label: 'Live', ai: false, icon: Radio, accent: 'rose' },
  { id: 'keyDates', label: 'Deadlines & promos', ai: true, icon: CalendarDays, accent: 'sky' },
]

/**
 * Each website service is its own page over the same site content (one Save & publish): the page
 * picks which tabs it shows, its name and its code guide.
 */
export type SiteEditorId = 'menu' | 'docs' | 'links' | 'live' | 'contact'

const EDITORS: Record<SiteEditorId, { name: string; icon: LucideIcon; sections: SiteSection[]; guide: GuideService }> = {
  menu: { name: 'Menu', icon: ShoppingBag, sections: ['services', 'keyDates'], guide: 'menu' },
  docs: { name: 'Docs', icon: FileCheck2, sections: ['docs'], guide: 'docs' },
  links: { name: 'Links', icon: Link2, sections: ['social'], guide: 'links' },
  live: { name: 'Live', icon: Radio, sections: ['live'], guide: 'live' },
  contact: { name: 'Contact', icon: PhoneCall, sections: ['footer'], guide: 'contact' },
}

/** Tabs the website reader can fill (scrape agent + Serper). */
const WEBSITE_FILL_SECTIONS: SiteSection[] = ['footer', 'social']

const STATUS_LABEL: Record<Status, string> = { DRAFT: 'Draft', PUBLISHED: 'Published', STALE: 'Needs publish' }

export type SectionProps = {
  content: BusinessSiteContent
  businessName: string
  onChange: (next: BusinessSiteContent) => void
}

export function BusinessConfigurator({
  businessName,
  description,
  publicHref,
  links,
  offers,
  initialContent,
  initialStatus,
  publishedAt,
  projects,
  linkedProjectIds,
  liveSessions = [],
  editor,
}: {
  businessName: string
  description: string | null
  /** The hosted business site (/business/<room>). */
  publicHref: string
  /** Live view: the hero buttons and offers, as visitors see them. */
  links: PublicServiceLinks
  offers: BusinessOffer[]
  initialContent: BusinessSiteContent
  initialStatus: Status
  publishedAt: string | null
  /** Products and projects from Projects, and which of them are on the Menu. */
  projects: { id: string; title: string; kind: 'PROJECT' | 'PRODUCT' }[]
  linkedProjectIds: string[]
  /** Upcoming webinars from Projects (the Live page lists them with show/hide switches). */
  liveSessions?: LiveSession[]
  /** Which website service this page edits. */
  editor: SiteEditorId
}) {
  const config = EDITORS[editor]
  const tabs = SECTIONS.filter((item) => config.sections.includes(item.id))
  const router = useRouter()
  const requireWebsite = useWebsiteGate()
  const [content, setContent] = useState(initialContent)
  const [saved, setSaved] = useState(() => JSON.stringify(initialContent))
  const [status, setStatus] = useState<Status>(initialStatus)
  const [section, setSection] = useState<SiteSection>(config.sections[0])
  const [isSaving, startSaving] = useTransition()
  const [isPublishing, startPublishing] = useTransition()
  const [isDrafting, startDrafting] = useTransition()
  const [isReading, startReading] = useTransition()

  const dirty = JSON.stringify(content) !== saved
  const active = tabs.find((item) => item.id === section) ?? tabs[0]
  const counts = useMemo(
    () => ({
      social: content.social.accounts.length,
      services: content.services.length,
      docs: content.docs.length,
      keyDates: content.keyDates.length,
    }),
    [content],
  )

  const save = (thenPublish = false) =>
    startSaving(guardAction(async () => {
      const result = await saveBusinessSite(content)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setContent(result.content)
      setSaved(JSON.stringify(result.content))
      setStatus(result.status)
      if (thenPublish) publish()
      else toast.success("Saved! Publish whenever you're ready.")
    }))

  const publish = () =>
    startPublishing(guardAction(async () => {
      const result = await publishBusinessSite()
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setStatus('PUBLISHED')
      toast.success("You're live! Your website and AI are using it now.")
      router.refresh()
    }))

  const aiFill = () =>
    startDrafting(guardAction(async () => {
      const result = await draftBusinessSection(section, content)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setContent((current) => ({ ...current, ...result.patch }))
      toast.success(`Here's a draft for ${active.label}. Look it over, then save.`)
    }))

  // Fills only empty fields and new accounts; the creator reviews, then saves.
  const readWebsite = () =>
    startReading(guardAction(async () => {
      const result = await fillFromWebsite(content)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setContent((current) => ({ ...current, ...result.patch }))
      if (result.added.length === 0) {
        toast.info(`Nothing new found on ${result.source}`)
        return
      }
      const searched = result.fromSearch.length ? ` (${result.fromSearch.join(', ')} found by Google search: please check)` : ''
      toast.success(`Added ${result.added.join(', ')}${searched}. Review, then Save`)
    }))

  const sectionProps: SectionProps = { content, businessName, onChange: setContent }

  // One tab needs no tab strip.
  const sectionTabs =
    tabs.length < 2 ? undefined : (
      <SakugaTabs
        label={`${config.name} sections`}
        value={section}
        onChange={(next) => setSection(next as SiteSection)}
        options={tabs.map((item) => {
          const count = counts[item.id as keyof typeof counts]
          return { value: item.id, label: count ? `${item.label} ${count}` : item.label }
        })}
      />
    )

  return (
    <ServiceStudio
      name={config.name}
      icon={config.icon}
      status={{ live: status === 'PUBLISHED', label: STATUS_LABEL[status] }}
      dirty={dirty}
      saving={isSaving}
      onSave={() => save(false)}
      extraActions={
        <Button
          size="sm"
          className="h-8"
          // The first publish needs the website connection; later ones don't.
          onClick={() => {
            const run = () => (dirty ? save(true) : publish())
            if (publishedAt) run()
            else requireWebsite(run)
          }}
          disabled={isSaving || isPublishing || (!dirty && status === 'PUBLISHED')}
        >
          {isPublishing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Rocket className="mr-1.5 h-3.5 w-3.5" />}
          {dirty ? 'Save & publish' : 'Publish'}
        </Button>
      }
      settingsHeader={sectionTabs}
      live={{
        href: publicHref,
        content: (
          <PublicServiceShell businessName={businessName} service="business" links={links} embedded wide>
            <BusinessSite businessName={businessName} description={description} content={content} offers={offers} links={links} />
          </PublicServiceShell>
        ),
      }}
      guide={{
        service: config.guide,
        notice: status === 'PUBLISHED' ? null : 'Not published yet. Publish so your page, the SDK and your AI use this content.',
      }}
    >
      <StudioSection
        key={active.id}
        id={active.id}
        icon={active.icon}
        accent={active.accent}
        title={active.label}
        action={
          active.ai || WEBSITE_FILL_SECTIONS.includes(active.id) ? (
            <div className="flex flex-wrap items-center gap-2">
              {WEBSITE_FILL_SECTIONS.includes(active.id) ? (
                <Button variant="outline" size="sm" onClick={readWebsite} disabled={isReading}>
                  {isReading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Globe className="mr-1.5 h-4 w-4" />}
                  {isReading ? 'Reading your website…' : 'Grab from my website'}
                </Button>
              ) : null}
              {active.ai ? (
                <Button variant="outline" size="sm" onClick={aiFill} disabled={isDrafting}>
                  {isDrafting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
                  Let AI fill it
                </Button>
              ) : null}
            </div>
          ) : null
        }
      >
        {section === 'footer' ? <FooterSection {...sectionProps} /> : null}
        {section === 'social' ? <SocialSection {...sectionProps} /> : null}
        {section === 'services' ? (
          <>
            <BusinessProductsCard projects={projects} linkedIds={linkedProjectIds} />
            <ServicesSection {...sectionProps} />
          </>
        ) : null}
        {section === 'docs' ? (
          <>
            <DocsSection {...sectionProps} />
            <p className="text-xs text-muted-foreground">
              Customers can print these as a checklist or save it as a PDF:{' '}
              <a href={`${publicHref}/documents`} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline">
                open the printable page
              </a>
              . It shows what is published.
            </p>
          </>
        ) : null}
        {section === 'live' ? <LiveSection {...sectionProps} sessions={liveSessions} /> : null}
        {section === 'keyDates' ? <KeyDatesSection {...sectionProps} /> : null}
      </StudioSection>
    </ServiceStudio>
  )
}
