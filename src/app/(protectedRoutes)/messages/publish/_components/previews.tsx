'use client'

/* eslint-disable @next/next/no-img-element -- creator-supplied external URLs, not optimizable */
import { CalendarDays, ExternalLink, FileText, Gift, Mail, Sparkles } from 'lucide-react'
import { SOCIAL_PLATFORMS, type BusinessSiteContent, type SiteSection } from '@/lib/business/siteContent'

const FRAME = 'overflow-hidden rounded-3xl border border-border bg-card'

function Label({ children }: { children: React.ReactNode }) {
  return <p className="border-b border-border px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{children}</p>
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return 'your-site.com'
  }
}

function youtubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|v=|shorts\/)([\w-]{11})/)
  return match ? match[1] : null
}

function FollowOn({ content }: { content: BusinessSiteContent }) {
  if (!content.social.accounts.length) return null
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-zinc-400">{content.social.followLabel}</span>
      {content.social.accounts.map((account) => (
        <span key={account.id} className="rounded-full border border-white/15 px-2 py-0.5">
          {SOCIAL_PLATFORMS.find((p) => p.id === account.platform)?.label ?? account.platform}
        </span>
      ))}
    </div>
  )
}

function FooterMock({ content, businessName }: { content: BusinessSiteContent; businessName: string }) {
  const { footer } = content
  return (
    <footer className="space-y-3 bg-zinc-950 p-5 text-zinc-200">
      <div>
        <p className="text-sm font-semibold">{businessName}</p>
        {footer.tagline ? <p className="text-xs text-zinc-400">{footer.tagline}</p> : null}
      </div>
      {footer.email ? (
        <p className="flex items-center gap-1.5 text-xs">
          <Mail className="h-3.5 w-3.5" /> {footer.email}
        </p>
      ) : null}
      <FollowOn content={content} />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 text-[11px] text-zinc-400">
        <span>{footer.copyright}</span>
        <span className="flex gap-3">
          {footer.privacyUrl ? <span className="underline">Privacy</span> : null}
          {footer.termsUrl ? <span className="underline">Terms</span> : null}
        </span>
      </div>
    </footer>
  )
}

