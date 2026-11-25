import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import type { Client } from './api.js'

/**
 * Adds the "sts-ai" MCP server to each agent's own config. The token goes into the user's private
 * config (never a project file that gets committed), and a file we change is backed up once.
 */

const SERVER = 'sts-ai'

export const CLIENT_LABEL: Record<Client, string> = { claude: 'Claude Code', codex: 'Codex', cursor: 'Cursor' }

const codexConfig = () => join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'config.toml')
const cursorConfig = () => join(homedir(), '.cursor', 'mcp.json')

function hasClaudeCli(): boolean {
  const res = spawnSync('claude', ['--version'], { stdio: 'ignore', shell: process.platform === 'win32' })
  return res.status === 0
}

function backupOnce(file: string) {
  const backup = `${file}.bak-sts-ai`
  if (existsSync(file) && !existsSync(backup)) copyFileSync(file, backup)
}

/** What `init` will change, shown before anything happens (and without --write). */
export function describeChanges(client: Client): string[] {
  if (client === 'claude') {
    return hasClaudeCli()
      ? ['Claude Code: `claude mcp add --scope user sts-ai …` (saved in your private ~/.claude.json, every project)']
      : ['Claude Code CLI not found: writes .mcp.json in this folder, reading the token from $STS_AI_TOKEN']
  }
  if (client === 'codex') return [`Codex: adds [mcp_servers.${SERVER}] to ${codexConfig()}`]
  return [`Cursor: adds "${SERVER}" to ${cursorConfig()}`]
}

export type ConfigureResult = { done: string; note?: string }

export function configureClient(client: Client, mcpUrl: string, token: string): ConfigureResult {
  if (client === 'claude') return configureClaude(mcpUrl, token)
  if (client === 'codex') return configureCodex(mcpUrl, token)
  return configureCursor(mcpUrl, token)
}

function configureClaude(mcpUrl: string, token: string): ConfigureResult {
  if (hasClaudeCli()) {
    const shell = process.platform === 'win32'
    // Replace any earlier sts-ai entry; a missing one is fine.
    spawnSync('claude', ['mcp', 'remove', SERVER, '--scope', 'user'], { stdio: 'ignore', shell })
    const add = spawnSync(
      'claude',
      ['mcp', 'add', '--transport', 'http', '--scope', 'user', SERVER, mcpUrl, '--header', `Authorization: Bearer ${token}`],
      { encoding: 'utf8', shell },
    )
    if (add.status !== 0) throw new Error(`claude mcp add failed: ${(add.stderr || add.stdout || '').trim()}`)
    return { done: 'Added the sts-ai MCP server to Claude Code (all your projects).' }
  }

  // No `claude` on PATH: a project .mcp.json that reads the token from the environment.
  const file = join(process.cwd(), '.mcp.json')
  let config: { mcpServers?: Record<string, unknown> } = {}
  if (existsSync(file)) {
    try {
      config = JSON.parse(readFileSync(file, 'utf8'))
    } catch {
      throw new Error(`${file} isn't valid JSON. Fix it, or add the server by hand.`)
    }
    backupOnce(file)
  }
  config.mcpServers = {
    ...(config.mcpServers ?? {}),
    [SERVER]: { type: 'http', url: mcpUrl, headers: { Authorization: 'Bearer ${STS_AI_TOKEN}' } },
  }
  writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`)
  return {
    done: `Wrote ${file}.`,
    note: `Set the token before starting Claude Code (add it to your shell profile to keep it):\n  export STS_AI_TOKEN=${token}`,
  }
}

/** Removes an existing [mcp_servers.sts-ai] table (and its sub-tables) from a TOML file. */
export function withoutCodexServer(toml: string): string {
  const header = /^\s*\[\s*mcp_servers\.(?:"sts-ai"|sts-ai)(?:\.[^\]]*)?\s*\]\s*(?:#.*)?$/
  const anyHeader = /^\s*\[/
  const out: string[] = []
  let skipping = false
  for (const line of toml.split('\n')) {
    if (header.test(line)) {
      skipping = true
      continue
    }
    if (skipping && anyHeader.test(line)) skipping = false
    if (!skipping) out.push(line)
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()
}

function configureCodex(mcpUrl: string, token: string): ConfigureResult {
  const file = codexConfig()
  const current = existsSync(file) ? readFileSync(file, 'utf8') : ''
  backupOnce(file)
  const block = [`[mcp_servers.${SERVER}]`, `url = ${JSON.stringify(mcpUrl)}`, `http_headers = { "Authorization" = ${JSON.stringify(`Bearer ${token}`)} }`].join('\n')
  const kept = withoutCodexServer(current)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${kept ? `${kept}\n\n` : ''}${block}\n`, { mode: 0o600 })
  return {
    done: `Added [mcp_servers.${SERVER}] to ${file}.`,
    note: 'Needs a Codex version with streamable HTTP MCP servers. Check with `codex mcp list`.',
  }
}

function configureCursor(mcpUrl: string, token: string): ConfigureResult {
  const file = cursorConfig()
  let config: { mcpServers?: Record<string, unknown> } = {}
  if (existsSync(file)) {
    try {
      config = JSON.parse(readFileSync(file, 'utf8'))
    } catch {
      throw new Error(`${file} isn't valid JSON. Fix it, or add the server by hand.`)
    }
    backupOnce(file)
  }
  config.mcpServers = { ...(config.mcpServers ?? {}), [SERVER]: { url: mcpUrl, headers: { Authorization: `Bearer ${token}` } } }
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 })
  return { done: `Added "${SERVER}" to ${file}.`, note: 'In Cursor: Settings → MCP shows sts-ai; turn it on if it is off.' }
}
