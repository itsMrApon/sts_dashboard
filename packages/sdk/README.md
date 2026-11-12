# @sts-ai/sdk

One headless SDK for every STS-AI website service: **Chat AI, Speak AI, Form, Wizard** and **business details**.
It gives you state and actions only. Your designer builds every button, pop-up and chat box, so nothing clashes with your site.

## Setup

1. In STS-AI → **Messages → Overview → Website & SDK**: add your website URL and copy the site key (`sts_pk_live_…`).
2. Turn on the services you want (Messages → Chat AI / Speak AI / Form / Wizard).
3. Install the SDK:

```bash
npm install @sts-ai/sdk
npm install livekit-client   # only if you use Speak AI
```

```tsx
// app/layout.tsx
import { StsProvider } from '@sts-ai/sdk/react'

<StsProvider apiBase="https://your-sts-ai-app.com" siteKey={process.env.NEXT_PUBLIC_STS_SITE_KEY!}>
  {children}
</StsProvider>
```

## Example: your own pop-up button with Chat AI

```tsx
'use client'
import { useState } from 'react'
import { useStsChat } from '@sts-ai/sdk/react'

export function ChatBubble() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const { available, greeting, suggestions, messages, send, status } = useStsChat()
  if (!available) return null

  return (
    <>
      <button className="my-fab" onClick={() => setOpen(!open)}>Chat</button>
      {open && (
        <div className="my-popup">
          <p>{greeting}</p>
          {messages.map((m) => <p key={m.id} className={m.role}>{m.content}</p>)}
          {messages.length === 0 && suggestions.map((s) => <button key={s} onClick={() => send(s)}>{s}</button>)}
          <form onSubmit={(e) => { e.preventDefault(); send(text); setText('') }}>
            <input value={text} onChange={(e) => setText(e.target.value)} />
            <button disabled={status === 'thinking'}>Send</button>
          </form>
        </div>
      )}
    </>
  )
}
```

## Hooks

| Hook | Returns |
|---|---|
| `useStsChat()` | `available, greeting, suggestions, messages, send(text), reset(), status, error` |
| `useStsSpeak()` | `state ('idle' \| 'connecting' \| 'live' \| 'ended' \| 'error'), start(), stop(), isAgentSpeaking, error` |
| `useStsForm()` | `form, values, setValue(id, v), consent, setConsent, submit(), status, message, fieldError` |
| `useStsWizard()` | `ready, start(), stop(), playing, speaking, step, stepIndex, caption, muted, setMuted` |
| `useStsBusiness()` | `business { name, description, profile }` |
| `useStsInfo()` | business name + which services are on |

### Wizard on your page

Tag sections, then style the active one:

```html
<section data-sts-step="pricing">…</section>
<style>[data-sts-active] { outline: 2px solid #6366f1; }</style>
```

Steps whose section isn't on the page are skipped. Audio needs a click to start (browser rule), so call `start()` from a button.

## Without React

```ts
import { createSts } from '@sts-ai/sdk'

const sts = createSts({ apiBase: 'https://your-sts-ai-app.com', siteKey: 'sts_pk_live_…' })
const { services } = await sts.info()
const { reply } = await sts.chat.send('Hi!')
await sts.form.submit({ name: 'Rahim', phone: '+8801…' }, true)
```

## Security

The site key is publishable: it only works from the website URLs you allow. The SDK swaps it for a 15-minute session token, and every call is rate-limited with daily caps per business.
