import Link from 'next/link'
import { ArrowUpRight, CalendarDays, ClipboardList, Compass, FileText, Mail, MessageCircle, Mic, Radio } from 'lucide-react'
import type { BusinessOffer } from '@/lib/business/businessOffers'
import type { BusinessSiteContent, KeyDate } from '@/lib/business/siteContent'
import { SOCIAL_PLATFORMS, VERTICALS, socialUrl } from '@/lib/business/siteContent'
import type { PublicServiceLinks } from '@/lib/public/publicService'
import { accentHex } from '@/lib/services/types'
import { cn } from '@/lib/utils'

type Props = {
  /** The printable Docs checklist; shown when any document is listed. */
  documentsHref?: string
  businessName: string
  description: string | null
  content: BusinessSiteContent
  offers: BusinessOffer[]
  links: PublicServiceLinks
  /** The owner's approved answers (Projects → General questions), shown as an FAQ. */
  answers?: { question: string; answer: string }[]
  /** Reviews the owner chose to show (Services → Reviews). */
  reviews?: { name: string; rating: number; text: string }[]
}

/** Opens the room's chat with this question already sent (handled by BusinessRoom). */
function askHref(question: string): string {
  return `#ask=${encodeURIComponent(question)}`
}

const SECTION = 'space-y-4'
const SECTION_TITLE = 'text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400'
const CARD = 'rounded-2xl border border-white/10 bg-white/[0.04] p-5'

function upcoming(dates: KeyDate[]): KeyDate[] {
  const today = new Date().toISOString().slice(0, 10)
  return dates.filter((item) => item.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8)
}

