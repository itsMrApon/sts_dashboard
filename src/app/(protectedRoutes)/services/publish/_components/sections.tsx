'use client'

import { useRef, useState, useTransition } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Copy, Download, FileUp, Loader2, Plus, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { importServicesFile } from '@/actions/businessSite'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  SITE_LIMITS,
  SOCIAL_PLATFORMS,
  VERTICALS,
  defaultCopyright,
  newId,
  sanitizeSiteContent,
  socialUrl,
  type BusinessSiteContent,
  type KeyDate,
  type ServiceDoc,
  type SiteService,
} from '@/lib/business/siteContent'
import { BusinessProductsCard } from '../../_components/BusinessProductsCard'
import type { SectionProps } from './BusinessConfigurator'
import { guardAction } from '@/lib/clientActionErrors'

// Sits inside the Business page's section card, so it's a lighter inner panel.
const CARD = 'space-y-4 rounded-xl border border-border/70 bg-muted/20 p-4'
const SELECT = 'h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm'

function Counter({ value, max }: { value: string; max: number }) {
  const near = value.length > max * 0.9
  return <span className={near ? 'text-amber-500' : 'text-muted-foreground'}>{value.length}/{max}</span>
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <Label>{label}</Label>
        {hint}
      </div>
      {children}
    </div>
  )
}

