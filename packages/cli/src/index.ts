#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline/promises'
import { pollLogin, readBrainHeadline, revokeToken, setupSite, startLogin, type Client } from './api.js'
import { CLIENT_LABEL, configureClient, describeChanges } from './clients.js'
import { detectSite, exampleFor, FRAMEWORK_LABEL, installSdk, pointsAtSite, SDK_PACKAGE, wireSdk, type SiteProject } from './site.js'
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
${bold('sts-ai')} ${dim(`v${VERSION}`)}: connect your AI agent and your website to sts-ai

${bold('Usage')}
  npx @sts-ai/cli init                 asks what to connect (run it inside your website's folder)
  npx --yes @sts-ai/cli@1 init --client claude --write                     AI agent only
  npx --yes @sts-ai/cli@1 init --client claude --site https://you.com --write   agent + website
  npx @sts-ai/cli whoami
  npx @sts-ai/cli logout

${bold('init options')}
  --client <name>   claude (default), codex or cursor
  --site [url]      also set up the website in this folder (url = where it runs; localhost always works)
  --no-agent        only the website
  --write           do it without questions (without it, a terminal asks; elsewhere it only shows the plan)
  --replace-key     make a new website key even if one is in use (the old site stops until updated)
  --relogin         ask for a new approval even if this computer is already connected
  --no-browser      print the approval link instead of opening it
  --url <url>       sts-ai server (default ${DEFAULT_URL}, or $STS_AI_URL)
`

type Flags = {
  _: string[]
  client?: string
  url?: string
  /** --site [url]: '' when given without an address. */
  site?: string
  agent: boolean
  write: boolean
  replaceKey: boolean
  relogin: boolean
  browser: boolean
  help: boolean
}

function parse(argv: string[]): Flags {
  const flags: Flags = { _: [], agent: true, write: false, replaceKey: false, relogin: false, browser: true, help: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const [key, inline] = arg.startsWith('--') ? arg.slice(2).split('=', 2) : [null, null]
    const value = () => inline ?? argv[++i]
    if (key === 'client') flags.client = value()
    else if (key === 'url') flags.url = value()
    else if (key === 'site') flags.site = inline ?? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : '')
    else if (key === 'no-agent') flags.agent = false
    else if (key === 'replace-key') flags.replaceKey = true
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

/** Asks in the terminal; `null` when there is no terminal to ask in. */
function prompter() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return null
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return {
    async text(question: string, fallback = '') {
      const answer = (await rl.question(`  ${question}${fallback ? dim(` (${fallback})`) : ''}: `)).trim()
      return answer || fallback
    },
    async choose<T extends string>(question: string, options: { value: T; label: string }[], fallback: T): Promise<T> {
      console.log(`\n  ${bold(question)}`)
      options.forEach((option, i) => console.log(`    ${cyan(String(i + 1))}. ${option.label}${option.value === fallback ? dim('  (default)') : ''}`))
      const answer = (await rl.question('  › ')).trim()
      const picked = options[Number(answer) - 1]
      return picked ? picked.value : fallback
    },
    async yes(question: string, fallback: boolean) {
      const answer = (await rl.question(`  ${question} ${dim(fallback ? '[Y/n]' : '[y/N]')} `)).trim().toLowerCase()
      return answer ? answer.startsWith('y') : fallback
    },
    close: () => rl.close(),
  }
}

/** The website's address as an origin, or null when it isn't one. */
function siteOrigin(value: string): string | null {
  const raw = value.trim()
  if (!raw) return null
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).origin
  } catch {
    return null
  }
}

/** localhost / 127.0.0.1 (any port): fine for testing, never the live website. */
function isLocalhost(origin: string): boolean {
  try {
    const { hostname } = new URL(origin)
    return hostname === 'localhost' || hostname === '127.0.0.1'
  } catch {
    return false
  }
}

type Plan = { agent: Client | null; site: SiteProject | null; siteUrl: string | null }

async function plan(flags: Flags, ask: ReturnType<typeof prompter>): Promise<Plan> {
  const detected = detectSite()
  const flagClient = flags.client as Client | undefined
  if (flagClient && !CLIENTS.includes(flagClient)) throw new Error(`--client must be one of: ${CLIENTS.join(', ')}`)

  // Flags (prompts copied into an agent, the Install button): no questions.
  if (!ask) {
    if (flags.site !== undefined && !detected) throw new Error('--site needs to run inside your website folder (the one with package.json).')
    const siteUrl = flags.site ? siteOrigin(flags.site) : null
    if (flags.site && !siteUrl) throw new Error(`Not a website address: ${flags.site}`)
    return { agent: flags.agent ? (flagClient ?? 'claude') : null, site: flags.site !== undefined ? detected : null, siteUrl }
  }

  let wantAgent = flags.agent
  let wantSite = flags.site !== undefined
  if (detected && flags.site === undefined && flags.agent) {
    const choice = await ask.choose(
      'What do you want to connect?',
      [
        { value: 'both', label: `Both: your AI agent and this website (${FRAMEWORK_LABEL[detected.framework]})` },
        { value: 'agent', label: 'My AI agent (Claude Code, Codex, Cursor)' },
        { value: 'site', label: 'This website only' },
      ],
      'both',
    )
    wantAgent = choice !== 'site'
    wantSite = choice !== 'agent'
  } else if (!detected) {
    if (wantSite) throw new Error('Run this inside your website folder (the one with package.json) to set up the website.')
    console.log(dim(`\n  This folder isn't a website project, so only your AI agent is connected. Run it inside your website's folder to set that up too.`))
  }

  const agent = wantAgent
    ? (flagClient ??
      (await ask.choose(
        'Which AI agent?',
        CLIENTS.map((value) => ({ value, label: CLIENT_LABEL[value] })),
        'claude',
      )))
    : null

  let siteUrl: string | null = null
  if (wantSite) {
    const given = flags.site ? siteOrigin(flags.site) : null
    while (!siteUrl) {
      const answer = given ?? (await ask.text(`\n  Where will this website run? e.g. https://your-site.com ${dim('(Enter: only localhost for now)')}`))
      if (!answer) break
      siteUrl = siteOrigin(answer)
      if (!siteUrl) console.log(`  ${red('✗')} That isn't a website address.`)
    }
  }
  return { agent, site: wantSite ? detected : null, siteUrl }
}

