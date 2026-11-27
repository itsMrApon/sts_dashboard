import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

/**
 * The website half of `init`: find what the site is built with, install @sts-ai/sdk and wire it
 * in, so the designer only writes their own chat box, orb, form or tour. Every file we change is
 * backed up once as `<file>.bak-sts-ai`; anything we can't change safely is printed instead.
 */

export const SDK_PACKAGE = '@sts-ai/sdk'
const SDK_RANGE = '^1.0.0'

export type Framework = 'next-app' | 'next-pages' | 'nuxt' | 'vite-react' | 'unknown'

export type SiteProject = {
  root: string
  framework: Framework
  /** The file we wire the provider/plugin into. */
  entry: string | null
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun'
  devPort: number
}

export const FRAMEWORK_LABEL: Record<Framework, string> = {
  'next-app': 'Next.js (App Router)',
  'next-pages': 'Next.js (Pages Router)',
  nuxt: 'Nuxt',
  'vite-react': 'Vite + React',
  unknown: 'a JavaScript site',
}

const first = (root: string, files: string[]) => files.map((f) => join(root, f)).find((f) => existsSync(f)) ?? null

/** The website in this folder, or null when the folder is not a website project. */
export function detectSite(root = process.cwd()): SiteProject | null {
  const pkgFile = join(root, 'package.json')
  if (!existsSync(pkgFile)) return null
  let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string>; scripts?: Record<string, string> }
  try {
    pkg = JSON.parse(readFileSync(pkgFile, 'utf8'))
  } catch {
    return null
  }
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }
  const port = (fallback: number) => devPortFrom(pkg.scripts?.dev) ?? fallback
  const packageManager = existsSync(join(root, 'pnpm-lock.yaml'))
    ? 'pnpm'
    : existsSync(join(root, 'yarn.lock'))
      ? 'yarn'
      : existsSync(join(root, 'bun.lockb')) || existsSync(join(root, 'bun.lock'))
        ? 'bun'
        : 'npm'

  if (deps.nuxt) return { root, framework: 'nuxt', entry: join(root, 'plugins', 'sts-ai.client.ts'), packageManager, devPort: port(3000) }
  if (deps.next) {
    const appLayout = first(root, ['app/layout.tsx', 'src/app/layout.tsx', 'app/layout.jsx', 'src/app/layout.jsx', 'app/layout.js', 'src/app/layout.js'])
    if (appLayout) return { root, framework: 'next-app', entry: appLayout, packageManager, devPort: port(3000) }
    const pagesApp = first(root, ['pages/_app.tsx', 'src/pages/_app.tsx', 'pages/_app.jsx', 'src/pages/_app.jsx', 'pages/_app.js', 'src/pages/_app.js'])
    return { root, framework: 'next-pages', entry: pagesApp, packageManager, devPort: port(3000) }
  }
  if (deps.vite && deps.react) {
    const main = first(root, ['src/main.tsx', 'src/main.jsx', 'src/index.tsx', 'src/index.jsx'])
    return { root, framework: 'vite-react', entry: main, packageManager, devPort: port(5173) }
  }
  if (deps.react || deps.vue) return { root, framework: 'unknown', entry: null, packageManager, devPort: port(3000) }
  return null
}

/** The port a `dev` script sets (`-p 4000`, `--port=4000`, `PORT=4000`), or null for the default. */
export function devPortFrom(script: string | undefined): number | null {
  const match = script?.match(/(?:^|\s)(?:-p|--port)(?:\s+|=)(\d{2,5})\b|\bPORT=(\d{2,5})\b/)
  const value = match ? Number(match[1] ?? match[2]) : NaN
  return Number.isInteger(value) && value > 0 && value < 65536 ? value : null
}

/**
 * True when the sts-ai address is this website's own dev server (both on localhost:3000, say).
 * Every SDK call would then go back to the website instead of to sts-ai.
 */
export function pointsAtSite(apiBase: string, site: SiteProject): boolean {
  const url = new URL(apiBase)
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  const port = Number(url.port || (url.protocol === 'https:' ? 443 : 80))
  return local && port === site.devPort
}

function backupOnce(file: string) {
  const backup = `${file}.bak-sts-ai`
  if (existsSync(file) && !existsSync(backup)) copyFileSync(file, backup)
}

