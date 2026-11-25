#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { pollLogin, readBrainHeadline, revokeToken, startLogin, type Client } from './api.js'
import { CLIENT_LABEL, configureClient, describeChanges } from './clients.js'
import { credentialsPath, forgetLogin, loadLogin, saveLogin } from './store.js'
import { VERSION } from './version.js'

const DEFAULT_URL = 'https://sudotechserve.com'
const CLIENTS: Client[] = ['claude', 'codex', 'cursor']

const tty = process.stdout.isTTY
const paint = (code: number) => (s: string) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s)
const bold = paint(1)
const dim = paint(2)
const green = paint(32)
const red = paint(31)
const cyan = paint(36)

const HELP = `
${bold('sts-ai')} ${dim(`v${VERSION}`)}: connect your AI agent to your sts-ai business brain

${bold('Usage')}
  npx --yes @sts-ai/cli@1.0 init --client <claude|codex|cursor> --write
  npx @sts-ai/cli whoami
  npx @sts-ai/cli logout

${bold('init options')}
  --client <name>   claude (default), codex or cursor
  --write           change the agent's config (without it, only shows what would change)
  --relogin         ask for a new approval even if this computer is already connected
  --no-browser      print the approval link instead of opening it
  --url <url>       sts-ai server (default ${DEFAULT_URL}, or $STS_AI_URL)
`

type Flags = { _: string[]; client?: string; url?: string; write: boolean; relogin: boolean; browser: boolean; help: boolean }

function parse(argv: string[]): Flags {
  const flags: Flags = { _: [], write: false, relogin: false, browser: true, help: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const [key, inline] = arg.startsWith('--') ? arg.slice(2).split('=', 2) : [null, null]
    const value = () => inline ?? argv[++i]
    if (key === 'client') flags.client = value()
    else if (key === 'url') flags.url = value()
    else if (key === 'write') flags.write = true
    else if (key === 'relogin') flags.relogin = true
    else if (key === 'no-browser') flags.browser = false
    else if (key === 'help' || arg === '-h') flags.help = true
    else if (key === 'version' || arg === '-v') {
      console.log(VERSION)
      process.exit(0)
    } else if (key) throw new Error(`Unknown option --${key}`)
    else flags._.push(arg)
  }
  return flags
}

function baseUrlFrom(flags: Flags): string {
  const raw = (flags.url || process.env.STS_AI_URL || DEFAULT_URL).trim().replace(/\/+$/, '')
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`Not a valid URL: ${raw}`)
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.protocol !== 'https:' && !local) throw new Error('The sts-ai URL must use https:// (http is only allowed for localhost).')
  return url.origin
}

