# Social: plan

Status: v1 built (2026-11-25). Replaces the earlier Instagram / WhatsApp / Video plan.

**Social is a library the creator copies into their own AI agent.** Instagram and WhatsApp
connections stay in Integrations. Social holds skills, prompts, n8n workflows, plugins and
reports for social media work. The creator opens a card, sees how it works as a diagram, and
copies a prompt into Claude Code, Codex or Cursor. Their agent then builds the video, post,
flyer, poster or report, using the creator's own apps, workflows and sts-ai business brain.

## Layout

- `/social`: the same folder tray as Lead → Intel, six folders: **Skills, Prompts, Workflows,
  Plugins, Reports, Saved**. Click opens that part of the library. Under it: the one-time
  agent setup command (`npx --yes @sts-ai/cli@1.0 init --client claude|codex|cursor --write`)
  and three cards to start with.
- `/social/<all|skills|prompts|workflows|plugins|reports|saved>`: the gallery, like
  21st.dev. A top menu of kinds (All / Skills / Prompts / …), channel chips, search, and a grid
  of cards. Each card's preview is a diagram (diagram-design style) instead of a screenshot.
- Opening a card: a full-screen preview with the diagram large, **Save** and **Copy prompt**
  (its menu picks the agent and copies the CLI command), what the agent will connect, and the
  full prompt. Arrow keys walk the cards; `?item=` links straight to one.

## Content

| Kind | Count | From |
|---|---|---|
| Skills | 23 | herk-edit-kit, HyperFrames, OpenMontage, marketingskills, AutoClip, OpenFilm, brag, diagram-design |
| Prompts | 18 | written for sts-ai: calendars, carousels, UGC ads (Higgsfield), reviews, posters, Bangla/English |
| Workflows | 130 | Zie619/n8n-workflows (MIT), picked and drawn by `scripts/social/build-n8n-library.mjs` |
| Plugins | 15 | sts-ai MCP, n8n MCP, Postiz, ElevenLabs, Higgsfield, Playwright, Agent-Reach, Notion, Docker + tunnel stack… |
| Reports | 12 | weekly performance, best time to post, competitor teardown, DM funnel, attribution… |

Every prompt starts by connecting the sts-ai business brain (the tenant MCP: core, industry,
social, services, pricing, links), then lists the tools to connect (n8n in Docker, a tunnel,
Higgsfield, a Claude plugin…), the steps and the deliverable. Rules in every prompt: nothing is
posted, sent or paid for without the creator's OK; Bangla stays in Bangla script.

## Code

