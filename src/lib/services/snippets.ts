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

export type GuideService = 'chat' | 'speak' | 'form' | 'tour' | 'business'

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

const BUSINESS_SERVICES = `import { useStsBusiness } from '@sts-ai/sdk/react'

// Everything you publish on the Business page: SEO, services,
// key dates, socials, footer and your look settings.
export function Services() {
  const { business } = useStsBusiness()
  const site = business?.site // null until you publish
  if (!site) return null

  return (
    <section style={{ ['--accent' as string]: site.appearance.accent }}>
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
    case 'business':
      return [
        { title: 'Show your services', body: 'Reads what you publish here.', file: 'components/Services.tsx', code: BUSINESS_SERVICES },
        {
          title: 'Fill your footer',
          body: 'Email, tagline, socials and legal links.',
          file: 'components/Footer.tsx',
          code: `import { useStsBusiness } from '@sts-ai/sdk/react'\n\nexport function Footer() {\n  const site = useStsBusiness().business?.site\n  if (!site) return null\n  return (\n    <footer>\n      <p>{site.footer.tagline}</p>\n      <a href={\`mailto:\${site.footer.email}\`}>{site.footer.email}</a>\n      <small>{site.footer.copyright}</small>\n    </footer>\n  )\n}`,
        },
        {
          title: 'Or link the hosted site',
          body: 'Your business page, ready to share.',
          file: 'components/SiteLink.tsx',
          code: `<a href="${hostedUrl}" target="_blank" rel="noopener">\n  Visit our page\n</a>`,
        },
      ]
  }
}