function openBrowser(url: string) {
  const [cmd, args] =
    process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]]
  try {
    const child = spawn(cmd, args as string[], { stdio: 'ignore', detached: true })
    child.on('error', () => undefined)
    child.unref()
  } catch {
    // No browser here (SSH, CI): the link is printed anyway.
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function login(baseUrl: string, client: Client, browser: boolean) {
  const start = await startLogin(baseUrl, client)
  // Built from the address this CLI was given, so it matches the server it is talking to.
  const verificationUrl = `${baseUrl}/cli/authorize?code=${encodeURIComponent(start.userCode)}`
  console.log(`\n  Approve this computer in your browser:\n\n    ${cyan(verificationUrl)}\n`)
  console.log(`  Check the page shows this code: ${bold(start.userCode)}\n`)
  if (browser) openBrowser(verificationUrl)

  const deadline = new Date(start.expiresAt).getTime()
  let interval = Math.max(1, start.interval) * 1000
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  let frame = 0
  while (Date.now() < deadline) {
    if (tty) process.stdout.write(`\r  ${frames[frame++ % frames.length]} Waiting for approval…`)
    await sleep(interval)
    let result
    try {
      result = await pollLogin(baseUrl, start.deviceCode)
    } catch {
      continue // a dropped request: try again on the next tick
    }
    if (result.status === 'pending') continue
    if (result.status === 'slow_down') {
      interval += 2000
      continue
    }
    if (tty) process.stdout.write('\r\x1b[2K')
    if (result.status === 'approved') return { token: result.token, mcpUrl: `${baseUrl}/api/mcp/agent`, businessName: result.businessName }
    if (result.status === 'denied') throw new Error('The login was refused in the browser.')
    throw new Error('The login code expired. Run the command again.')
  }
  if (tty) process.stdout.write('\r\x1b[2K')
  throw new Error('The login code expired (10 minutes). Run the command again.')
}

async function init(flags: Flags) {
  const client = (flags.client ?? 'claude') as Client
  if (!CLIENTS.includes(client)) throw new Error(`--client must be one of: ${CLIENTS.join(', ')}`)
  const baseUrl = baseUrlFrom(flags)

  console.log(`\n${bold('sts-ai')} → ${CLIENT_LABEL[client]}  ${dim(baseUrl)}`)
  if (!flags.write) {
    console.log('\nThis will:')
    console.log(`  • log this computer in to sts-ai (you approve it in the browser)`)
    for (const line of describeChanges(client)) console.log(`  • ${line}`)
    console.log(`\nNothing was changed. Run again with ${bold('--write')} to do it.\n`)
    return
  }

  let saved = flags.relogin ? null : loadLogin(baseUrl)
  let headline: string | null = null
  if (saved) {
    headline = await readBrainHeadline(saved.mcpUrl, saved.token)
    if (headline === null) {
      console.log(dim('\n  The saved login was disconnected. Logging in again.'))
      forgetLogin(baseUrl)
      saved = null
    } else {
      console.log(`\n  ${green('✓')} Already connected${saved.businessName ? ` to ${bold(saved.businessName)}` : ''}.`)
    }
  }
  if (!saved) {
    const fresh = await login(baseUrl, client, flags.browser)
    saved = { ...fresh, savedAt: new Date().toISOString() }
    saveLogin(baseUrl, saved)
    console.log(`  ${green('✓')} Approved${fresh.businessName ? ` for ${bold(fresh.businessName)}` : ''}.`)
    headline = await readBrainHeadline(saved.mcpUrl, saved.token)
  }

  const result = configureClient(client, saved.mcpUrl, saved.token)
  console.log(`  ${green('✓')} ${result.done}`)
  if (headline) console.log(`  ${green('✓')} Business brain reachable: ${bold(headline)}`)
  if (result.note) console.log(`\n  ${result.note}`)

  console.log(`
${bold('Next')}
  1. Restart ${CLIENT_LABEL[client]} so it loads the sts-ai server.
  2. Ask it: ${cyan('"Read my sts-ai business brain and summarise my business."')}
  3. Copy a prompt from ${cyan(`${baseUrl}/social`)} and paste it in.
`)
}

async function whoami(flags: Flags) {
  const baseUrl = baseUrlFrom(flags)
  const saved = loadLogin(baseUrl)
  if (!saved) {
    console.log(`Not connected to ${baseUrl}. Run: npx --yes @sts-ai/cli@1.0 init --write`)
    process.exitCode = 1
    return
  }
  const headline = await readBrainHeadline(saved.mcpUrl, saved.token)
  if (headline === null) {
    console.log(`${red('✗')} The saved login was disconnected. Run init again.`)
    process.exitCode = 1
    return
  }
  console.log(`${green('✓')} Connected to ${bold(headline)} ${dim(`(${baseUrl}, token ${saved.token.slice(0, 10)}…)`)}`)
}

async function logout(flags: Flags) {
  const baseUrl = baseUrlFrom(flags)
  const saved = loadLogin(baseUrl)
  if (!saved) {
    console.log(`Not connected to ${baseUrl}.`)
    return
  }
  const revoked = await revokeToken(baseUrl, saved.token).catch(() => false)
  forgetLogin(baseUrl)
  console.log(
    revoked
      ? `${green('✓')} Disconnected. The token no longer works anywhere.`
      : `Removed the saved login from ${credentialsPath}. Disconnect it in sts-ai → Social too if it still shows there.`,
  )
  console.log(dim('Your agent still lists the sts-ai server; remove it there if you like (e.g. `claude mcp remove sts-ai -s user`).'))
}

async function main() {
  const flags = parse(process.argv.slice(2))
  const command = flags._[0] ?? (flags.help ? 'help' : 'help')
  if (flags.help || command === 'help') {
    console.log(HELP)
    return
  }
  if (command === 'init') return init(flags)
  if (command === 'whoami') return whoami(flags)
  if (command === 'logout') return logout(flags)
  throw new Error(`Unknown command "${command}". Try: init, whoami, logout`)
}

main().catch((error: unknown) => {
  if (tty) process.stdout.write('\r\x1b[2K')
  console.error(`\n${red('✗')} ${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
