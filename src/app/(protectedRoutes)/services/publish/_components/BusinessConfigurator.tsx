'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Briefcase,
  CalendarDays,
  Loader2,
  Palette,
  PanelBottom,
  Rocket,
  Search,
  Settings2,
  Share2,
  Sparkles,
  Store,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { draftBusinessSection, publishBusinessSite, saveBusinessSite } from '@/actions/businessSite'
import { PublicServiceShell } from '@/app/(publicRoutes)/_components/PublicServiceShell'
import { BusinessSite } from '@/app/(publicRoutes)/business/[roomName]/_components/BusinessSite'
import { useWebsiteGate } from '@/components/services/connection/WebsiteConnection'
import { ServiceStudio } from '@/components/services/studio/ServiceStudio'
import { StudioSection, type StudioAccent } from '@/components/services/studio/StudioPrimitives'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { BusinessSiteContent, SiteSection } from '@/lib/business/siteContent'
import { AdvancedSection, FooterSection, KeyDatesSection, SeoSection, ServicesSection, SocialSection } from './sections'
import { LookSection } from './LookSection'
import type { BusinessOffer } from '@/lib/business/businessOffers'
import type { PublicServiceLinks } from '@/lib/public/publicService'
import { guardAction } from '@/lib/clientActionErrors'

type Status = 'DRAFT' | 'PUBLISHED' | 'STALE'

const SECTIONS: { id: SiteSection; label: string; ai: boolean; icon: LucideIcon; accent: StudioAccent }[] = [
  { id: 'look', label: 'Look', ai: false, icon: Palette, accent: 'rose' },
  { id: 'seo', label: 'Page SEO', ai: true, icon: Search, accent: 'violet' },
  { id: 'footer', label: 'Footer', ai: true, icon: PanelBottom, accent: 'sky' },
  { id: 'social', label: 'Social', ai: false, icon: Share2, accent: 'emerald' },
  { id: 'services', label: 'Services & Forms', ai: true, icon: Briefcase, accent: 'amber' },
  { id: 'keyDates', label: 'Key Dates', ai: true, icon: CalendarDays, accent: 'sky' },
  { id: 'advanced', label: 'Advanced', ai: false, icon: Settings2, accent: 'violet' },
]

const STATUS_LABEL: Record<Status, string> = { DRAFT: 'Draft', PUBLISHED: 'Live', STALE: 'Needs publish' }

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
  projects: { id: string; title: string; kind: 'PROJECT' | 'PRODUCT' }[]
  linkedProjectIds: string[]
}) {
  const router = useRouter()
  const requireWebsite = useWebsiteGate()
  const [content, setContent] = useState(initialContent)
  const [saved, setSaved] = useState(() => JSON.stringify(initialContent))
  const [status, setStatus] = useState<Status>(initialStatus)
  const [section, setSection] = useState<SiteSection>('look')
  const [isSaving, startSaving] = useTransition()
  const [isPublishing, startPublishing] = useTransition()
  const [isDrafting, startDrafting] = useTransition()

  const dirty = JSON.stringify(content) !== saved
  const active = SECTIONS.find((item) => item.id === section) ?? SECTIONS[0]
  const counts = useMemo(
    () => ({
      social: content.social.accounts.length,
      services: content.services.length,
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
      else toast.success('Saved. Publish when you are ready')
    }))

  const publish = () =>
    startPublishing(guardAction(async () => {
      const result = await publishBusinessSite()
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setStatus('PUBLISHED')
      toast.success('Live — your website, SDK and AI now use this content')
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
      toast.success(`${active.label} drafted — review it, then Save`)
    }))

  const sectionProps: SectionProps = { content, businessName, onChange: setContent }

  const sectionTabs = (
    <div role="tablist" aria-label="Business sections" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-hide">
      {SECTIONS.map((item) => {
        const count = counts[item.id as keyof typeof counts]
        const selected = section === item.id
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => setSection(item.id)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
              selected ? 'border-border bg-card text-foreground shadow-sm' : 'border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}
          >
            <item.icon className="h-3.5 w-3.5" aria-hidden />
            {item.label}
            {count ? <span className="font-mono text-[10px] opacity-70">{count}</span> : null}
          </button>
        )
      })}
    </div>
  )

  return (
    <ServiceStudio
      name="Business"
      icon={Store}
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
        service: 'business',
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
          active.ai ? (
            <Button variant="outline" size="sm" onClick={aiFill} disabled={isDrafting}>
              {isDrafting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
              Fill with AI
            </Button>
          ) : null
        }
      >
        {section === 'look' ? <LookSection {...sectionProps} /> : null}
        {section === 'seo' ? <SeoSection {...sectionProps} /> : null}
        {section === 'footer' ? <FooterSection {...sectionProps} /> : null}
        {section === 'social' ? <SocialSection {...sectionProps} /> : null}
        {section === 'services' ? <ServicesSection {...sectionProps} /> : null}
        {section === 'keyDates' ? <KeyDatesSection {...sectionProps} /> : null}
        {section === 'advanced' ? (
          <AdvancedSection {...sectionProps} projects={projects} linkedProjectIds={linkedProjectIds} />
        ) : null}
      </StudioSection>
    </ServiceStudio>
  )
}
