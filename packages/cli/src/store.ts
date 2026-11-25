import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * The login, saved once per sts-ai server so the next `init` (another project, another agent)
 * doesn't ask again. ~/.config/sts-ai/credentials.json, readable only by this user.
 */
export type SavedLogin = { token: string; mcpUrl: string; businessName: string | null; savedAt: string }

const DIR = join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'sts-ai')
const FILE = join(DIR, 'credentials.json')

function readAll(): Record<string, SavedLogin> {
  if (!existsSync(FILE)) return {}
  try {
    const parsed: unknown = JSON.parse(readFileSync(FILE, 'utf8'))
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, SavedLogin>) : {}
  } catch {
    return {}
  }
}

function writeAll(all: Record<string, SavedLogin>) {
  mkdirSync(DIR, { recursive: true, mode: 0o700 })
  if (Object.keys(all).length === 0) {
    rmSync(FILE, { force: true })
    return
  }
  writeFileSync(FILE, `${JSON.stringify(all, null, 2)}\n`, { mode: 0o600 })
  chmodSync(FILE, 0o600)
}

export const credentialsPath = FILE

export function loadLogin(baseUrl: string): SavedLogin | null {
  return readAll()[baseUrl] ?? null
}

export function saveLogin(baseUrl: string, login: SavedLogin) {
  writeAll({ ...readAll(), [baseUrl]: login })
}

export function forgetLogin(baseUrl: string) {
  const all = readAll()
  delete all[baseUrl]
  writeAll(all)
}