/** Installs @sts-ai/sdk with the project's own package manager. */
export function installSdk(site: SiteProject): { ok: boolean; command: string } {
  const add = site.packageManager === 'npm' ? 'install' : 'add'
  // STS_AI_SDK_SPEC: install another build (a local .tgz while testing a release).
  const spec = process.env.STS_AI_SDK_SPEC || `${SDK_PACKAGE}@${SDK_RANGE}`
  const command = `${site.packageManager} ${add} ${spec}`
  const result = spawnSync(site.packageManager, [add, spec], {
    cwd: site.root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  return { ok: result.status === 0, command }
}

/** Sets (or replaces) KEY=value lines in an env file. */
function writeEnv(file: string, values: Record<string, string>) {
  const lines = existsSync(file) ? readFileSync(file, 'utf8').split('\n') : []
  if (existsSync(file)) backupOnce(file)
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${value}`
    const index = lines.findIndex((l) => l.startsWith(`${key}=`))
    if (index >= 0) lines[index] = line
    else {
      if (lines.length && lines[lines.length - 1] !== '') lines.push('')
      lines.push(line)
    }
  }
  writeFileSync(file, `${lines.join('\n').replace(/\n*$/, '')}\n`)
}

/** Adds an import after the file's last import line. */
function addImport(source: string, statement: string) {
  if (source.includes(statement)) return source
  const imports = [...source.matchAll(/^import[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm)]
  const last = imports[imports.length - 1]
  if (!last || last.index === undefined) {
    // After a leading 'use client' / 'use server' directive, if any.
    const directive = source.match(/^(['"]use (client|server)['"];?\s*\n)/)
    return directive ? `${directive[1]}${statement}\n${source.slice(directive[1].length)}` : `${statement}\n${source}`
  }
  const at = last.index + last[0].length
  return `${source.slice(0, at)}\n${statement}${source.slice(at)}`
}

export type WireResult = { changed: string[]; manual: string | null }

/**
 * Wires the SDK into the site: env values plus the provider (React) or the plugin (Nuxt).
 * Returns the files changed, or a snippet to paste when the code isn't what we expect.
 */
export function wireSdk(site: SiteProject, apiBase: string, siteKey: string): WireResult {
  const changed: string[] = []
  const rel = (file: string) => relative(site.root, file) || file

  if (site.framework === 'nuxt') {
    const file = site.entry as string
    mkdirSync(dirname(file), { recursive: true })
    if (existsSync(file)) backupOnce(file)
    writeFileSync(
      file,
      `// Added by npx @sts-ai/cli init. The site key is publishable: it only works on the
// website addresses allowed in sts-ai, so it is fine in client code.
import { createStsPlugin } from '${SDK_PACKAGE}/vue'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(
    createStsPlugin({
      apiBase: '${apiBase}',
      siteKey: '${siteKey}',
    }),
  )
})
`,
    )
    changed.push(rel(file))
    return { changed, manual: null }
  }

  const reactSnippet = (envPrefix: string) =>
    `import { StsProvider } from '${SDK_PACKAGE}/react'\n\n<StsProvider apiBase={${envPrefix}STS_AI_URL} siteKey={${envPrefix}STS_SITE_KEY}>\n  {/* your app */}\n</StsProvider>`

  if (site.framework === 'next-app' || site.framework === 'next-pages') {
    const env = join(site.root, '.env.local')
    writeEnv(env, { NEXT_PUBLIC_STS_AI_URL: apiBase, NEXT_PUBLIC_STS_SITE_KEY: siteKey })
    changed.push(rel(env))
    const props = 'apiBase={process.env.NEXT_PUBLIC_STS_AI_URL!} siteKey={process.env.NEXT_PUBLIC_STS_SITE_KEY!}'
    const manual = reactSnippet('process.env.NEXT_PUBLIC_')
    if (!site.entry) return { changed, manual }
    const source = readFileSync(site.entry, 'utf8')
    if (source.includes('StsProvider')) return { changed, manual: null }
    const target = site.framework === 'next-app' ? /\{\s*children\s*\}/ : /<Component\s+\{\.\.\.pageProps\}\s*\/>/
    const match = source.match(target)
    if (!match) return { changed, manual }
    const js = /\.jsx?$/.test(site.entry)
    const wrapped = source.replace(target, `<StsProvider ${js ? props.replace(/!/g, '') : props}>${match[0]}</StsProvider>`)
    backupOnce(site.entry)
    writeFileSync(site.entry, addImport(wrapped, `import { StsProvider } from '${SDK_PACKAGE}/react'`))
    changed.push(rel(site.entry))
    return { changed, manual: null }
  }

  if (site.framework === 'vite-react') {
    const env = join(site.root, '.env.local')
    writeEnv(env, { VITE_STS_AI_URL: apiBase, VITE_STS_SITE_KEY: siteKey })
    changed.push(rel(env))
    const manual = reactSnippet('import.meta.env.VITE_')
    if (!site.entry) return { changed, manual }
    const source = readFileSync(site.entry, 'utf8')
    if (source.includes('StsProvider')) return { changed, manual: null }
    const target = /<App\s*\/>/
    if (!target.test(source)) return { changed, manual }
    const wrapped = source.replace(
      target,
      '<StsProvider apiBase={import.meta.env.VITE_STS_AI_URL} siteKey={import.meta.env.VITE_STS_SITE_KEY}><App /></StsProvider>',
    )
    backupOnce(site.entry)
    writeFileSync(site.entry, addImport(wrapped, `import { StsProvider } from '${SDK_PACKAGE}/react'`))
    changed.push(rel(site.entry))
    return { changed, manual: null }
  }

  return {
    changed,
    manual: `import { createSts } from '${SDK_PACKAGE}'\n\nconst sts = createSts({ apiBase: '${apiBase}', siteKey: '${siteKey}' })`,
  }
}

/** A first example for the designer, in the site's own framework. */
export function exampleFor(site: SiteProject): string {
  if (site.framework === 'nuxt') {
    return `<script setup lang="ts">
import { useStsChat } from '${SDK_PACKAGE}/vue'
const { messages, send, status } = useStsChat()
</script>`
  }
  if (site.framework === 'unknown') return `import { createChat } from '${SDK_PACKAGE}'\nconst chat = createChat(sts)\nchat.subscribe((state) => render(state.messages))`
  return `'use client'
import { useStsChat } from '${SDK_PACKAGE}/react'
const { messages, send, status } = useStsChat()`
}
