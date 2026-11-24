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
| `useStsChat()` | `available, greeting, suggestions, documentRequests, messages, send(text), attach(file, documentId?), reset(), status, error` |
| `useStsSpeak()` | `state ('idle' \| 'connecting' \| 'live' \| 'ended' \| 'error'), start(), stop(), isAgentSpeaking, muted, setMuted(bool), captions, agentLevel, error` |
| `useStsForm()` | `form, values, setValue(id, v), consent, setConsent, submit(), status, message, fieldError` |
| `useStsWizard()` | `ready, start(), follow(), savedSound(), rememberSound('on' \| 'off'), stop(), playing, speaking, step, stepIndex, caption, muted, setMuted` |

### Chat: the attach button

When the chat assistant is set to ask for documents (AI agents → chat assistant → Documents),
`documentRequests` is not empty. Show your own attach button and pass the file to `attach()`.
The file goes to the business's Google Drive and the assistant confirms it arrived.

```tsx
const { documentRequests, attach } = useStsChat()
{documentRequests.length > 0 && (
  <input type="file" accept="application/pdf,image/*" onChange={(e) => e.target.files?.[0] && attach(e.target.files[0])} />
)}
```

### Voice: mute, captions and the sound level

`setMuted(true)` mutes the visitor's microphone. `captions` holds the last lines of the call
(`speaker: 'agent' | 'visitor'`, `final` once a line is complete). `agentLevel` goes from 0 to 1
about ten times a second: use it to animate an orb or bars.

### Tour that follows the visitor's scroll

`start()` lets the tour lead: it scrolls to each section and narrates it. `follow()` lets the
visitor lead: nothing scrolls, and each `[data-sts-step]` section speaks once when it reaches the
middle of the screen. Browsers need one click before sound, so call `follow()` from your
"Sound on" button the first time, and save the answer with `rememberSound()`:

```tsx
const tour = useStsWizard()
useEffect(() => {
  if (tour.ready && tour.savedSound() === 'off') { tour.setMuted(true); tour.follow() }
}, [tour.ready])
<button onClick={() => { tour.rememberSound('on'); tour.follow() }}>Sound on</button>
```

On a site that changes pages without reloading, call `follow()` again after each page change.
| `useStsBusiness()` | `business { name, description, profile }` |
| `useStsAnswers()` | `answers [{ question, answer }], ready, error`: the business's own answers, for an FAQ block |
| `useStsReviews()` | `reviews [{ name, rating, text, date }], ready, error`: reviews the business chose to show |
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
