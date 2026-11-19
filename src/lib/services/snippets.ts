/**
 * Copy-paste SDK guides. The one-time website setup (site key + provider) lives on
 * Services → Connection; each service's Integrate view only shows where that service goes.
 */

export type GuideStep = {
  title: string
  body: string
  /** File name shown above the code, e.g. "components/ChatPopup.tsx". */
  file: string
  code: string
}

export type GuideService = 'chat' | 'speak' | 'form' | 'tour' | 'live' | 'menu' | 'docs' | 'links' | 'contact'

/** Services → Connection: done once per website, covers every service. */
export function connectionGuide(appUrl: string): GuideStep[] {
  return [
    {
      title: 'Add the site key to your env',
      body: 'Use the key below. It only works on the website you allowed.',
      file: '.env.local',
      code: `# Never commit the key\nNEXT_PUBLIC_STS_AI_URL=${appUrl}\nNEXT_PUBLIC_STS_SITE_KEY=sts_pk_live_...`,
    },
    {
      title: 'Install the SDK',
      body: 'One package for every service.',
      file: 'terminal',
      code: `npm install @sts-ai/sdk\n\n# Voice AI also needs\nnpm install livekit-client`,
    },
    {
      title: 'Wrap your site once',
      body: 'Every service hook works anywhere inside the provider.',
      file: 'app/layout.tsx',
      code: `import { StsProvider } from '@sts-ai/sdk/react'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <StsProvider
          apiBase={process.env.NEXT_PUBLIC_STS_AI_URL!}
          siteKey={process.env.NEXT_PUBLIC_STS_SITE_KEY!}
        >
          {children}
        </StsProvider>
      </body>
    </html>
  )
}`,
    },
  ]
}

const CHAT_POPUP = `import { useState } from 'react'
import { useStsChat, useStsInfo } from '@sts-ai/sdk/react'

// Your own pop-up. The SDK only gives you state and actions.
export function ChatPopup() {
  const { messages, send, status, greeting, suggestions } = useStsChat()
  const chat = useStsInfo().info?.services.chat // name, accent, placeholder…
  const [text, setText] = useState('')

  return (
    <div className="my-chat" style={{ ['--accent' as string]: chat?.accent }}>
      <header>{chat?.assistantName}</header>
      <p>{greeting}</p>
      {messages.map((m) => <p key={m.id} data-role={m.role}>{m.content}</p>)}
      {suggestions.map((s) => <button key={s} onClick={() => send(s)}>{s}</button>)}
      <form onSubmit={(e) => { e.preventDefault(); send(text); setText('') }}>
        <input value={text} placeholder={chat?.inputPlaceholder}
               onChange={(e) => setText(e.target.value)} />
        <button disabled={status === 'thinking'}>Send</button>
      </form>
    </div>
  )
}`

const CALL_BUTTON = `import { useStsInfo, useStsSpeak } from '@sts-ai/sdk/react'

export function CallButton() {
  const { state, start, stop, isAgentSpeaking } = useStsSpeak()
  const speak = useStsInfo().info?.services.speak // button label, call limit…
  return state === 'idle' || state === 'ended'
    ? <button onClick={() => start()}>{speak?.callButtonLabel ?? 'Talk to us'}</button>
    : <button onClick={stop}>{isAgentSpeaking ? 'Speaking…' : 'Listening…'} — End</button>
}`

const CALLBACK_FORM = `import { useStsForm } from '@sts-ai/sdk/react'

export function CallbackForm() {
  const { form, values, setValue, consent, setConsent, submit, status, message } = useStsForm()
  if (!form) return null
  if (status === 'success') return <p>{message}</p>

  return (
    <form data-theme={form.theme} style={{ ['--accent' as string]: form.accent }}
          onSubmit={(e) => { e.preventDefault(); submit() }}>
      <h3>{form.title}</h3>
      {form.fields.map((f) => (
        <label key={f.id}>{f.label}
          <input required={f.required} placeholder={f.placeholder} value={values[f.id] ?? ''}
                 onChange={(e) => setValue(f.id, e.target.value)} />
        </label>
      ))}
      {form.consentText && (
        <label><input type="checkbox" checked={consent}
                      onChange={(e) => setConsent(e.target.checked)} /> {form.consentText}</label>
      )}
      <button disabled={status === 'submitting'}>{form.submitLabel}</button>
    </form>
  )
}`

