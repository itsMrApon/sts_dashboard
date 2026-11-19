'use client'

import { useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  LIVE_MAX_OPTIONS,
  SITE_LIMITS,
  SOCIAL_PLATFORMS,
  defaultCopyright,
  newId,
  socialUrl,
  type KeyDate,
  type SiteDoc,
  type SiteService,
} from '@/lib/business/siteContent'
import type { SectionProps } from './BusinessConfigurator'
import type { LiveSession } from '@/lib/business/businessOffers'
import { LiveSessionList } from '../../live/_components/LiveSessionList'

// Sits inside the editor's section card, so it's a lighter inner panel.
const CARD = 'space-y-4 rounded-xl border border-border/70 bg-muted/20 p-4'
const SELECT = 'h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm'

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

// ── Contact ────────────────────────────────────────────

export function FooterSection({ content, businessName, onChange }: SectionProps) {
  const footer = content.footer
  const set = (patch: Partial<typeof footer>) => onChange({ ...content, footer: { ...footer, ...patch } })
  const setCredential = (index: number, value: string) =>
    set({ credentials: footer.credentials.map((item, i) => (i === index ? value : item)) })
  return (
    <>
      <section className={CARD}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business email">
            <Input type="email" value={footer.email} onChange={(e) => set({ email: e.target.value })} placeholder="hello@business.com" />
          </Field>
          <Field label="Phone / WhatsApp">
            <Input type="tel" value={footer.phone} maxLength={40} onChange={(e) => set({ phone: e.target.value })} placeholder="+1 212 555 0100" />
          </Field>
        </div>
        <Field label="Address">
          <Input value={footer.address} maxLength={200} onChange={(e) => set({ address: e.target.value })} placeholder="123 Main St, New York, NY" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Opening hours">
            <Input value={footer.hours} maxLength={200} onChange={(e) => set({ hours: e.target.value })} placeholder="Mon–Fri 9am–6pm" />
          </Field>
          <Field label="Map link">
            <Input value={footer.mapUrl} onChange={(e) => set({ mapUrl: e.target.value })} placeholder="https://maps.google.com/…" />
          </Field>
        </div>
      </section>

      <section className={CARD}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Trust badges</h3>
            <p className="text-xs text-muted-foreground">Licenses and proof visitors trust, e.g. “Licensed in NY”.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={footer.credentials.length >= SITE_LIMITS.credentials}
            onClick={() => set({ credentials: [...footer.credentials, ''] })}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add badge
          </Button>
        </div>
        {footer.credentials.length === 0 ? <p className="text-sm text-muted-foreground">No badges yet.</p> : null}
        <ul className="space-y-2">
          {footer.credentials.map((credential, index) => (
            <li key={index} className="flex items-center gap-2">
              <Input value={credential} maxLength={80} aria-label="Trust badge" onChange={(e) => setCredential(index, e.target.value)} />
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-destructive"
                aria-label="Remove badge"
                onClick={() => set({ credentials: footer.credentials.filter((_, i) => i !== index) })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section className={CARD}>
        <Field label="Tagline">
          <Input value={footer.tagline} maxLength={200} onChange={(e) => set({ tagline: e.target.value })} />
        </Field>
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
        <p className="text-xs text-muted-foreground">The “Follow on” row comes from Links.</p>
      </section>
    </>
  )
}

// ── Links ───────────────────────────────────────────────────────────────

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

// ── Menu ─────────────────────────────────────────────────────

function emptyService(): SiteService {
  return { id: newId(), name: '', category: '', summary: '', price: '', active: true }
}

function emptyDoc(): SiteDoc {
  return { id: newId(), name: '', formCode: '', issuer: '', pdfUrl: '', serviceIds: [] }
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
          {services.length} service{services.length === 1 ? '' : 's'}
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
          No services yet: add one or use Let AI fill it.
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
                      docs: content.docs.map((doc) => ({ ...doc, serviceIds: doc.serviceIds.filter((id) => id !== service.id) })),
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

                </div>
              ) : null}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

// ── Docs ───────────────────────────────────────────────────────────

/**
 * Documents customers need: forms, checklists, PDFs. Each stands on its own; "Used for" optionally
 * ties it to Menu services so a website can show it under them.
 */
export function DocsSection({ content, onChange }: SectionProps) {
  const { docs, services } = content
  const setDocs = (next: SiteDoc[]) => onChange({ ...content, docs: next })
  const patch = (id: string, value: Partial<SiteDoc>) => setDocs(docs.map((doc) => (doc.id === id ? { ...doc, ...value } : doc)))
  const toggleService = (doc: SiteDoc, serviceId: string) =>
    patch(doc.id, {
      serviceIds: doc.serviceIds.includes(serviceId)
        ? doc.serviceIds.filter((id) => id !== serviceId)
        : [...doc.serviceIds, serviceId],
    })

  return (
    <section className={CARD}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {docs.length} document{docs.length === 1 ? '' : 's'}
        </p>
        <Button variant="outline" size="sm" disabled={docs.length >= SITE_LIMITS.docs} onClick={() => setDocs([...docs, emptyDoc()])}>
          <Plus className="mr-1.5 h-4 w-4" /> Add document
        </Button>
      </div>

      {docs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          No documents yet: add the forms and PDFs your customers need.
        </p>
      ) : null}

      <ul className="space-y-2">
        {docs.map((doc, index) => (
          <li key={doc.id} className="space-y-3 rounded-xl border border-border p-3">
            <div className="flex items-start gap-2">
              <div className="grid flex-1 gap-2 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                <Input value={doc.name} placeholder="Document name" aria-label="Document name" onChange={(e) => patch(doc.id, { name: e.target.value })} />
                <Input value={doc.pdfUrl} placeholder="PDF link" aria-label="PDF link" onChange={(e) => patch(doc.id, { pdfUrl: e.target.value })} />
                <Input value={doc.formCode} placeholder="Form code (optional)" aria-label="Form code" onChange={(e) => patch(doc.id, { formCode: e.target.value })} />
                <Input value={doc.issuer} placeholder="Issuer (optional)" aria-label="Issuer" onChange={(e) => patch(doc.id, { issuer: e.target.value })} />
              </div>
              <div className="flex shrink-0 flex-col">
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={index === 0} onClick={() => setDocs(move(docs, index, -1))} aria-label="Move up">
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={index === docs.length - 1} onClick={() => setDocs(move(docs, index, 1))} aria-label="Move down">
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  aria-label="Remove document"
                  onClick={() => setDocs(docs.filter((item) => item.id !== doc.id))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            {services.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={`Used for (${doc.name || 'document'})`}>
                <span className="text-xs text-muted-foreground">Used for</span>
                {services.map((service) => {
                  const on = doc.serviceIds.includes(service.id)
                  return (
                    <button
                      key={service.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleService(doc, service.id)}
                      className={
                        on
                          ? 'rounded-full border border-primary/50 bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary'
                          : 'rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground'
                      }
                    >
                      {service.name || 'Untitled service'}
                    </button>
                  )
                })}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}

// ── Live ────────────────────────────────────────────────────────────────────

/** How upcoming webinars show on the website. The webinars themselves are scheduled in Projects. */
export function LiveSection({ content, onChange, sessions }: SectionProps & { sessions: LiveSession[] }) {
  const live = content.live
  const set = (patch: Partial<typeof live>) => onChange({ ...content, live: { ...live, ...patch } })
  const shownCount = sessions.filter((session) => session.joinUrl && !live.hiddenSlugs.includes(session.slug)).length
  return (
    <>
      <section className={CARD}>
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="block text-sm font-semibold">Show Live on my website</span>
            <span className="block text-xs text-muted-foreground">Off: the website gets no sessions.</span>
          </span>
          <Switch checked={live.enabled} onCheckedChange={(enabled) => set({ enabled })} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Heading">
            <Input value={live.title} maxLength={80} onChange={(e) => set({ title: e.target.value })} placeholder="Join us live" />
          </Field>
          <Field label="Join button">
            <Input value={live.joinLabel} maxLength={30} onChange={(e) => set({ joinLabel: e.target.value })} placeholder="Join" />
          </Field>
        </div>
        <Field label="Show at most">
          <select
            className={SELECT}
            value={live.maxSessions}
            aria-label="How many sessions to show"
            onChange={(e) => set({ maxSessions: Number(e.target.value) })}
          >
            {LIVE_MAX_OPTIONS.map((count) => (
              <option key={count} value={count}>
                {count} session{count === 1 ? '' : 's'}
              </option>
            ))}
          </select>
        </Field>
      </section>

      <section className={CARD}>
        <div>
          <h3 className="text-sm font-semibold">Upcoming sessions</h3>
          <p className="text-xs text-muted-foreground">
            {live.enabled
              ? `${Math.min(shownCount, live.maxSessions)} of ${sessions.length} will show on your website.`
              : 'Live is off, so none will show.'}
          </p>
        </div>
        <LiveSessionList
          sessions={sessions}
          hiddenSlugs={live.hiddenSlugs}
          onToggle={(slug, show) =>
            set({ hiddenSlugs: show ? live.hiddenSlugs.filter((item) => item !== slug) : [...live.hiddenSlugs, slug] })
          }
        />
      </section>
    </>
  )
}

// ── Deadlines & promos (on Menu) ────────────────────────────────────────────────────────────

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
          No dates yet — add deadlines, renewals and seasonal offers, or use Let AI fill it.
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
