# @sts-ai/sdk

Every sts-ai service on **your own website, in your own design**: Chat AI, Voice AI, Form, Tour
and your business details. The package gives you state and actions only; your designer draws
every button, pop-up, orb and form, so nothing clashes with your site. Works with **React**,
**Vue / Nuxt** and **plain JavaScript**. Voice (LiveKit) is included.

## Setup: one command

Run this inside your website's folder and approve once in the browser:

```bash
npx @sts-ai/cli init
```

It makes your website's key behind the scenes, allows your domain, installs this package and
wires it into your site (Next.js: `app/layout.tsx`; Nuxt: `plugins/sts-ai.client.ts`). Which
services show (Chat, Voice, Form, Tour) is switched in the sts-ai app, not in code.

<details>
<summary>By hand instead</summary>

```bash
npm install @sts-ai/sdk
```

React / Next.js:

```tsx
import { StsProvider } from '@sts-ai/sdk/react'

<StsProvider apiBase="https://sudotechserve.com" siteKey={process.env.NEXT_PUBLIC_STS_SITE_KEY!}>
  {children}
</StsProvider>
```

Vue / Nuxt (`plugins/sts-ai.client.ts`):

```ts
import { createStsPlugin } from '@sts-ai/sdk/vue'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(createStsPlugin({ apiBase: 'https://sudotechserve.com', siteKey: 'sts_pk_live_…' }))
})
```

The site key is publishable (it only works on the website URLs you allow), so it is fine in
client code.
</details>

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
| `useStsWizard()` | `ready, start(), follow(), play(step), unlock(), savedSound(), rememberSound('on' \| 'off'), stop(), playing, speaking, step, stepIndex, caption, muted, setMuted` |

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

## Vue / Nuxt

The same services as composables; every value is a ref.

```vue
<script setup lang="ts">
import { useStsSpeak } from '@sts-ai/sdk/vue'
const { state, start, stop, agentLevel } = useStsSpeak()
</script>

<template>
  <!-- your own orb: it grows with the AI's voice -->
  <button class="orb" :style="{ transform: `scale(${1 + agentLevel * 0.4})` }" @click="state === 'live' ? stop() : start()">
    {{ state === 'live' ? 'End call' : 'Talk to us' }}
  </button>
</template>
```

`useStsChat()`, `useStsSpeak()`, `useStsForm()`, `useStsWizard()`, `useStsBusiness()`,
`useStsAnswers()`, `useStsReviews()` and `useStsInfo()` return the same fields as the React hooks.

## Tour from your own events

Play one step whenever your page wants, by its id or its `data-sts-step` name:

```ts
const tour = useStsWizard()               // React or Vue
button.addEventListener('click', () => tour.unlock())   // one click first: browsers need it for sound
window.addEventListener('pricing-open', () => tour.play('pricing'))
```

## Without a framework

```ts
import { createSts, createChat, createVoice, createForm, createWizardPlayer } from '@sts-ai/sdk'

const sts = createSts({ apiBase: 'https://sudotechserve.com', siteKey: 'sts_pk_live_…' })

const chat = createChat(sts)
chat.subscribe((state) => renderMessages(state.messages))   // your own chat box
await chat.send('Hi!')

const voice = createVoice(sts)
voice.subscribe((state) => orb.style.setProperty('--level', String(state.agentLevel)))
orbButton.addEventListener('click', () => voice.start())

const { services } = await sts.info()
const tour = createWizardPlayer(await sts.wizard.load(services.wizards[0].slug))
document.addEventListener('scroll-into-pricing', () => tour.play('pricing'))
```

## Security

The site key is publishable: it only works from the website URLs you allow. The SDK swaps it for a 15-minute session token, and every call is rate-limited with daily caps per business.