const TOUR_BUTTON = `import { useStsWizard } from '@sts-ai/sdk/react'

export function TourButton() {
  const { start, stop, playing, caption } = useStsWizard()
  return (
    <>
      <button onClick={playing ? stop : start}>{playing ? 'Stop tour' : 'Take the tour'}</button>
      {playing && <p className="my-caption">{caption}</p>}
    </>
  )
}`

const SERVICE_MENU = `import { useStsBusiness } from '@sts-ai/sdk/react'

// Products from Projects arrive on their own (with their links);
// services are what you list on the Menu page.
export function ServiceMenu() {
  const business = useStsBusiness().business
  if (!business?.site) return null // publish first

  return (
    <section>
      {business.offers.map((offer) => (
        <article key={offer.primaryUrl}>
          <h3>{offer.title}</h3>
          <p>{offer.description}</p>
          <a href={offer.primaryUrl}>Get started</a>
          {offer.links.pay && <a href={offer.links.pay}>Buy now</a>}
        </article>
      ))}
      {business.site.services.map((service) => (
        <article key={service.id}>
          <h3>{service.name}</h3>
          <p>{service.summary}</p>
          {service.price && <strong>{service.price}</strong>}
        </article>
      ))}
    </section>
  )
}`

const DOC_CHECKLIST = `import { useStsBusiness } from '@sts-ai/sdk/react'

// Every document you list on Docs, or only those "Used for" one service.
export function DocChecklist({ serviceId }: { serviceId?: string }) {
  const site = useStsBusiness().business?.site
  const docs = (site?.docs ?? []).filter((doc) => !serviceId || doc.serviceIds.includes(serviceId))
  if (!docs.length) return null

  return (
    <ul>
      {docs.map((doc) => (
        <li key={doc.id}>
          {doc.name} {doc.formCode && <code>{doc.formCode}</code>}
          {doc.pdfUrl && <a href={doc.pdfUrl} download>PDF</a>}
        </li>
      ))}
    </ul>
  )
}`

const LINK_HUB = `import { useStsBusiness } from '@sts-ai/sdk/react'

export function LinkHub() {
  const site = useStsBusiness().business?.site
  if (!site) return null

  return (
    <nav aria-label={site.social.followLabel}>
      {site.social.accounts.map((account) => (
        <a key={account.id} href={account.url} target="_blank" rel="noopener">
          {account.platform} · @{account.handle}
        </a>
      ))}
    </nav>
  )
}`

const LINK_IN_BIO = `import { LinkHub } from '@/components/LinkHub'
import { ServiceMenu } from '@/components/ServiceMenu'

// Put yoursite.com/links in your Instagram and TikTok bio.
export default function LinksPage() {
  return (
    <main>
      <LinkHub />
      <ServiceMenu />
    </main>
  )
}`

const CONTACT_CARD = `import { useStsBusiness } from '@sts-ai/sdk/react'

export function ContactCard() {
  const contact = useStsBusiness().business?.site?.footer
  if (!contact) return null
  const whatsapp = contact.phone.replace(/\\D/g, '')
  const map = contact.mapUrl || \`https://maps.google.com/?q=\${encodeURIComponent(contact.address)}\`

  return (
    <aside>
      {contact.phone && <a href={\`tel:\${contact.phone}\`}>Call {contact.phone}</a>}
      {whatsapp && <a href={\`https://wa.me/\${whatsapp}\`}>WhatsApp</a>}
      {contact.email && <a href={\`mailto:\${contact.email}\`}>{contact.email}</a>}
      {contact.address && <a href={map}>{contact.address}</a>}
      {contact.hours && <p>{contact.hours}</p>}
      {contact.credentials.map((badge) => <span key={badge}>{badge}</span>)}
    </aside>
  )
}`

