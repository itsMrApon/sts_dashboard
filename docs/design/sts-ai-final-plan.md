# sts-ai final plan

Status: plan, one part built. Written 2026-11-24.
Visual version: the "sts-ai app map" artifact.

## The idea in one line

Every conversation a creator's AI has with customers is saved. Once a week the questions are
grouped inside each project, the creator answers once, every agent reuses the answer, and every
lead shows what brought it.

## Rules that hold everywhere

- One room is one business. Projects are offers inside the room and share its services.
- Services work on the creator's own website through `@sts-ai/sdk`, with no built-in look, or on
  the one hosted page `/business/[room]`.
- Creators bring their own keys and numbers (AI, speech, Twilio, WhatsApp, Instagram, Serper,
  Fathom, DataForSEO), so those costs are theirs.
- No cron routes. Scheduled and long work runs in trigger.dev (self-hosted).
- Bangla text is kept as typed, end to end.

## Pages

| Section | Today | Changes |
|---|---|---|
| Header button | "+ Add service" opens /projects?new=1 | Open: turn it into Import, or remove it |
| Home | Welcome, onboarding | Small cards: new questions, hot leads, today's briefs |
| AI agents | One assistant per service | "Ask for documents" (for example a receipt). Agents use approved answers |
| Services | AI services and site content | AI: Chat, Voice, Form, Tour. Blocks: Menu, Docs, Live, Links, Contact, plus new Reviews and Answers. Menu items get Ask about this, Book a call, Pay now |
| Projects | Offer page, chat, pipeline | Questions tab per project. General questions on /projects |
| Lead | List, imports, calendar briefs, scoring | Source on every lead. Instagram and WhatsApp labels. Links to uploaded files. The empty Video page goes |
| Integrations | Flat grid | Grouped by how a tool connects. New: Instagram, WhatsApp, OpenSEO preset, one webhook address, Google Drive permission |
| Settings | Account | "Use customer questions for public answers", off by default |

## Public pages

- `/business/[room]`: the one room. **Built** (see below).
- `/o/[slug]`, `/live/[slug]`, `/pay/[slug]`: stay, they belong to one project or payment.
- `/chat`, `/speak`, `/form`: **built** as redirects to `/business/[room]#chat`, `#talk`, `#form`.
- `/wizard/[slug]`: a published business tour **redirects** to `/business/[room]#tour`. Drafts and
  product tours still play on their own page.

## Built: the business room (2026-11-24)

Files:
- `src/app/(publicRoutes)/business/[roomName]/page.tsx`: loads the tour, panels and pay link. The
  room still opens when services are on but the site is not published.
- `src/app/(publicRoutes)/business/[roomName]/_components/BusinessRoom.tsx`: intro card, scroll
  tour, captions, action bar, panels.
- `BusinessSite.tsx`: sections tagged `data-sts-step` = `intro`, `offers`, `services`, `dates`,
  `social`, `contact`. Hero buttons open panels (`#chat`, `#talk`, `#form`, `#tour`).
- `src/lib/public/publicService.ts`: every service link now points into the room.

How it behaves:
1. First visit, when the business has a published tour: an intro card with Start (or Enter) and
   Sound on or off. "Skip the tour" is remembered too.
2. The choice is saved per room in the browser. Returning visitors skip the card; with sound on,
   their first tap turns the voice on (browser rule).
3. Each tagged section plays its step when it sits in the middle of the screen for 0.6 s. A step
   whose `target` names a section goes there; the others fill sections in page order.