- Data: `src/lib/social/library/` (types, needs, sources, items/*, `buildPrompt.ts`).
- Diagrams: `src/components/social/SocialDiagram.tsx`, 13 types (flow, fan, loop, steps, funnel,
  layers, sequence, swimlane, quadrant, bars, heatmap, timeline, hub), colours in `.dd-theme`.
- Saves and the chosen agent live in localStorage on the device.
- Refresh workflows: download `docs/api/search-index.json` from Zie619/n8n-workflows and run
  `node scripts/social/build-n8n-library.mjs <file>`.

## sts-ai CLI (`packages/cli`, published as `@sts-ai/cli`)

`npx --yes @sts-ai/cli@1.0 init --client claude|codex|cursor --write`:

1. Device login: `POST /api/cli/login/start` → the creator approves at `/cli/authorize?code=…`
   → the CLI polls `POST /api/cli/login/poll` and gets a token once (`CliLoginRequest`, hashes only).
2. Adds an MCP server `sts-ai` to the agent's private user config (Claude Code `claude mcp add
   --scope user`, Codex `~/.codex/config.toml`, Cursor `~/.cursor/mcp.json`).
3. The agent talks to `/api/mcp/agent` (Streamable HTTP, stateless, read-only) with
   `Authorization: Bearer sts_…` (`CliToken`, sha256 stored). Tools: `get_business_brain`,
   `list_offers`, `list_reviews`.
4. Social → "Connected agents" lists tokens with Disconnect; `sts-ai logout` revokes its own.

Release: deploy the app first (the migration runs on start), then in `packages/cli`:
`npm publish --otp=<code>` (prepublishOnly builds). Bump `version` in package.json and
`src/version.ts` together; `@1.0` in the prompts picks up any 1.0.x.

## Agent bridge (two-way, every page)

The creator's agent reads and asks to change things in any area through one registry:
`src/lib/agentBridge/areas/*.ts` → `registry.ts` → `/api/mcp/agent`.

- **Read tools** answer at once: business brain, offers, reviews, answers, open questions,
  connections and their tools, leads (no contact details), Social library briefs, request status.
- **Write tools** never act directly: `propose_answer`, `propose_business_description`,
  `propose_connection` (secret stored encrypted, never shown), `import_n8n_workflow` (GitHub / n8n.io
  links only), `act_on_connection`. Each becomes an `AgentRequest` in **Lead → Approval** (the
  chatcn approval inbox): Allow, Deny (with a note back to the agent), or Always allow a tool
  (`AgentToolGrant`). The agent checks results with `get_request_status`.
- **A new page plugs in** by adding one file under `areas/` with its read and write tools and
  listing it in `registry.ts`. Nothing else changes: MCP, approvals and the page pick it up.

Lead sections: Intel, Calendar, List, **Message** (was Video; to build), **Approval** (was Diagram).

## Messages (built)

A small purple **Messages** button at the top right of every page (where "+ Add service" was),
with a count of conversations waiting. It opens a curved panel from the right. `/social/message`,
`/lead/message` and any page with `?inbox=1` (or `?inbox=<thread id>`) open it. One inbox, chatcn chat sidebar:
WhatsApp, Instagram (comments, campaign DM, their DMs), website chat, project chats (with voice
calls) and email, each linked to its lead. Filters: All, Waiting, Drafts, per channel.

**The AI never sends.** It writes; the creator clicks Send.
- "Write with AI" in any conversation: Reply, Message, Greeting, New offer, Deadline, plus an
  optional note ("Eid offer 20% till Friday"). Uses the business brain, the conversation and the
  lead's details, in the customer's language. The result is the conversation's draft.
- New email to a lead: write it, or let the AI write a first email / an offer / a greeting.
- AI agents (Claude Code…) write drafts with `draft_reply` / `draft_email_to_lead`: saved at once,
  never sent.
- One draft per conversation (`MessageDraft`, kept out of the chat history so the Chat AI never
  reads it). Send clears it; Discard removes it.
- The customer-facing Chat AI still answers WhatsApp / website chats by itself unless the creator
  takes the chat over (that is the product's assistant, not this composer).
- Channel rules on Send: WhatsApp and Instagram within 24 h of their last message; email from the
  creator's own mailbox. Every message sent is logged on the lead.

## Lead → Approval: lead matches (built) and what comes next

**A match = a lead who needs what you sell.** "Find matches" (in-app AI, creator's Gemini key)
or an agent (`propose_lead_match`) reads open leads (with a real email, not matched in 30 days)
next to the business's offers and knowledge. Each clear fit (60+/100) becomes a card: who, the
offer, why it fits, and a first email. **Allow** puts that email as a draft in Messages;
the creator sends it. Deny (with a note) teaches the next round.

Next kinds of cards, all "the app found a reason to write; you decide":
1. **New offer → interested leads**: you publish an offer; leads whose needs match it get a card.
2. **Gone quiet**: a hot lead hasn't answered in 7 days and something fits now → follow-up card.
3. **Upsell**: a paying customer's order is done → the offer that usually comes next.
4. **Live / webinar invite**: the next Live's topic matches a lead's interest → invite card.
5. **Last call**: an offer or coupon ends in 48 h → leads who looked at it.
6. **Hot signal**: a lead opened your page or chat twice today (`?src=`, PostHog) → "write now".
7. **Review and referral**: a happy, finished customer → review request, later a referral ask.
Each uses the same flow (card → Allow → draft in Message → Send), so a new kind is one finder.

## Claude Code × Lead (ideas, in order of value)

1. **Follow-up sweep**: "who is waiting?" → the agent reads Message + List, drafts a reply or
   email for each lead that went quiet, grounded in the business brain → one card each in Approval.
2. **Lead research → brief**: the agent researches a new lead (website, socials with the scrape agent /
   Agent-Reach) and writes a short brief and a first line into the lead's notes (direct, logged).
3. **Meeting prep**: before a Calendar meeting, it pulls past calls (Fathom), questions and
   pricing into a one-page prep note on the event.
4. **After the call**: from the transcript it updates the lead's status and next follow-up date
   and drafts the follow-up email (→ Approval).
5. **Personal asset per lead**: it makes a short video or one-pager with a Social skill and
   attaches the link to the follow-up draft.
6. **Weekly pipeline report**: leads by stage, who to call this week, sent by Telegram/email.

Other pages: **Services** (agent suggests Chat AI greeting and suggestions from real chats,
applied with one click on the Services page), **Reviews** (drafts replies to reviews → Approval),
**Projects / offers** (drafts a new offer page; publishing → Approval), **Social** (fills a
content calendar; posting → Approval), **Integrations** (sets up connections; key entered once).

## Build list

1. **Website package** rebuilt around `<StsAI />` (LiveKit inside), published to npm.
2. **CLI 1.1**: `init` does login, website and agent in one run.
3. **Behind-the-scenes website link**: the CLI sets it up during approval; no key to copy.
4. **Services page**: the one command and "Website connected ✓".
5. **Lead → Message next steps**: AI draft button, autopilot per channel, inbound email.
6. **Instagram connector per project** (later): when a project needs one, bind a comment keyword
   to the project and DM its link (reuses comment-to-DM campaigns; a bridge write tool proposes it).
7. Saves on the account; "Import to my n8n" button on workflow cards (the bridge tool exists).
