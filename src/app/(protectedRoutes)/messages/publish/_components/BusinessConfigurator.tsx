'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Rocket, Save, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { draftBusinessSection, publishBusinessSite, saveBusinessSite } from '@/actions/businessSite'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { BusinessSiteContent, SiteSection } from '@/lib/business/siteContent'
import { AdvancedSection, FooterSection, KeyDatesSection, SeoSection, ServicesSection, SocialSection } from './sections'
import { SectionPreview } from './previews'

type Status = 'DRAFT' | 'PUBLISHED' | 'STALE'

const SECTIONS: { id: SiteSection; label: string; hint: string; ai: boolean }[] = [
  { id: 'seo', label: 'Page SEO', hint: 'Title, description and share image for every page', ai: true },
  { id: 'footer', label: 'Footer', hint: 'Email, tagline, copyright and legal links', ai: true },
  { id: 'social', label: 'Social', hint: 'Handles, links, images and video — plus the footer “Follow on”', ai: false },
  { id: 'services', label: 'Services & Forms', hint: 'Your services and the documents for each (/calendar)', ai: true },
  { id: 'keyDates', label: 'Key Dates', hint: 'Calendar of dates, perks, gifts and government fees (/calendar)', ai: true },
  { id: 'advanced', label: 'Advanced', hint: 'Industry, website, terms, products, import and JSON snapshot', ai: false },
]

const STATUS_LABEL: Record<Status, string> = { DRAFT: 'Draft', PUBLISHED: 'Live', STALE: 'Needs publish' }

export type SectionProps = {
  content: BusinessSiteContent
  businessName: string
  onChange: (next: BusinessSiteContent) => void
}

export function BusinessConfigurator({
  businessName,
  initialContent,
  initialStatus,
  publishedAt,
  projects,
  linkedProjectIds,
}: {
  businessName: string
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
  const [section, setSection] = useState<SiteSection>('seo')
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

  return (
    <div className="flex flex-col gap-5">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <Badge variant={status === 'PUBLISHED' ? 'default' : 'secondary'}>{STATUS_LABEL[status]}</Badge>
          {publishedAt && status !== 'DRAFT' ? (
            <span className="text-xs text-muted-foreground">Last published {new Date(publishedAt).toLocaleDateString()}</span>
          ) : null}
          {dirty ? <span className="text-xs text-amber-500">Unsaved changes</span> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => save(false)} disabled={!dirty || isSaving}>
            {isSaving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
            Save
          </Button>
          <Button size="sm" onClick={() => (dirty ? save(true) : publish())} disabled={isSaving || isPublishing || (!dirty && status === 'PUBLISHED')}>
            {isPublishing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Rocket className="mr-1.5 h-4 w-4" />}
            {dirty ? 'Save & publish' : 'Publish'}
          </Button>
        </div>
      </div>

      {/* Section tabs */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {SECTIONS.map((item) => {
          const count = counts[item.id as keyof typeof counts]
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id)}
              className={cn(
                'shrink-0 rounded-lg border px-3 py-1.5 text-sm transition-colors',
                section === item.id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted/60',
              )}
            >
              {item.label}
              {count ? <span className="ml-1.5 text-xs opacity-70">{count}</span> : null}
            </button>
          )
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">{active.label}</h2>
              <p className="text-xs text-muted-foreground">{active.hint}</p>
            </div>
            {active.ai ? (
              <Button variant="outline" size="sm" onClick={aiFill} disabled={isDrafting}>
                {isDrafting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
                Fill with AI
              </Button>
            ) : null}
          </div>

          {section === 'seo' ? <SeoSection {...sectionProps} /> : null}
          {section === 'footer' ? <FooterSection {...sectionProps} /> : null}
          {section === 'social' ? <SocialSection {...sectionProps} /> : null}
          {section === 'services' ? <ServicesSection {...sectionProps} /> : null}
          {section === 'keyDates' ? <KeyDatesSection {...sectionProps} /> : null}
          {section === 'advanced' ? (
            <AdvancedSection {...sectionProps} projects={projects} linkedProjectIds={linkedProjectIds} />
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <SectionPreview section={section} content={content} businessName={businessName} />
        </aside>
      </div>
    </div>
  )
}
