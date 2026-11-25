# @sts-ai/cli

Connect your AI agent (Claude Code, Codex or Cursor) to your **sts-ai business brain**, so every
post, video, flyer or report it makes uses your real business: offers, prices, links, social
accounts and approved reviews.

```bash
npx --yes @sts-ai/cli@1.0 init --client claude --write
```

1. It opens sts-ai in your browser. Check the code matches your terminal and click **Approve**.
2. It adds an MCP server called `sts-ai` to your agent:
   - **Claude Code**: `claude mcp add --scope user` (your private `~/.claude.json`, all projects).
   - **Codex**: `[mcp_servers.sts-ai]` in `~/.codex/config.toml`.
   - **Cursor**: `"sts-ai"` in `~/.cursor/mcp.json`.
3. Restart the agent and ask: *"Read my sts-ai business brain and summarise my business."*

Then copy any prompt from **sts-ai → Social** into the agent.

## Commands

| Command | What it does |
|---|---|
| `init --client <claude\|codex\|cursor> --write` | Log in (once per computer) and add the server to that agent. Without `--write` it only shows what would change. |
| `whoami` | Shows which business this computer is connected to. |
| `logout` | Revokes the token and forgets it on this computer. |

Options: `--relogin` (approve again), `--no-browser` (print the link only), `--url <url>` (another
sts-ai server; default `https://sudotechserve.com`, or `$STS_AI_URL`).

## What the agent can read

The `sts-ai` MCP server is read-only. Tools: `get_business_brain`, `list_offers`, `list_reviews`.
It can't change anything and never sees payments or customers' contact details. Disconnect a
computer any time in **sts-ai → Social → Connected agents** (or run `logout`).

The login token is saved in `~/.config/sts-ai/credentials.json` (readable only by you) and in the
agent's own user config. Files the CLI changes are backed up once as `*.bak-sts-ai`.
