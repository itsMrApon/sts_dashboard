/** Copy-paste SDK snippets shown on each service's Integrate tab. */

export function providerSnippet(appUrl: string): string {
  return `// 1. npm install @sts-ai/sdk
// 2. Wrap your site once (e.g. app/layout.tsx)
import { StsProvider } from '@sts-ai/sdk/react'

<StsProvider apiBase="${appUrl}" siteKey={process.env.NEXT_PUBLIC_STS_SITE_KEY!}>
  {children}
</StsProvider>`
}

export const SERVICE_SNIPPETS = {
  chat: `import { useState } from 'react'
import { useStsChat, useStsInfo } from '@sts-ai/sdk/react'

// Your own button + pop-up. The SDK only gives you state and actions.
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
}`,
  speak: `import { useStsInfo, useStsSpeak } from '@sts-ai/sdk/react'
// npm install livekit-client   (voice runs over WebRTC)

export function CallButton() {
  const { state, start, stop, isAgentSpeaking } = useStsSpeak()
  const speak = useStsInfo().info?.services.speak // button label, call limit…
  return state === 'idle' || state === 'ended'
    ? <button onClick={() => start()}>{speak?.callButtonLabel ?? 'Talk to us'}</button>
    : <button onClick={stop}>{isAgentSpeaking ? 'Speaking…' : 'Listening…'} — End</button>
}`,
  form: `import { useStsForm } from '@sts-ai/sdk/react'

export function CallbackForm() {
  const { form, values, setValue, consent, setConsent, submit, status, message } = useStsForm()
  if (!form) return null
  if (status === 'success') {
    if (form.redirectUrl) window.location.assign(form.redirectUrl)
    return <p>{message}</p>
  }

  return (
    <form data-theme={form.theme} style={{ ['--accent' as string]: form.accent }}
          onSubmit={(e) => { e.preventDefault(); submit() }}>
      <h3>{form.title}</h3>
      {form.fields.map((f) => (
        <label key={f.id}>{f.label}
          <input required={f.required} placeholder={f.placeholder} value={values[f.id] ?? ''}
                 onChange={(e) => setValue(f.id, e.target.value)} />
          {f.helpText && <small>{f.helpText}</small>}
        </label>
      ))}
      {form.consentText && (
        <label><input type="checkbox" checked={consent}
                      onChange={(e) => setConsent(e.target.checked)} /> {form.consentText}</label>
      )}
      <button disabled={status === 'submitting'}>{form.submitLabel}</button>
      {status === 'error' && <p>{message}</p>}
    </form>
  )
}`,
  wizard: () => `import { useStsWizard } from '@sts-ai/sdk/react'

// Tag the sections the guide should visit:
//   <section data-sts-step="pricing">…</section>
export function TourButton() {
  const { start, stop, playing, caption } = useStsWizard()
  return (
    <>
      <button onClick={playing ? stop : start}>{playing ? 'Stop tour' : 'Take the tour'}</button>
      {playing && <p className="my-caption">{caption}</p>}
    </>
  )
}`,
} as const