async function init(flags: Flags) {
  const baseUrl = baseUrlFrom(flags)
  const ask = flags.write ? null : prompter()
  try {
    console.log(`\n${bold('sts-ai')} ${dim(`v${VERSION}`)}  ${dim(baseUrl)}`)
    const todo = await plan(flags, ask)
    if (!todo.agent && !todo.site) throw new Error('Nothing to connect.')
    if (todo.site && pointsAtSite(baseUrl, todo.site)) {
      throw new Error(
        `${baseUrl} is this website's own dev server, so the website would call itself instead of sts-ai.\n` +
          `  Use the hosted sts-ai (leave out --url, or --url ${DEFAULT_URL}), or run sts-ai on another port\n` +
          `  (npm run dev -- -p 3001) and pass --url http://localhost:3001.`,
      )
    }

    const steps = [
      'log this computer in to sts-ai (you approve it in the browser)',
      ...(todo.agent ? describeChanges(todo.agent) : []),
      ...(todo.site
        ? [
            `website (${FRAMEWORK_LABEL[todo.site.framework]}): make its key for ${[todo.siteUrl, `http://localhost:${todo.site.devPort}`].filter(Boolean).join(' and ')}`,
            `install ${SDK_PACKAGE} with ${todo.site.packageManager} and wire it in`,
          ]
        : []),
    ]
    console.log('\nThis will:')
    for (const line of steps) console.log(`  • ${line}`)
    if (!flags.write) {
      if (!ask) {
        console.log(`\nNothing was changed. Run again with ${bold('--write')} to do it.\n`)
        return
      }
      if (!(await ask.yes('\n  Go ahead?', true))) {
        console.log('\n  Nothing was changed.\n')
        return
      }
    }

    const saved = await ensureLogin(baseUrl, todo.agent ?? (flags.client as Client) ?? 'claude', flags)

    if (todo.agent) {
      const headline = await readBrainHeadline(saved.mcpUrl, saved.token)
      const result = configureClient(todo.agent, saved.mcpUrl, saved.token)
      console.log(`  ${green('✓')} ${result.done}`)
      if (headline) console.log(`  ${green('✓')} Business brain reachable: ${bold(headline)}`)
      if (result.note) console.log(`\n  ${result.note}`)
    }

    const allowedOrigins = todo.site ? await connectSite(baseUrl, saved.token, todo.site, todo.siteUrl, flags, ask) : []

    console.log(`\n${bold('Next')}`)
    let n = 1
    if (todo.agent) {
      console.log(`  ${n++}. Restart ${CLIENT_LABEL[todo.agent]}, then ask: ${cyan('"Read my sts-ai business brain and summarise my business."')}`)
      console.log(`  ${n++}. Copy a prompt from ${cyan(`${baseUrl}/social`)} and paste it in.`)
    }
    if (todo.site) {
      if (allowedOrigins.every(isLocalhost)) {
        // Without it the live site gets ORIGIN_NOT_ALLOWED on every call, with no hint in the browser.
        console.log(
          `  ${n++}. ${bold('Before you deploy')}: only localhost is allowed now. Add your live address (https://your-site.com)\n` +
            `     in ${cyan(`${baseUrl}/services/connection`)}, or the website's assistant is refused.`,
        )
      }
      console.log(`  ${n++}. Turn services on or off in ${cyan(`${baseUrl}/services`)} (Chat, Voice, Form, Tour).`)
      console.log(`  ${n++}. Build your own chat box, orb, form or tour with the SDK:\n`)
      console.log(exampleFor(todo.site).split('\n').map((line) => `       ${dim(line)}`).join('\n'))
      console.log(`\n     The SDK has no look of its own: nothing shows until a component uses a hook.`)
      console.log(`     For the scroll tour, mark sections with ${bold('data-sts-step="<step id>"')}.`)
      console.log(`     Every hook and example: ${cyan('https://www.npmjs.com/package/@sts-ai/sdk')}`)
    }
    console.log('')
  } finally {
    ask?.close()
  }
}

