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
import { ServiceStudio } from '@/components/services/studio/ServiceStudio'
import { StudioSection, type StudioAccent, type SummaryLine } from '@/components/services/studio/StudioPrimitives'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { SITE_ACTIONS, SITE_BLOCKS, type BusinessSiteContent, type SiteSection } from '@/lib/business/siteContent'
import { ACCENTS } from '@/lib/services/types'
import { AdvancedSection, FooterSection, KeyDatesSection, SeoSection, ServicesSection, SocialSection } from './sections'
import { LookSection } from './LookSection'
import { SectionPreview } from './previews'

type Status = 'DRAFT' | 'PUBLISHED' | 'STALE'

const SECTIONS: { id: SiteSection; label: string; hint: string; ai: boolean; icon: LucideIcon; accent: StudioAccent }[] = [
  { id: 'look', label: 'Look', hint: 'Colour, hero layout, hero buttons and which blocks your page shows', ai: false, icon: Palette, accent: 'rose' },
  { id: 'seo', label: 'Page SEO', hint: 'Title, description and share image for every page', ai: true, icon: Search, accent: 'violet' },
  { id: 'footer', label: 'Footer', hint: 'Email, tagline, copyright and legal links', ai: true, icon: PanelBottom, accent: 'sky' },
  { id: 'social', label: 'Social', hint: 'Handles, links, images and video, plus the footer “Follow on”', ai: false, icon: Share2, accent: 'emerald' },
  { id: 'services', label: 'Services & Forms', hint: 'Your services and the documents for each (/calendar)', ai: true, icon: Briefcase, accent: 'amber' },
  { id: 'keyDates', label: 'Key Dates', hint: 'Calendar of dates, perks, gifts and government fees (/calendar)', ai: true, icon: CalendarDays, accent: 'sky' },
  { id: 'advanced', label: 'Advanced', hint: 'Industry, website, terms, products, import and JSON snapshot', ai: false, icon: Settings2, accent: 'violet' },
]

const BUSINESS_SNIPPET = `import { useStsBusiness } from '@sts-ai/sdk/react'

// Everything you publish on the Business page: SEO, services,
// key dates, socials, footer and your look settings.
export function Services() {
  const { business } = useStsBusiness()
  const site = business?.site // null until you publish
  if (!site) return null

  return (
    <section style={{ ['--accent' as string]: site.appearance.accent }}>
      <h2>{site.seo.title}</h2>
      {site.services.map((s) => (
        <article key={s.id}>
          <h3>{s.name}</h3>
          <p>{s.summary}</p>
          {s.price && <strong>{s.price}</strong>}
        </article>
      ))}
    </section>
  )
}`

const STATUS_LABEL: Record<Status, string> = { DRAFT: 'Draft', PUBLISHED: 'Live', STALE: 'Needs publish' }

export type SectionProps = {
  content: BusinessSiteContent
  businessName: string
  onChange: (next: BusinessSiteContent) => void
}

export function BusinessConfigurator({
  businessName,
  roomName,
  publicHref,
  initialContent,
  initialStatus,
  publishedAt,
  projects,
  linkedProjectIds,
}: {
  businessName: string
  roomName: string
  /** The hosted business site (/business/<room>). */
  publicHref: string
  initialContent: BusinessSiteContent
  initialStatus: Status
  publishedAt: string | null
  projects: { id: string; title: string; kind: 'PROJECT' | 'PRODUCT' }[]
  linkedProjectIds: string[]
}) {
  const router = useRouter()
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
    startSaving(async () => {
      const result = await saveBusinessSite(content)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setContent(result.content)
      setSaved(JSON.stringify(result.content))
      setStatus(result.status)
      if (thenPublish) publish()
      else toast.success('Saved — publish when you are ready')
    })

  const publish = () =>
    startPublishing(async () => {
      const result = await publishBusinessSite()
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setStatus('PUBLISHED')
      toast.success('Live — your website, SDK and AI now use this content')
      router.refresh()
    })

  const aiFill = () =>
    startDrafting(async () => {
      const result = await draftBusinessSection(section, content)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setContent((current) => ({ ...current, ...result.patch }))
      toast.success(`${active.label} drafted — review it, then Save`)
    })

  const sectionProps: SectionProps = { content, businessName, onChange: setContent }

  const summaries: Partial<Record<SiteSection, SummaryLine[]>> = {
    look: [
      { label: 'accent', value: ACCENTS.find((item) => item.id === content.appearance.accent)?.label ?? '' },
      { label: 'hero', value: content.appearance.heroAlign === 'left' ? 'left-aligned' : 'centred' },
      { label: 'buttons', value: SITE_ACTIONS.filter((item) => content.appearance.actions[item.id]).length + ' of 4' },
      { label: 'blocks', value: SITE_BLOCKS.filter((item) => content.appearance.show[item.id]).map((item) => item.label).join(', ') },
    ],
    seo: [
      { label: 'title', value: `${content.seo.title.length}/70` },
      { label: 'description', value: `${content.seo.description.length}/160` },
      { label: 'share image', value: content.seo.ogImage ? 'set' : 'none' },
    ],
    social: [
      { label: 'accounts', value: String(counts.social) },
      { label: 'media', value: String(content.social.media.length) },
    ],
    services: [
      { label: 'services', value: String(counts.services) },
      { label: 'active', value: String(content.services.filter((item) => item.active).length) },
    ],
    keyDates: [{ label: 'dates', value: String(counts.keyDates) }],
    footer: [
      { label: 'email', value: content.footer.email || 'none' },
      { label: 'tagline', value: content.footer.tagline || 'none' },
    ],
    advanced: [
      { label: 'industry', value: content.advanced.vertical.replace(/_/g, ' ') || 'not set' },
      { label: 'website', value: content.advanced.websiteUrl || 'none' },
    ],
  }

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
      tagline={
        publishedAt && status !== 'DRAFT'
          ? `Your public page, SDK and AI. Last published ${new Date(publishedAt).toLocaleDateString()}.`
          : 'Your public page, SDK and AI all read what you publish here.'
      }
      status={{ live: status === 'PUBLISHED', label: STATUS_LABEL[status] }}
      publicHref={publicHref}
      publicLabel={status === 'PUBLISHED' ? 'Open site' : 'Preview site'}
      dirty={dirty}
      saving={isSaving}
      onSave={() => save(false)}
      extraActions={
        <Button
          size="sm"
          className="h-8"
          onClick={() => (dirty ? save(true) : publish())}
          disabled={isSaving || isPublishing || (!dirty && status === 'PUBLISHED')}
        >
          {isPublishing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Rocket className="mr-1.5 h-3.5 w-3.5" />}
          {dirty ? 'Save & publish' : 'Publish'}
        </Button>
      }
      settingsHeader={sectionTabs}
      preview={<SectionPreview section={section} content={content} businessName={businessName} />}
      previewTitle={`business · ${active.label.toLowerCase()}`}
      integrate={{
        serviceName: 'Business',
        roomName,
        snippet: BUSINESS_SNIPPET,
        snippetFile: 'components/Services.tsx',
        hostedHref: publicHref,
        offNotice: status === 'PUBLISHED' ? null : 'Not published yet. Publish so your page, the SDK and your AI use this content.',
      }}
    >
      <StudioSection
        key={active.id}
        id={active.id}
        icon={active.icon}
        accent={active.accent}
        title={active.label}
        description={active.hint}
        summary={summaries[active.id]}
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