export function SectionPreview({
  section,
  content,
  businessName,
}: {
  section: SiteSection
  content: BusinessSiteContent
  businessName: string
}) {
  if (section === 'seo') {
    const { seo } = content
    const host = hostOf(content.advanced.websiteUrl)
    return (
      <div className="space-y-4">
        <div className={FRAME}>
          <Label>Google result</Label>
          <div className="space-y-0.5 bg-white p-4 text-left">
            <p className="text-xs text-zinc-600">{host}</p>
            <p className="text-lg leading-snug text-[#1a0dab]">{seo.title || businessName}</p>
            <p className="text-sm text-zinc-600">{seo.description || 'Add a meta description so search results show what you do.'}</p>
          </div>
        </div>
        <div className={FRAME}>
          <Label>Share card (WhatsApp, Facebook, LinkedIn)</Label>
          <div className="bg-zinc-900">
            {seo.ogImage ? (
              <img src={seo.ogImage} alt="" className="aspect-[1200/630] w-full object-cover" />
            ) : (
              <div className="flex aspect-[1200/630] items-center justify-center bg-gradient-to-br from-indigo-500/40 to-cyan-400/30 text-sm text-zinc-200">
                {businessName}
              </div>
            )}
            <div className="space-y-0.5 p-3">
              <p className="text-[11px] uppercase text-zinc-400">{host}</p>
              <p className="text-sm font-semibold text-zinc-100">{seo.title || businessName}</p>
              <p className="line-clamp-2 text-xs text-zinc-400">{seo.description}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (section === 'footer') {
    return (
      <div className={FRAME}>
        <Label>Footer · all pages</Label>
        <FooterMock content={content} businessName={businessName} />
      </div>
    )
  }

  if (section === 'social') {
    return (
      <div className={FRAME}>
        <Label>Social section</Label>
        <div className="space-y-3 bg-zinc-950 p-4 text-zinc-100">
          <FollowOn content={content} />
          {content.social.media.length ? (
            <div className="grid grid-cols-2 gap-2">
              {content.social.media.map((item) => {
                const yt = item.type === 'video' ? youtubeId(item.url) : null
                return (
                  <figure key={item.id} className="overflow-hidden rounded-lg border border-white/10">
                    {item.type === 'image' ? (
                      <img src={item.url} alt={item.caption} className="aspect-square w-full object-cover" />
                    ) : yt ? (
                      <img src={`https://i.ytimg.com/vi/${yt}/hqdefault.jpg`} alt={item.caption} className="aspect-square w-full object-cover" />
                    ) : (
                      <video src={item.url} className="aspect-square w-full object-cover" muted playsInline />
                    )}
                    {item.caption ? <figcaption className="truncate px-2 py-1 text-[11px] text-zinc-400">{item.caption}</figcaption> : null}
                  </figure>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-zinc-400">Add images or videos to show them here.</p>
          )}
        </div>
        <FooterMock content={content} businessName={businessName} />
      </div>
    )
  }

  if (section === 'services') {
    const visible = content.services.filter((service) => service.active)
    return (
      <div className={FRAME}>
        <Label>/calendar · Services & forms</Label>
        <div className="max-h-[70vh] space-y-2 overflow-y-auto bg-zinc-950 p-4 text-zinc-100">
          {visible.length === 0 ? <p className="text-xs text-zinc-400">Visible services appear here.</p> : null}
          {visible.map((service) => (
            <div key={service.id} className="rounded-xl border border-white/10 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{service.name}</p>
                  {service.category ? <p className="text-[11px] text-zinc-400">{service.category}</p> : null}
                </div>
                {service.price ? <span className="shrink-0 text-xs text-emerald-300">{service.price}</span> : null}
              </div>
              {service.summary ? <p className="mt-1 text-xs text-zinc-300">{service.summary}</p> : null}
              {service.docs.length ? (
                <ul className="mt-2 space-y-1">
                  {service.docs.map((doc) => (
                    <li key={doc.id} className="flex items-center gap-1.5 text-[11px] text-zinc-300">
                      <FileText className="h-3 w-3 shrink-0" />
                      <span className="truncate">
                        {doc.name}
                        {doc.formCode ? <span className="text-zinc-500"> · {doc.formCode}</span> : null}
                        {doc.issuer ? <span className="text-zinc-500"> · {doc.issuer}</span> : null}
                      </span>
                      {doc.pdfUrl ? <ExternalLink className="h-3 w-3 shrink-0 text-indigo-300" /> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (section === 'keyDates') {
    const serviceName = new Map(content.services.map((service) => [service.id, service.name]))
    const byMonth = new Map<string, typeof content.keyDates>()
    for (const row of content.keyDates) {
      const key = row.date
        ? new Date(`${row.date}T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
        : 'No date'
      byMonth.set(key, [...(byMonth.get(key) ?? []), row])
    }
    return (
      <div className={FRAME}>
        <Label>/calendar · Key dates</Label>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto bg-zinc-950 p-4 text-zinc-100">
          {content.keyDates.length === 0 ? <p className="text-xs text-zinc-400">Dates appear here by month.</p> : null}
          {[...byMonth.entries()].map(([month, rows]) => (
            <div key={month} className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                <CalendarDays className="h-3.5 w-3.5" /> {month}
              </p>
              {rows.map((row) => (
                <div key={row.id} className="flex gap-3 rounded-xl border border-white/10 p-3">
                  <div className="w-10 shrink-0 text-center">
                    <p className="text-lg font-bold leading-none">{row.date ? Number(row.date.slice(8, 10)) : '–'}</p>
                  </div>
                  <div className="min-w-0 space-y-0.5 text-xs">
                    <p className="text-sm font-semibold">{row.title || 'Untitled'}</p>
                    {row.serviceId ? <p className="text-zinc-400">{serviceName.get(row.serviceId)}</p> : null}
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-zinc-300">
                      {row.perk ? (
                        <span className="flex items-center gap-1">
                          <Sparkles className="h-3 w-3" /> {row.perk}
                        </span>
                      ) : null}
                      {row.gift ? (
                        <span className="flex items-center gap-1">
                          <Gift className="h-3 w-3" /> {row.gift}
                        </span>
                      ) : null}
                      {row.govFee ? <span>Gov. fee {row.govFee}</span> : null}
                    </div>
                    {row.note ? <p className="text-zinc-400">{row.note}</p> : null}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={FRAME}>
      <Label>JSON snapshot</Label>
      <pre className="max-h-[70vh] overflow-auto bg-zinc-950 p-4 text-[10px] leading-relaxed text-zinc-300">
        {JSON.stringify(content, null, 2)}
      </pre>
    </div>
  )
}
