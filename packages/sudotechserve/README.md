# @sts-ai/sudotechserve

Embed your STS-AI business room on a creator Next.js website.

## Install

```bash
npm install @sts-ai/sudotechserve livekit-client
```

## Setup (STS-AI dashboard)

1. Open **Messages → your room → Website Embed**
2. Add allowed domain (e.g. `https://primeone.com`)
3. Save and copy the **site key** (`sts_pk_live_...`)

## Creator site `.env`

```env
NEXT_PUBLIC_STS_AI_URL=https://your-sts-ai.com
NEXT_PUBLIC_STS_SITE_KEY=sts_pk_live_...
NEXT_PUBLIC_STS_ROOM_NAME=your-room-name
```

## Usage

```tsx
import { StsAiRoom } from '@sts-ai/sudotechserve'

export function SupportSection() {
  return (
    <section className="h-[520px] w-full">
      <StsAiRoom
        apiBase={process.env.NEXT_PUBLIC_STS_AI_URL!}
        siteKey={process.env.NEXT_PUBLIC_STS_SITE_KEY!}
        roomName={process.env.NEXT_PUBLIC_STS_ROOM_NAME!}
        embedMode
        defaultTab="voice"
      />
    </section>
  )
}
```

## Architecture

- **This package** — AI room UI (chat, voice, callback form)
- **MCP + server proxy** — business content on your pages (services, pricing)
- **STS-AI APIs** — AI brain, prompts, Gemini, LiveKit (never exposed to browser)

## API client only

```ts
import { createStsAiClient } from '@sts-ai/sudotechserve'

const client = createStsAiClient({
  apiBase: process.env.NEXT_PUBLIC_STS_AI_URL!,
  siteKey: process.env.NEXT_PUBLIC_STS_SITE_KEY!,
  roomName: 'my-room',
})

const bootstrap = await client.bootstrap()
const reply = await client.sendChat('Hello', 'session-id')
```
