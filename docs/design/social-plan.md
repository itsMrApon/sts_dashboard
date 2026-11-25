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
| Plugins | 16 | sts-ai MCP, n8n MCP, Postiz, ElevenLabs, Higgsfield, Playwright, Firecrawl, Agent-Reach, Notion, Docker + tunnel stack… |
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

## Next

1. Saves on the account (a small table) so they follow the creator across devices.
2. Instagram keywords per card: a public page per card plus a comment-to-DM campaign that sends it.
3. "Import to my n8n" button on workflow cards, using the n8n connection in Integrations.