/** The saved login for this server, checked, or a new one approved in the browser. */
async function ensureLogin(baseUrl: string, client: Client, flags: Flags) {
  let saved = flags.relogin ? null : loadLogin(baseUrl)
  if (saved) {
    const headline = await readBrainHeadline(saved.mcpUrl, saved.token)
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
  }
  return saved
}

/** The website half: its key (made on sts-ai, never copied), the SDK, and the wiring. */
async function connectSite(
  baseUrl: string,
  token: string,
  site: SiteProject,
  siteUrl: string | null,
  flags: Flags,
  ask: ReturnType<typeof prompter>,
): Promise<string[]> {
  const origins = [siteUrl, `http://localhost:${site.devPort}`].filter((o): o is string => Boolean(o))
  let result = await setupSite(baseUrl, token, { origins, replace: flags.replaceKey })
  if (result.status === 'exists') {
    const where = result.allowedOrigins.length ? result.allowedOrigins.join(', ') : 'another website'
    const replace = ask
      ? await ask.yes(
          `\n  Your business already has a website key, used on ${bold(where)}.\n  Make a new one? That website stops working until it gets the new key.`,
          false,
        )
      : false
    if (!replace) {
      throw new Error(
        ask
          ? 'Kept the current key, so the website was not set up.'
          : `Your business already has a website key (used on ${where}). Run again with --replace-key to make a new one.`,
      )
    }
    result = await setupSite(baseUrl, token, { origins, replace: true })
    if (result.status !== 'ok') throw new Error('Could not make a new website key.')
  }
  console.log(`  ${green('✓')} Website key made for ${bold(result.allowedOrigins.join(', '))}${result.replaced ? dim(' (replaced the old key)') : ''}.`)

  console.log(dim(`\n  Installing ${SDK_PACKAGE}…`))
  const install = installSdk(site)
  if (install.ok) console.log(`  ${green('✓')} Installed ${SDK_PACKAGE}.`)
  else console.log(`  ${red('✗')} Install failed. Run it yourself: ${bold(install.command)}`)

  const wired = wireSdk(site, baseUrl, result.siteKey)
  for (const file of wired.changed) console.log(`  ${green('✓')} Updated ${file}`)
  if (wired.manual) {
    console.log(`\n  Add this where your app starts (we couldn't place it safely):\n`)
    console.log(wired.manual.split('\n').map((line) => `    ${line}`).join('\n'))
  }
  // Everything the key works on now (sts-ai merges these with what was already allowed).
  return result.allowedOrigins
}

async function whoami(flags: Flags) {
  const baseUrl = baseUrlFrom(flags)
  const saved = loadLogin(baseUrl)
  if (!saved) {
    console.log(`Not connected to ${baseUrl}. Run: npx @sts-ai/cli init`)
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
      : `Removed the saved login from ${credentialsPath}. Disconnect it in sts-ai too if it still shows there.`,
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
