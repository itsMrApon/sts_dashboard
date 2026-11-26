import 'server-only'
import { createHash, randomBytes, randomInt } from 'node:crypto'
import { prismaClient } from '@/lib/prismaClient'

/**
 * Login for the sts-ai CLI (`npx @sts-ai/cli init`), as a device-code flow:
 *
 * 1. The CLI calls start: it gets a secret device code and a short user code.
 * 2. The creator opens /cli/authorize?code=<user code> while signed in and approves.
 * 3. The CLI polls with its device code; the first poll after approval gets a token, once.
 *
 * Only hashes are stored: a leaked database row can't be used as a token or to finish a login.
 */

export const CLI_CLIENTS = ['claude', 'codex', 'cursor'] as const
export type CliClient = (typeof CLI_CLIENTS)[number]

export const CLI_CLIENT_LABEL: Record<CliClient, string> = {
  claude: 'Claude Code',
  codex: 'Codex',
  cursor: 'Cursor',
}

const LOGIN_TTL_MS = 10 * 60 * 1000
export const CLI_POLL_INTERVAL_SEC = 2
/** Don't write lastUsedAt on every MCP call. */
const LAST_USED_GRANULARITY_MS = 5 * 60 * 1000
/** No 0/O, 1/I/L: the code is read off a terminal and typed or compared by eye. */
const USER_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

export function isCliClient(value: unknown): value is CliClient {
  return typeof value === 'string' && (CLI_CLIENTS as readonly string[]).includes(value)
}

function newUserCode(): string {
  let code = ''
  for (let i = 0; i < 8; i++) code += USER_CODE_ALPHABET[randomInt(USER_CODE_ALPHABET.length)]
  return `${code.slice(0, 4)}-${code.slice(4)}`
}

/** Accepts the code with or without the dash, any case. */
export function normalizeUserCode(raw: string): string | null {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (clean.length !== 8 || [...clean].some((ch) => !USER_CODE_ALPHABET.includes(ch))) return null
  return `${clean.slice(0, 4)}-${clean.slice(4)}`
}

export async function startCliLogin(input: { client: CliClient; deviceName: string | null }) {
  const deviceCode = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + LOGIN_TTL_MS)
  // A collision on the 8-character code is very unlikely; retry a few times if it happens.
  for (let attempt = 0; attempt < 5; attempt++) {
    const userCode = newUserCode()
    try {
      await prismaClient.cliLoginRequest.create({
        data: {
          deviceCodeHash: sha256(deviceCode),
          userCode,
          client: input.client,
          deviceName: input.deviceName?.slice(0, 100) || null,
          expiresAt,
        },
      })
      return { deviceCode, userCode, expiresAt }
    } catch (error) {
      if (attempt === 4) throw error
    }
  }
  throw new Error('Could not start the login.')
}

export type CliPollResult =
  | { status: 'pending' }
  | { status: 'denied' | 'expired' | 'invalid' }
  | { status: 'approved'; token: string; userName: string | null; businessName: string | null }

/** Hands out the token exactly once, on the first poll after approval. */
export async function pollCliLogin(deviceCode: string): Promise<CliPollResult> {
  const request = await prismaClient.cliLoginRequest.findUnique({ where: { deviceCodeHash: sha256(deviceCode) } })
  if (!request) return { status: 'invalid' }
  if (request.status === 'DENIED') return { status: 'denied' }
  if (request.status === 'CONSUMED') return { status: 'invalid' }
  if (request.expiresAt.getTime() < Date.now()) return { status: 'expired' }
  if (request.status !== 'APPROVED' || !request.userId) return { status: 'pending' }

  const userId = request.userId
  const token = `sts_${randomBytes(30).toString('base64url')}`
  const issued = await prismaClient.$transaction(async (tx) => {
    // Only one poll can move APPROVED → CONSUMED, so two racing polls can't both get a token.
    const claimed = await tx.cliLoginRequest.updateMany({
      where: { id: request.id, status: 'APPROVED' },
      data: { status: 'CONSUMED' },
    })
    if (claimed.count === 0) return false
    await tx.cliToken.create({
      data: {
        userId,
        tokenHash: sha256(token),
        prefix: token.slice(0, 10),
        client: request.client,
        name: request.deviceName || 'This computer',
      },
    })
    return true
  })
  if (!issued) return { status: 'invalid' }

  const user = await prismaClient.user.findUnique({
    where: { id: userId },
    select: { name: true, publishProfile: { select: { name: true } } },
  })
  return {
    status: 'approved',
    token,
    userName: user?.name ?? null,
    businessName: user?.publishProfile?.name ?? null,
  }
}

export async function findPendingCliLogin(userCode: string) {
  const code = normalizeUserCode(userCode)
  if (!code) return null
  const request = await prismaClient.cliLoginRequest.findUnique({ where: { userCode: code } })
  if (!request || request.status !== 'PENDING' || request.expiresAt.getTime() < Date.now()) return null
  return request
}

export async function decideCliLogin(input: { userCode: string; userId: string; approve: boolean }): Promise<boolean> {
  const code = normalizeUserCode(input.userCode)
  if (!code) return false
  const updated = await prismaClient.cliLoginRequest.updateMany({
    where: { userCode: code, status: 'PENDING', expiresAt: { gt: new Date() } },
    data: input.approve ? { status: 'APPROVED', userId: input.userId } : { status: 'DENIED' },
  })
  return updated.count === 1
}

/** The user behind an agent's bearer token, or null if it's unknown or revoked. */
export async function verifyCliToken(token: string): Promise<{ tokenId: string; userId: string; client: string } | null> {
  if (!token.startsWith('sts_') || token.length < 20 || token.length > 100) return null
  const row = await prismaClient.cliToken.findUnique({
    where: { tokenHash: sha256(token) },
    select: { id: true, userId: true, client: true, revokedAt: true, lastUsedAt: true },
  })
  if (!row || row.revokedAt) return null
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > LAST_USED_GRANULARITY_MS) {
    void prismaClient.cliToken
      .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined)
  }
  return { tokenId: row.id, userId: row.userId, client: row.client }
}

export async function listCliTokens(userId: string) {
  return prismaClient.cliToken.findMany({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true, prefix: true, client: true, name: true, lastUsedAt: true, createdAt: true },
  })
}

export async function revokeCliToken(input: { userId: string; tokenId: string }): Promise<boolean> {
  const updated = await prismaClient.cliToken.updateMany({
    where: { id: input.tokenId, userId: input.userId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  return updated.count === 1
}
