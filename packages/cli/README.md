# @sts-ai/cli

One command connects **your AI agent** (Claude Code, Codex or Cursor) and **your website** to
sts-ai. Run it inside your website's folder:

```bash
npx @sts-ai/cli init
```

It asks what to connect (your AI agent, this website, or both), opens sts-ai in your browser once
to approve, and does the rest.

## Your AI agent

The agent gets an MCP server called `sts-ai`:

- **Claude Code**: `claude mcp add --scope user` (your private `~/.claude.json`, all projects).
- **Codex**: `[mcp_servers.sts-ai]` in `~/.codex/config.toml`.
- **Cursor**: `"sts-ai"` in `~/.cursor/mcp.json`.

Restart the agent and ask: *"Read my sts-ai business brain and summarise my business."* Then copy
any prompt from **sts-ai → Social** into it.

What it can do from there:

- **Business**: read your business brain, offers, reviews, answers and open questions; add
  answers and update your business description.
- **Social**: search the library and get any card's full brief.
- **Integrations**: see your connections and use your partner apps (n8n, Medusa, ERPNext, OpenSEO,
  custom MCP). New connections and n8n imports wait for your OK in **Lead → Approval**.
- **Services**: see your website services and turn Chat AI, Voice AI or the Form on or off.
- **Leads and Messages**: list leads, read conversations and write drafts. You always click Send.

It never sees payments or customers' contact details.

## Your website

In a Next.js, Nuxt or Vite + React project, `init`:

1. Makes your website's key in sts-ai and allows your address (and `localhost` for development).
   Nothing to copy. If your business already has a key on another site, it asks before making a
   new one.
2. Installs [`@sts-ai/sdk`](https://www.npmjs.com/package/@sts-ai/sdk) with your package manager.
3. Wires it in: Next.js `.env.local` + `<StsProvider>` in your layout, Nuxt
   `plugins/sts-ai.client.ts`, Vite `.env.local` + `<StsProvider>` in `src/main.tsx`.

Then your designer builds your own chat box, voice orb, form or scroll tour with the SDK; which
services are on is switched in **sts-ai → Services**.

## Without questions

For prompts an agent runs, or a copied command:

```bash
npx --yes @sts-ai/cli@1 init --client claude --write                            # AI agent
npx --yes @sts-ai/cli@1 init --client claude --site https://your-site.com --write  # agent + website
npx --yes @sts-ai/cli@1 init --no-agent --site https://your-site.com --write       # website only
```

| Option | |
|---|---|
| `--client <claude\|codex\|cursor>` | Which agent (default claude). |
| `--site [url]` | Also set up the website in this folder; the url is where it runs. |
| `--no-agent` | Only the website. |
| `--write` | Do it without asking. Without it, a terminal asks; elsewhere it only shows the plan. |
| `--replace-key` | Make a new website key even if one is in use (the old site stops until updated). |
| `--relogin` | Approve again even if this computer is already connected. |
| `--no-browser` | Print the approval link instead of opening it. |
| `--url <url>` | Another sts-ai server (default `https://sudotechserve.com`, or `$STS_AI_URL`). |

`whoami` shows which business this computer is connected to; `logout` revokes the token.

The login token is saved in `~/.config/sts-ai/credentials.json` (readable only by you) and in the
agent's own user config. Files the CLI changes are backed up once as `*.bak-sts-ai`.