function formatDate(isoDay: string): string {
  const date = new Date(`${isoDay}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? isoDay
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function platformLabel(platform: string): string {
  return SOCIAL_PLATFORMS.find((item) => item.id === platform)?.label ?? platform
}

/** The published business website: hero, services, offers, key dates, social and footer. */
export function BusinessSite({ businessName, description, content, offers, links, answers = [], reviews = [], documentsHref }: Props) {
  const services = content.services.filter((service) => service.active)
  const dates = upcoming(content.keyDates)
  const serviceName = new Map(content.services.map((service) => [service.id, service.name]))
  const { footer, social, advanced, appearance } = content
  // "Insurance · Austin, Texas": business type (when it's a named one) and location.
  const typeLabel = advanced.vertical && advanced.vertical !== 'other' ? VERTICALS.find((item) => item.id === advanced.vertical)?.label : null
  const kicker = [typeLabel, advanced.location].filter(Boolean).join(' · ')
  const { show } = appearance
  const accent = accentHex(appearance.accent)
  const left = appearance.heroAlign === 'left'

  // Hero buttons: switched on here and the service itself is on. They open the room's panels
  // (#chat, #talk, #form) or restart the tour (#tour) on this same page.
  const chat = appearance.actions.chat && links.chat
  const speak = appearance.actions.speak && links.speak
  const actions = [
    chat ? { href: '#chat', label: 'Chat with us', icon: MessageCircle, primary: true } : null,
    speak ? { href: '#talk', label: 'Call us', icon: Mic, primary: !chat } : null,
    appearance.actions.form && links.form ? { href: '#form', label: 'Request a callback', icon: ClipboardList, primary: false } : null,
    appearance.actions.wizard && links.wizard ? { href: '#tour', label: 'Take the tour', icon: Compass, primary: false } : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null)

  return (
    <div className="space-y-14 pb-6">
      <section data-sts-step="intro" className={cn('pt-6 sm:pt-12', left ? 'text-left' : 'text-center')}>
        {kicker ? (
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em]" style={{ color: accent }}>
            {kicker}
          </p>
        ) : null}
        <h1 className={cn('max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl', !left && 'mx-auto')}>
          {content.seo.title || businessName}
        </h1>
        {content.seo.description || description || footer.tagline ? (
          <p className={cn('mt-4 max-w-2xl text-pretty text-base text-zinc-300', !left && 'mx-auto')}>
            {content.seo.description || description || footer.tagline}
          </p>
        ) : null}
        {actions.length > 0 ? (
          <div className={cn('mt-8 flex flex-wrap gap-2', !left && 'justify-center')}>
            {actions.map((action) => (
              <a
                key={action.href}
                href={action.href}
                style={action.primary ? { backgroundColor: accent } : undefined}
                className={
                  action.primary
                    ? 'flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-white hover:opacity-90'
                    : 'flex items-center gap-2 rounded-full border border-white/15 px-5 py-2.5 text-sm hover:bg-white/10'
                }
              >
                <action.icon className="h-4 w-4" aria-hidden />
                {action.label}
              </a>
            ))}
          </div>
        ) : null}
      </section>

      {show.offers && offers.length > 0 ? (
        <section data-sts-step="offers" className={SECTION} aria-labelledby="offers-title">
          <h2 id="offers-title" className={SECTION_TITLE}>
            Offers
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {offers.map((offer) => (
              <Link key={offer.href} href={offer.href} className={`${CARD} group flex flex-col gap-2 transition-colors hover:border-white/25`}>
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">{offer.title}</p>
                  {offer.live ? (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] text-rose-300">
                      <Radio className="h-3 w-3" aria-hidden />
                      Live
                    </span>
                  ) : (
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-zinc-500 group-hover:text-white" aria-hidden />
                  )}
                </div>
                {offer.description ? <p className="line-clamp-3 text-sm text-zinc-400">{offer.description}</p> : null}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {show.services && services.length > 0 ? (
        <section data-sts-step="services" className={SECTION} aria-labelledby="services-title">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="services-title" className={SECTION_TITLE}>
              Services
            </h2>
            {documentsHref && content.docs.some((doc) => doc.name.trim() || doc.formCode.trim()) ? (
              <a href={documentsHref} className="flex items-center gap-1 text-xs text-zinc-300 underline-offset-2 hover:underline">
                <FileText className="h-3.5 w-3.5" aria-hidden />
                Documents checklist (print or PDF)
              </a>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <article key={service.id} className={`${CARD} flex flex-col gap-2`}>
                {service.category ? <p className="text-[11px] uppercase tracking-wide text-zinc-500">{service.category}</p> : null}
                <h3 className="font-medium">{service.name}</h3>
                {service.summary ? <p className="text-sm text-zinc-400">{service.summary}</p> : null}
                {links.chat || links.form ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {links.chat ? (
                      <a
                        href={askHref(`Tell me about ${service.name}`)}
                        className="flex items-center gap-1 rounded-full border border-white/15 px-2.5 py-1 text-xs text-zinc-200 hover:bg-white/10"
                      >
                        <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                        Ask about this
                      </a>
                    ) : null}
                    {links.form ? (
                      <a
                        href="#form"
                        className="flex items-center gap-1 rounded-full border border-white/15 px-2.5 py-1 text-xs text-zinc-200 hover:bg-white/10"
                      >
                        <ClipboardList className="h-3.5 w-3.5" aria-hidden />
                        Book a call
                      </a>
                    ) : null}
                  </div>
                ) : null}
                <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-2">
                  {service.price ? (
                    <p className="text-sm font-semibold" style={{ color: accent }}>
                      {service.price}
                    </p>
                  ) : (
                    <span />
                  )}
                  {content.docs.filter((doc) => doc.pdfUrl && doc.serviceIds.includes(service.id)).map((doc) => (
                    <a
                      key={doc.id}
                      href={doc.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-zinc-300 underline-offset-2 hover:underline"
                    >
                      <FileText className="h-3.5 w-3.5" aria-hidden />
                      {doc.formCode || doc.name}
                    </a>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {reviews.length > 0 ? (
        <section data-sts-step="reviews" className={SECTION} aria-labelledby="reviews-title">
          <h2 id="reviews-title" className={SECTION_TITLE}>
            What customers say
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {reviews.map((review, index) => (
              <figure key={`${review.name}-${index}`} className={`${CARD} flex flex-col gap-3`}>
                <p className="text-sm tracking-widest text-amber-400" aria-label={`${review.rating} out of 5 stars`}>
                  {'★'.repeat(review.rating)}
                  <span className="text-zinc-600">{'★'.repeat(5 - review.rating)}</span>
                </p>
                {review.text ? <blockquote className="whitespace-pre-wrap text-sm text-zinc-200">“{review.text}”</blockquote> : null}
                <figcaption className="mt-auto text-xs text-zinc-400">{review.name}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      {answers.length > 0 ? (
        <section data-sts-step="answers" className={SECTION} aria-labelledby="answers-title">
          <h2 id="answers-title" className={SECTION_TITLE}>
            Questions &amp; answers
          </h2>
          <div className="space-y-2">
            {answers.map((item) => (
              <details key={item.question} className={`${CARD} group`}>
                <summary className="cursor-pointer list-none font-medium marker:hidden">
                  <span className="flex items-start justify-between gap-3">
                    {item.question}
                    <span aria-hidden className="text-zinc-500 transition-transform group-open:rotate-45">
                      +
                    </span>
                  </span>
                </summary>
                <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-300">{item.answer}</p>
                {links.chat ? (
                  <a href={askHref(item.question)} className="mt-3 inline-block text-xs text-zinc-400 underline-offset-2 hover:text-white hover:underline">
                    Ask more in chat
                  </a>
                ) : null}
              </details>
            ))}
          </div>
        </section>
      ) : null}

      {show.keyDates && dates.length > 0 ? (
        <section data-sts-step="dates" className={SECTION} aria-labelledby="dates-title">
          <h2 id="dates-title" className={SECTION_TITLE}>
            Key dates
          </h2>
          <ul className="space-y-2">
            {dates.map((item) => (
              <li key={item.id} className={`${CARD} flex gap-4`}>
                <div className="flex w-20 shrink-0 flex-col items-center justify-center rounded-xl bg-white/[0.06] py-2 text-center">
                  <CalendarDays className="mb-1 h-4 w-4" style={{ color: accent }} aria-hidden />
                  <span className="text-xs font-medium">{formatDate(item.date)}</span>
                </div>
                <div className="min-w-0 space-y-1 text-sm">
                  <p className="font-medium">{item.title}</p>
                  {serviceName.get(item.serviceId) ? <p className="text-xs text-zinc-500">{serviceName.get(item.serviceId)}</p> : null}
                  {[item.perk, item.gift, item.govFee ? `Government fee: ${item.govFee}` : '', item.note]
                    .filter(Boolean)
                    .map((line) => (
                      <p key={line} className="text-zinc-400">
                        {line}
                      </p>
                    ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {show.social && (social.accounts.length > 0 || social.media.length > 0) ? (
        <section data-sts-step="social" className={SECTION} aria-labelledby="social-title">
          <h2 id="social-title" className={SECTION_TITLE}>
            {social.followLabel || 'Follow us'}
          </h2>
          {social.accounts.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {social.accounts
                .map((account) => ({ ...account, href: account.url || socialUrl(account.platform, account.handle) }))
                .filter((account) => account.href)
                .map((account) => (
                <a
                  key={account.id}
                  href={account.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-full border border-white/15 px-3.5 py-1.5 text-sm hover:bg-white/10"
                >
                  {platformLabel(account.platform)}
                  {account.handle ? <span className="text-zinc-400">@{account.handle.replace(/^@/, '')}</span> : null}
                </a>
              ))}
            </div>
          ) : null}
          {social.media.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {social.media.map((media) =>
                media.type === 'video' ? (
                  <video key={media.id} src={media.url} controls preload="metadata" className="aspect-video w-full rounded-xl bg-black object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- creator-supplied external URLs
                  <img key={media.id} src={media.url} alt={media.caption || businessName} loading="lazy" className="aspect-square w-full rounded-xl object-cover" />
                ),
              )}
            </div>
          ) : null}
        </section>
      ) : null}

      {show.terms && advanced.termsAndConditions ? (
        <details className={`${CARD} text-sm`}>
          <summary className="cursor-pointer font-medium">Terms and conditions</summary>
          <p className="mt-3 whitespace-pre-wrap text-zinc-400">{advanced.termsAndConditions}</p>
        </details>
      ) : null}

      <footer data-sts-step="contact" className="flex flex-col gap-3 border-t border-white/10 pt-6 text-sm text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          {footer.tagline ? <p className="text-zinc-300">{footer.tagline}</p> : null}
          {footer.phone || footer.address || footer.hours ? (
            <div className="space-y-0.5 text-xs">
              {footer.phone ? (
                <p>
                  <a href={`tel:${footer.phone.replace(/[^\d+]/g, '')}`} className="hover:text-white">
                    {footer.phone}
                  </a>
                </p>
              ) : null}
              {footer.address ? (
                <p>
                  {footer.mapUrl ? (
                    <a href={footer.mapUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                      {footer.address}
                    </a>
                  ) : (
                    footer.address
                  )}
                </p>
              ) : null}
              {footer.hours ? <p>{footer.hours}</p> : null}
            </div>
          ) : null}
          {footer.credentials.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {footer.credentials.map((credential) => (
                <span key={credential} className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-zinc-300">
                  {credential}
                </span>
              ))}
            </div>
          ) : null}
          <p className="text-xs">{footer.copyright}</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs">
          {footer.email ? (
            <a href={`mailto:${footer.email}`} className="flex items-center gap-1.5 hover:text-white">
              <Mail className="h-3.5 w-3.5" aria-hidden />
              {footer.email}
            </a>
          ) : null}
          {advanced.websiteUrl ? (
            <a href={advanced.websiteUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white">
              Website
            </a>
          ) : null}
          {footer.privacyUrl ? (
            <a href={footer.privacyUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white">
              Privacy
            </a>
          ) : null}
          {footer.termsUrl ? (
            <a href={footer.termsUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white">
              Terms
            </a>
          ) : null}
        </div>
      </footer>
    </div>
  )
}