const CONTACT_FOOTER = `import { useStsBusiness } from '@sts-ai/sdk/react'

export function Footer() {
  const contact = useStsBusiness().business?.site?.footer
  if (!contact) return null
  return (
    <footer>
      <p>{contact.tagline}</p>
      {contact.privacyUrl && <a href={contact.privacyUrl}>Privacy</a>}
      {contact.termsUrl && <a href={contact.termsUrl}>Terms</a>}
      <small>{contact.copyright}</small>
    </footer>
  )
}`

const LIVE_SESSIONS = `import { useEffect, useState } from 'react'
import { useStsBusiness, type StsLiveSession } from '@sts-ai/sdk/react'

function useCountdown(iso: string) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const ms = new Date(iso).getTime() - now
  if (ms <= 0) return null
  const days = Math.floor(ms / 86_400_000)
  const hours = Math.floor(ms / 3_600_000) % 24
  const minutes = Math.floor(ms / 60_000) % 60
  const seconds = Math.floor(ms / 1000) % 60
  return \`\${days}d \${hours}h \${minutes}m \${seconds}s\`
}

function Session({ session, joinLabel }: { session: StsLiveSession; joinLabel: string }) {
  const countdown = useCountdown(session.startsAt)
  return (
    <article>
      <h3>{session.title}</h3>
      <p>{new Date(session.startsAt).toLocaleString()}</p>
      <strong>{session.status === 'live' ? 'Live now' : countdown ?? 'Starting soon'}</strong>
      <a href={session.joinUrl}>{joinLabel}</a>
      {session.shareUrl && <a href={session.shareUrl}>Save a seat</a>}
    </article>
  )
}

// Upcoming webinars from Projects, soonest first, as your Live settings allow.
export function LiveSessions() {
  const business = useStsBusiness().business
  const live = business?.live ?? []
  const settings = business?.site?.live
  if (!live.length || !settings) return null
  return (
    <section>
      <h2>{settings.title}</h2>
      {live.map((session) => (
        <Session key={session.slug} session={session} joinLabel={settings.joinLabel} />
      ))}
    </section>
  )
}`

const LIVE_NEXT = `import { useStsBusiness } from '@sts-ai/sdk/react'

// Just the next session, for your hero or a top bar.
export function NextLive() {
  const next = useStsBusiness().business?.live[0]
  if (!next) return null
  return (
    <a href={next.joinUrl}>
      {next.status === 'live' ? 'Live now: ' : 'Next live: '}
      {next.title}
    </a>
  )
}`

