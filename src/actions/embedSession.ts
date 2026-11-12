'use server'

import { headers } from 'next/headers'
import { prismaClient } from '@/lib/prismaClient'
import { clientIp } from '@/lib/embed/clientIp'
import { issueFirstPartySession } from '@/lib/embed/embedSession'
import { EMBED_RATE_LIMITS, checkRateLimit } from '@/lib/embed/rateLimit'

export type FirstPartySessionResult =
  | { ok: true; token: string; expiresAt: number }
  | { ok: false; error: string; code: string }

/**
 * Session for STS-hosted pages (public chat, live-project call). Server actions are
 * CSRF-checked by Next (Origin vs Host), so other websites cannot mint these from a browser.
 */
export async function getFirstPartyEmbedSession(roomName: string): Promise<FirstPartySessionResult> {
  const trimmedRoomName = typeof roomName === 'string' ? roomName.trim() : ''
  if (!trimmedRoomName || trimmedRoomName.length > 255) {
    return { ok: false, error: 'Invalid room', code: 'ROOM_REQUIRED' }
  }

  const ip = clientIp(await headers())
  const rate = await checkRateLimit(
    `fp:session:${trimmedRoomName}:${ip}`,
    EMBED_RATE_LIMITS.session.limit,
    EMBED_RATE_LIMITS.session.windowMs,
  )
  if (!rate.ok) return { ok: false, error: 'Too many requests', code: 'RATE_LIMITED' }

  const agent = await prismaClient.liveKitAgent.findUnique({
    where: { roomName: trimmedRoomName },
    select: { id: true },
  })
  if (!agent) return { ok: false, error: 'Room not found', code: 'ROOM_NOT_FOUND' }

  const session = issueFirstPartySession(trimmedRoomName)
  return { ok: true, token: session.token, expiresAt: session.expiresAt }
}