function move<T>(list: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction
  if (target < 0 || target >= list.length) return list
  const next = [...list]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

// ── 1. SEO ──────────────────────────────────────────────────────────────────

export function SeoSection({ content, onChange }: SectionProps) {
  const seo = content.seo
  const set = (patch: Partial<typeof seo>) => onChange({ ...content, seo: { ...seo, ...patch } })
  return (
    <section className={CARD}>
      <Field label="Meta title" hint={<Counter value={seo.title} max={SITE_LIMITS.seoTitle} />}>
        <Input value={seo.title} maxLength={SITE_LIMITS.seoTitle} onChange={(e) => set({ title: e.target.value })} />
      </Field>
      <Field label="Meta description" hint={<Counter value={seo.description} max={SITE_LIMITS.seoDescription} />}>
        <Textarea
          rows={3}
          value={seo.description}
          maxLength={SITE_LIMITS.seoDescription}
          onChange={(e) => set({ description: e.target.value })}
          placeholder="What you do, for whom, and where — in one sentence."
        />
      </Field>
      <Field label="Share image (OG) URL" hint={<span className="text-muted-foreground">1200 × 630 recommended</span>}>
        <Input value={seo.ogImage} onChange={(e) => set({ ogImage: e.target.value })} placeholder="https://…/og-image.png" />
      </Field>
      <p className="text-xs text-muted-foreground">Applies to all pages unless a page sets its own.</p>
    </section>
  )
}

// ── 2. Footer ───────────────────────────────────────────────────────────────

export function FooterSection({ content, businessName, onChange }: SectionProps) {
  const footer = content.footer
  const set = (patch: Partial<typeof footer>) => onChange({ ...content, footer: { ...footer, ...patch } })
  return (
    <section className={CARD}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business email">
          <Input type="email" value={footer.email} onChange={(e) => set({ email: e.target.value })} placeholder="hello@business.com" />
        </Field>
        <Field label="Tagline">
          <Input value={footer.tagline} maxLength={200} onChange={(e) => set({ tagline: e.target.value })} />
        </Field>
      </div>
      <Field
        label="Copyright"
        hint={
          <button type="button" className="text-primary hover:underline" onClick={() => set({ copyright: defaultCopyright(businessName) })}>
            Use {new Date().getFullYear()}
          </button>
        }
      >
        <Input value={footer.copyright} maxLength={200} onChange={(e) => set({ copyright: e.target.value })} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Privacy policy link">
          <Input value={footer.privacyUrl} onChange={(e) => set({ privacyUrl: e.target.value })} placeholder="/privacy or https://…" />
        </Field>
        <Field label="Terms link">
          <Input value={footer.termsUrl} onChange={(e) => set({ termsUrl: e.target.value })} placeholder="/terms or https://…" />
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">The footer&apos;s “Follow on” row comes from the Social section.</p>
    </section>
  )
}

// ── 3. Social ───────────────────────────────────────────────────────────────

export function SocialSection({ content, onChange }: SectionProps) {
  const social = content.social
  const set = (patch: Partial<typeof social>) => onChange({ ...content, social: { ...social, ...patch } })
  return (
    <>
      <section className={CARD}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Field label="Footer label">
            <Input className="max-w-[200px]" value={social.followLabel} maxLength={40} onChange={(e) => set({ followLabel: e.target.value })} />
          </Field>
          <Button
            variant="outline"
            size="sm"
            disabled={social.accounts.length >= SITE_LIMITS.accounts}
            onClick={() => set({ accounts: [...social.accounts, { id: newId(), platform: 'facebook', handle: '', url: '' }] })}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add account
          </Button>
        </div>
        {social.accounts.length === 0 ? <p className="text-sm text-muted-foreground">No accounts yet.</p> : null}
        <ul className="space-y-2">
          {social.accounts.map((account, index) => (
            <li key={account.id} className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[140px_minmax(0,1fr)_minmax(0,1.4fr)_auto]">
              <select
                className={SELECT}
                value={account.platform}
                aria-label="Platform"
                onChange={(e) => {
                  const accounts = [...social.accounts]
                  accounts[index] = { ...account, platform: e.target.value, url: socialUrl(e.target.value, account.handle) }
                  set({ accounts })
                }}
              >
                {SOCIAL_PLATFORMS.map((platform) => (
                  <option key={platform.id} value={platform.id}>
                    {platform.label}
                  </option>
                ))}
              </select>
              <Input
                value={account.handle}
                placeholder="@handle"
                aria-label="Handle"
                onChange={(e) => {
                  const accounts = [...social.accounts]
                  // Auto-fill the link from the handle until the creator edits the link themselves.
                  const autoUrl = account.url === socialUrl(account.platform, account.handle) || !account.url
                  accounts[index] = { ...account, handle: e.target.value, url: autoUrl ? socialUrl(account.platform, e.target.value) : account.url }
                  set({ accounts })
                }}
              />
              <Input
                value={account.url}
                placeholder="https://…"
                aria-label="Link"
                onChange={(e) => {
                  const accounts = [...social.accounts]
                  accounts[index] = { ...account, url: e.target.value }
                  set({ accounts })
                }}
              />
              <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" aria-label="Remove account" onClick={() => set({ accounts: social.accounts.filter((a) => a.id !== account.id) })}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section className={CARD}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Images & video</h3>
            <p className="text-xs text-muted-foreground">Shown in your site&apos;s social section (YouTube, MP4 or image links).</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={social.media.length >= SITE_LIMITS.media}
            onClick={() => set({ media: [...social.media, { id: newId(), type: 'image', url: '', caption: '' }] })}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add media
          </Button>
        </div>
        <ul className="space-y-2">
          {social.media.map((item, index) => (
            <li key={item.id} className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[110px_minmax(0,1.4fr)_minmax(0,1fr)_auto]">
              <select
                className={SELECT}
                value={item.type}
                aria-label="Media type"
                onChange={(e) => {
                  const media = [...social.media]
                  media[index] = { ...item, type: e.target.value === 'video' ? 'video' : 'image' }
                  set({ media })
                }}
              >
                <option value="image">Image</option>
                <option value="video">Video</option>
              </select>
              <Input
                value={item.url}
                placeholder="https://…"
                aria-label="Media URL"
                onChange={(e) => {
                  const media = [...social.media]
                  media[index] = { ...item, url: e.target.value }
                  set({ media })
                }}
              />
              <Input
                value={item.caption}
                placeholder="Caption"
                aria-label="Caption"
                onChange={(e) => {
                  const media = [...social.media]
                  media[index] = { ...item, caption: e.target.value }
                  set({ media })
                }}
              />
              <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" aria-label="Remove media" onClick={() => set({ media: social.media.filter((m) => m.id !== item.id) })}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}

// ── 4. Services & Forms ─────────────────────────────────────────────────────

function emptyService(): SiteService {
  return { id: newId(), name: '', category: '', summary: '', price: '', active: true, docs: [] }
}

function emptyDoc(): ServiceDoc {
  return { id: newId(), name: '', formCode: '', issuer: '', pdfUrl: '' }
}

export function ServicesSection({ content, onChange }: SectionProps) {
  const [open, setOpen] = useState<string | null>(content.services[0]?.id ?? null)
  const services = content.services
  const setServices = (next: SiteService[]) => onChange({ ...content, services: next })
  const patch = (id: string, value: Partial<SiteService>) => setServices(services.map((s) => (s.id === id ? { ...s, ...value } : s)))

  return (
    <section className={CARD}>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {services.length} service{services.length === 1 ? '' : 's'} · {services.reduce((n, s) => n + s.docs.length, 0)} documents
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={services.length >= SITE_LIMITS.services}
          onClick={() => {
            const service = emptyService()
            setServices([...services, service])
            setOpen(service.id)
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" /> Add service
        </Button>
      </div>

      {services.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          No services yet — add one, use Fill with AI, or import a file in Advanced.
        </p>
      ) : null}

      <ol className="space-y-2">
        {services.map((service, index) => {
          const expanded = open === service.id
          return (
            <li key={service.id} className={`rounded-xl border ${expanded ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
              <div className="flex items-center gap-2 p-3">
                <button type="button" onClick={() => setOpen(expanded ? null : service.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={expanded}>
                  {expanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                  <span className="truncate text-sm font-medium">{service.name || 'Untitled service'}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{service.docs.length} docs</span>
                  {!service.active ? <span className="shrink-0 text-xs text-amber-500">hidden</span> : null}
                </button>
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={index === 0} onClick={() => setServices(move(services, index, -1))} aria-label="Move up">
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={index === services.length - 1} onClick={() => setServices(move(services, index, 1))} aria-label="Move down">
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  aria-label="Delete service"
                  onClick={() =>
                    onChange({
                      ...content,
                      services: services.filter((s) => s.id !== service.id),
                      keyDates: content.keyDates.map((d) => (d.serviceId === service.id ? { ...d, serviceId: '' } : d)),
                    })
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {expanded ? (
                <div className="space-y-3 border-t border-border p-3">
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_120px]">
                    <Input value={service.name} placeholder="Service name" aria-label="Service name" onChange={(e) => patch(service.id, { name: e.target.value })} />
                    <Input value={service.category} placeholder="Category" aria-label="Category" onChange={(e) => patch(service.id, { category: e.target.value })} />
                    <Input value={service.price} placeholder="Price" aria-label="Price" onChange={(e) => patch(service.id, { price: e.target.value })} />
                  </div>
                  <Textarea rows={2} value={service.summary} placeholder="Short description" aria-label="Description" onChange={(e) => patch(service.id, { summary: e.target.value })} />
                  <label className="flex items-center gap-2 text-xs">
                    <Switch checked={service.active} onCheckedChange={(activeValue) => patch(service.id, { active: activeValue })} />
                    Show on website
                  </label>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold">Documents & forms</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7"
                        disabled={service.docs.length >= SITE_LIMITS.docs}
                        onClick={() => patch(service.id, { docs: [...service.docs, emptyDoc()] })}
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" /> Add document
                      </Button>
                    </div>
                    {service.docs.map((doc, docIndex) => (
                      <div key={doc.id} className="grid gap-2 sm:grid-cols-[minmax(0,1.2fr)_100px_minmax(0,1fr)_minmax(0,1.2fr)_auto]">
                        {(['name', 'formCode', 'issuer', 'pdfUrl'] as const).map((key) => (
                          <Input
                            key={key}
                            value={doc[key]}
                            aria-label={key}
                            placeholder={{ name: 'Document name', formCode: 'Form code', issuer: 'Issuer', pdfUrl: 'PDF link' }[key]}
                            onChange={(e) => {
                              const docs = [...service.docs]
                              docs[docIndex] = { ...doc, [key]: e.target.value }
                              patch(service.id, { docs })
                            }}
                          />
                        ))}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-destructive"
                          aria-label="Remove document"
                          onClick={() => patch(service.id, { docs: service.docs.filter((d) => d.id !== doc.id) })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

// ── 5. Key Dates ────────────────────────────────────────────────────────────

function emptyKeyDate(): KeyDate {
  return { id: newId(), date: '', title: '', serviceId: '', perk: '', gift: '', govFee: '', note: '' }
}

export function KeyDatesSection({ content, onChange }: SectionProps) {
  const dates = content.keyDates
  const setDates = (next: KeyDate[]) => onChange({ ...content, keyDates: next })
  const patch = (id: string, value: Partial<KeyDate>) => setDates(dates.map((d) => (d.id === id ? { ...d, ...value } : d)))
  const sortByDate = () => setDates([...dates].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999')))

  return (
    <section className={CARD}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{dates.length} dates · sorted by date when saved</p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={sortByDate} disabled={dates.length < 2}>
            Sort by date
          </Button>
          <Button variant="outline" size="sm" disabled={dates.length >= SITE_LIMITS.keyDates} onClick={() => setDates([...dates, emptyKeyDate()])}>
            <Plus className="mr-1.5 h-4 w-4" /> Add date
          </Button>
        </div>
      </div>
      {dates.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          No dates yet — add deadlines, renewals and seasonal offers, or use Fill with AI.
        </p>
      ) : null}
      <ul className="space-y-2">
        {dates.map((row) => (
          <li key={row.id} className="space-y-2 rounded-xl border border-border p-3">
            <div className="grid gap-2 sm:grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)_auto]">
              <Input type="date" value={row.date} aria-label="Date" onChange={(e) => patch(row.id, { date: e.target.value })} />
              <Input value={row.title} placeholder="Title" aria-label="Title" onChange={(e) => patch(row.id, { title: e.target.value })} />
              <select className={SELECT} value={row.serviceId} aria-label="Service" onChange={(e) => patch(row.id, { serviceId: e.target.value })}>
                <option value="">No service</option>
                {content.services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name || 'Untitled service'}
                  </option>
                ))}
              </select>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" aria-label="Remove date" onClick={() => setDates(dates.filter((d) => d.id !== row.id))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <Input value={row.perk} placeholder="Perk" aria-label="Perk" onChange={(e) => patch(row.id, { perk: e.target.value })} />
              <Input value={row.gift} placeholder="Gift" aria-label="Gift" onChange={(e) => patch(row.id, { gift: e.target.value })} />
              <Input value={row.govFee} placeholder="Gov. fee" aria-label="Government fee" onChange={(e) => patch(row.id, { govFee: e.target.value })} />
            </div>
            <Input value={row.note} placeholder="Note" aria-label="Note" onChange={(e) => patch(row.id, { note: e.target.value })} />
          </li>
        ))}
      </ul>
    </section>
  )
}

// ── 6. Advanced ─────────────────────────────────────────────────────────────

export function AdvancedSection({
  content,
  businessName,
  onChange,
  projects,
  linkedProjectIds,
}: SectionProps & {
  projects: { id: string; title: string; kind: 'PROJECT' | 'PRODUCT' }[]
  linkedProjectIds: string[]
}) {
  const advanced = content.advanced
  const set = (patch: Partial<typeof advanced>) => onChange({ ...content, advanced: { ...advanced, ...patch } })
  const fileRef = useRef<HTMLInputElement | null>(null)
  const jsonFileRef = useRef<HTMLInputElement | null>(null)
  const [snapshot, setSnapshot] = useState('')
  const [isImporting, startImporting] = useTransition()

  const exportJson = JSON.stringify(content, null, 2)

  const importServices = (file: File) =>
    startImporting(guardAction(async () => {
      const result = await importServicesFile(await file.text())
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      const merged = sanitizeSiteContent({ ...content, services: [...content.services, ...result.services] }, businessName)
      onChange(merged)
      toast.success(`Imported ${result.services.length} services — review, then Save`)
    }))

  const applySnapshot = (text: string) => {
    try {
      onChange(sanitizeSiteContent(JSON.parse(text) as BusinessSiteContent, businessName))
      setSnapshot('')
      toast.success('Snapshot loaded — review, then Save')
    } catch {
      toast.error('That is not valid JSON')
    }
  }

  return (
    <>
      <section className={CARD}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business type">
            <select className={SELECT} value={advanced.vertical} onChange={(e) => set({ vertical: e.target.value })}>
              <option value="">Not set</option>
              {VERTICALS.map((vertical) => (
                <option key={vertical.id} value={vertical.id}>
                  {vertical.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Location">
            <Input value={advanced.location} maxLength={SITE_LIMITS.short} onChange={(e) => set({ location: e.target.value })} placeholder="e.g. Austin, Texas" />
          </Field>
          <Field label="Website URL">
            <Input value={advanced.websiteUrl} onChange={(e) => set({ websiteUrl: e.target.value })} placeholder="https://your-site.com" />
          </Field>
        </div>
        <Field label="Terms & conditions" hint={<Counter value={advanced.termsAndConditions} max={SITE_LIMITS.terms} />}>
          <Textarea rows={6} value={advanced.termsAndConditions} maxLength={SITE_LIMITS.terms} onChange={(e) => set({ termsAndConditions: e.target.value })} />
        </Field>
      </section>

      <BusinessProductsCard projects={projects} linkedIds={linkedProjectIds} />

      <section className={CARD}>
        <div>
          <h3 className="text-sm font-semibold">Import</h3>
          <p className="text-xs text-muted-foreground">Add services from a CSV or SQL export (appended to your list).</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.sql,.txt"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) importServices(file)
            e.target.value = ''
          }}
        />
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={isImporting}>
          {isImporting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileUp className="mr-1.5 h-4 w-4" />}
          Import services file
        </Button>
      </section>

      <section className={CARD}>
        <div>
          <h3 className="text-sm font-semibold">JSON snapshot</h3>
          <p className="text-xs text-muted-foreground">Back up everything on this page, or restore it from a snapshot.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await navigator.clipboard.writeText(exportJson)
              toast.success('Snapshot copied')
            }}
          >
            <Copy className="mr-1.5 h-4 w-4" /> Copy JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const blob = new Blob([exportJson], { type: 'application/json' })
              const link = document.createElement('a')
              link.href = URL.createObjectURL(blob)
              link.download = `${businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'business'}-snapshot.json`
              link.click()
              URL.revokeObjectURL(link.href)
            }}
          >
            <Download className="mr-1.5 h-4 w-4" /> Download
          </Button>
          <input
            ref={jsonFileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (file) applySnapshot(await file.text())
              e.target.value = ''
            }}
          />
          <Button variant="outline" size="sm" onClick={() => jsonFileRef.current?.click()}>
            <Upload className="mr-1.5 h-4 w-4" /> Load file
          </Button>
        </div>
        <Textarea rows={5} value={snapshot} onChange={(e) => setSnapshot(e.target.value)} placeholder="…or paste a snapshot here" className="font-mono text-xs" />
        <Button size="sm" variant="secondary" disabled={!snapshot.trim()} onClick={() => applySnapshot(snapshot)}>
          Load pasted snapshot
        </Button>
      </section>
    </>
  )
}