/** Services → <service> → Integrate: three steps that only place this service. */
export function serviceGuide(service: GuideService, hostedUrl: string): GuideStep[] {
  switch (service) {
    case 'chat':
      return [
        { title: 'Build the chat pop-up', body: 'Headless hook: your designer owns the look.', file: 'components/ChatPopup.tsx', code: CHAT_POPUP },
        {
          title: 'Mount it once in your layout',
          body: 'Floats on every page, bottom right.',
          file: 'app/layout.tsx',
          code: `import { ChatPopup } from '@/components/ChatPopup'\n\n// inside <StsProvider>\n{children}\n<div className="fixed bottom-6 right-6 z-50">\n  <ChatPopup />\n</div>`,
        },
        {
          title: 'Or just link the chat page',
          body: 'No code: a button that opens your hosted chat.',
          file: 'components/ChatLink.tsx',
          code: `<a href="${hostedUrl}" target="_blank" rel="noopener">\n  Chat with us\n</a>`,
        },
      ]
    case 'speak':
      return [
        { title: 'Build the call button', body: 'Start, stop and speaking state from the hook.', file: 'components/CallButton.tsx', code: CALL_BUTTON },
        {
          title: 'Put it in your header or hero',
          body: 'Where visitors look for "Call us".',
          file: 'components/Header.tsx',
          code: `import { CallButton } from '@/components/CallButton'\n\nexport function Header() {\n  return (\n    <header>\n      <Logo />\n      <nav>…</nav>\n      <CallButton />\n    </header>\n  )\n}`,
        },
        {
          title: 'Or just link the call page',
          body: 'No code: opens your hosted voice call.',
          file: 'components/CallLink.tsx',
          code: `<a href="${hostedUrl}" target="_blank" rel="noopener">\n  Talk to us\n</a>`,
        },
      ]
    case 'form':
      return [
        { title: 'Build the form', body: 'Questions, consent and submit come from the hook.', file: 'components/CallbackForm.tsx', code: CALLBACK_FORM },
        {
          title: 'Place it in your footer or contact section',
          body: 'Answers are emailed to you.',
          file: 'components/Footer.tsx',
          code: `import { CallbackForm } from '@/components/CallbackForm'\n\nexport function Footer() {\n  return (\n    <footer id="contact">\n      <h2>Request a callback</h2>\n      <CallbackForm />\n    </footer>\n  )\n}`,
        },
        {
          title: 'Or link the hosted form',
          body: 'One question per screen, full page.',
          file: 'components/FormLink.tsx',
          code: `<a href="${hostedUrl}" target="_blank" rel="noopener">\n  Request a callback\n</a>`,
        },
      ]
    case 'tour':
      return [
        {
          title: 'Tag the sections the guide visits',
          body: 'Use each step’s Website section name.',
          file: 'app/page.tsx',
          code: `<section data-sts-step="pricing">…</section>\n<section data-sts-step="testimonials">…</section>\n<section data-sts-step="contact">…</section>`,
        },
        { title: 'Add the tour button', body: 'The guide scrolls to each section while it speaks.', file: 'components/TourButton.tsx', code: TOUR_BUTTON },
        {
          title: 'Put it in your hero',
          body: 'Or link the hosted tour instead.',
          file: 'components/Hero.tsx',
          code: `import { TourButton } from '@/components/TourButton'\n\n<TourButton />\n\n// No code:\n<a href="${hostedUrl}" target="_blank" rel="noopener">Take the tour</a>`,
        },
      ]
    case 'live':
      return [
        { title: 'List your live sessions', body: 'Each one with a countdown and a Join button.', file: 'components/LiveSessions.tsx', code: LIVE_SESSIONS },
        { title: 'Show the next one', body: 'A single link for your hero or a top bar.', file: 'components/NextLive.tsx', code: LIVE_NEXT },
        {
          title: 'Or link your hosted page',
          body: 'Each session also has its own live link with a waiting room.',
          file: 'components/LiveLink.tsx',
          code: `<a href="${hostedUrl}" target="_blank" rel="noopener">\n  Join us live\n</a>`,
        },
      ]
    case 'menu':
      return [
        { title: 'Show your Menu', body: 'Your products and services, with order links.', file: 'components/ServiceMenu.tsx', code: SERVICE_MENU },
        {
          title: 'Or link the hosted site',
          body: 'Your services are on your hosted page too.',
          file: 'components/SiteLink.tsx',
          code: `<a href="${hostedUrl}" target="_blank" rel="noopener">\n  See our services\n</a>`,
        },
      ]
    case 'docs':
      return [
        { title: 'Add your Docs', body: 'Your forms and PDFs, all or for one service.', file: 'components/DocChecklist.tsx', code: DOC_CHECKLIST },
        { title: 'Show it under each service', body: 'Next to the service on your menu.', file: 'components/ServiceMenu.tsx', code: `import { DocChecklist } from '@/components/DocChecklist'\n\n<article>\n  <h3>{service.name}</h3>\n  <DocChecklist serviceId={service.id} />\n</article>` },
      ]
    case 'links':
      return [
        { title: 'Show your Links', body: 'Every social account you list here.', file: 'components/LinkHub.tsx', code: LINK_HUB },
        { title: 'Make a link-in-bio page', body: 'One link for Instagram and TikTok bios.', file: 'app/links/page.tsx', code: LINK_IN_BIO },
      ]
    case 'contact':
      return [
        { title: 'Add your Contact', body: 'Tap to call, WhatsApp, map, hours and trust badges.', file: 'components/ContactCard.tsx', code: CONTACT_CARD },
        { title: 'Fill your footer', body: 'Tagline, legal links and copyright.', file: 'components/Footer.tsx', code: CONTACT_FOOTER },
      ]
  }
}