4. Each step plays once per visit. A new section stops the one before it.
5. Opening Chat, Talk or Book a call stops the narration.
6. The bar: Chat, Talk, Book a call, Pay now (featured offer's payment link), restart tour, voice
   on or off.

Not checked yet: the tour itself, because no business has a published tour in the database.

## Website connection (SDK)

- Tour: the same visitor-led behaviour as the room, in `packages/sdk/src/wizardPlayer.ts`, with
  steps grouped by page address.
- Voice: already headless (`useStsSpeak`). Add mute, live captions and a sound level.
- Chat: `attach(file)` for requested documents, saved to the creator's Google Drive
  (`drive.file` permission; creators reconnect Google once).
- Form: save submissions (the `FormSubmission` table is unused today), branded email (maily.to),
  auto-reply to the visitor with an optional PDF (pdfcn).
- New blocks served to websites: `useStsAnswers()`, `useStsReviews()`.

## Questions loop

1. Conversations are saved with their room, and with their project when they happen there.
2. Insights worker (Python, FastAPI): remove personal details (Presidio), group questions in
   Bangla and English (pgvector, BERTopic), name groups with Gemini.
3. Questions tab: count, real examples, where people went quiet.
4. Creator: Answer it, Reply to the people who asked, or Make it a new project.
5. Fix first: `getTopObjections` counts exact wording and no page shows it.

## Channels

- Instagram comments to leads: built into sts-ai from OpenReply's ideas and MIT code. Plan:
  `docs/design/instagram-comment-leads.md`. Its every-minute cron becomes trigger.dev jobs.
- WhatsApp: `@kapso/whatsapp-cloud-api` (MIT, pin the version). Creator connects with a Kapso key
  or a Meta token. Use only standard Meta calls so leaving Kapso is a config change. Outside the
  24-hour window only approved templates; marketing needs opt-in.
- Telegram and phone: as today.

## trigger.dev jobs

Replace `src/app/api/cron/lead-intel/route.ts` and its `vercel.json` entry:
- On lead created: default agent, research. On Fathom webhook: score the meeting.
- Daily: calendar briefs, Maps batch. Weekly: Fathom safety sync, question groups.

New jobs: webinar reminders and "replay ready", payment request reminders and expiry, review
requests after a sale, tour clip generation on save, retries for form emails and Drive uploads,
morning summary on Telegram, Google connection health, Instagram and WhatsApp send queues and
token refresh, cleanup of rate-limit rows and expired sessions.

## Tools by how they connect

- Connect live (tunnel): OpenSEO, Medusa and ERPNext (optional), n8n.
- Sends to sts-ai (webhook): n8n, OpenSign.
- Import and export (file): Sellbird, yogurt, Twenty.
- Built in: Instagram, WhatsApp, MCP SDK, pdfcn, maily.to, pgvector, BERTopic, Presidio,
  trigger.dev.
- Measure: PostHog cloud free tier.
- Later: listmonk, Postiz.
- Dropped: browser-use, cal.diy, Chatwoot, OpenWA, iris, Formbricks, Mautic, ringee,
  call-center-ai, OpenViking, Univer, Motionsites, HyperFrames, Vapi (no code uses it).
- Undecided: webinar clips (AutoClip, faster-whisper and the video tools only matter if kept).

## Costs (yours, without the server; checked November 2026)

Neon free plan, Clerk free to 50,000 retained users, LiveKit Cloud 1,000 free agent minutes,
Stream $100 free usage a month, PostHog cloud 1 million free events, trigger.dev self-hosted free,
Stripe per payment only. Move only when something grows, in this order: LiveKit Cloud to
self-hosted LiveKit, Stream to LiveKit webinars, Neon to Postgres on your server.

## Build order

1. Measure: conversations per channel, leads per week for five pilot creators.
2. Integrations: regroup, webhook address, file imports, MCP SDK, OpenSEO preset, Drive
   permission, trigger.dev in place of the cron route.
3. Website connection: SDK scroll tour, Voice captions and mute, chat attach, form saving.
4. One business page: **done**. Next: Reviews and Answers blocks on it.
5. Questions: insights worker, Questions tab, General questions, reusable answers.
6. Channels: Instagram phases 1 to 4, WhatsApp.
7. Website blocks: Answers, Reviews, Menu buttons, Docs PDFs, link tags, business details for
   Google, lead source.
8. Prove it: analytics funnels, Search Console, Stripe revenue per answer.

## Open decisions

- Header button: Import or remove.
- Webinar clips: keep or drop.
- Tour replay: does scrolling back replay a section (today: no), and does a clip finish when the
  visitor scrolls away (today: it stops when the next section starts).
