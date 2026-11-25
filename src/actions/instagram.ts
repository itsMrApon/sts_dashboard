'use server'

import { revalidatePath } from 'next/cache'
import { onAuthenticateUser } from '@/actions/auth'
import { prismaClient } from '@/lib/prismaClient'
import { instagramTokenFor } from '@/lib/instagram/connection'
import { listRecentMedia, type InstagramMedia } from '@/lib/instagram/graph'

type Result = { ok: true; message?: string } | { ok: false; error: string }

async function currentUserId() {
  const auth = await onAuthenticateUser()
  return auth.user?.id ?? null
}

/** The creator's latest posts and reels, to pick one for a campaign. */
export async function loadInstagramMedia(): Promise<{ ok: true; media: InstagramMedia[] } | { ok: false; error: string }> {
  const userId = await currentUserId()
  if (!userId) return { ok: false, error: 'Sign in again.' }
  const connection = await instagramTokenFor(userId)
  if (!connection) return { ok: false, error: 'Connect Instagram first.' }
  try {
    return { ok: true, media: await listRecentMedia(connection.token) }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Instagram did not answer.' }
  }
}

export async function saveInstagramCampaign(input: {
  id?: string
  mediaId: string | null
  mediaCaption: string | null
  mediaThumb: string | null
  keywords: string
  matchMode: 'contains' | 'word'
  dmText: string
  linkUrl: string
  publicReply: string
  askContact: boolean
}): Promise<Result> {
  const userId = await currentUserId()
  if (!userId) return { ok: false, error: 'Sign in again.' }
  if (!(await instagramTokenFor(userId))) return { ok: false, error: 'Connect Instagram first.' }
  const keywords = [...new Set(input.keywords.split(',').map((word) => word.trim()).filter(Boolean))].slice(0, 10)
  if (keywords.length === 0) return { ok: false, error: 'Add at least one keyword, such as PRICE or দাম.' }
  const dmText = input.dmText.trim().slice(0, 900)
  if (!dmText) return { ok: false, error: 'Write the message people get.' }
  const linkUrl = input.linkUrl.trim()
  if (linkUrl && !/^https?:\/\/\S+$/i.test(linkUrl)) return { ok: false, error: 'The link must start with https://' }

  const data = {
    mediaId: input.mediaId || null,
    mediaCaption: input.mediaCaption?.slice(0, 200) || null,
    mediaThumb: input.mediaThumb?.slice(0, 1000) || null,
    keywords,
    matchMode: input.matchMode === 'word' ? 'word' : 'contains',
    dmText,
    linkUrl: linkUrl || null,
    publicReply: input.publicReply.trim().slice(0, 300) || null,
    askContact: input.askContact,
  }
  if (input.id) {
    const updated = await prismaClient.instagramCampaign.updateMany({ where: { id: input.id, userId }, data })
    if (updated.count === 0) return { ok: false, error: 'That campaign is gone.' }
  } else {
    await prismaClient.instagramCampaign.create({ data: { userId, ...data } })
  }
  revalidatePath('/social/instagram')
  return { ok: true, message: 'Campaign saved' }
}

export async function setInstagramCampaignActive(input: { id: string; active: boolean }): Promise<Result> {
  const userId = await currentUserId()
  if (!userId) return { ok: false, error: 'Sign in again.' }
  await prismaClient.instagramCampaign.updateMany({ where: { id: input.id, userId }, data: { active: input.active } })
  revalidatePath('/social/instagram')
  return { ok: true, message: input.active ? 'Campaign on' : 'Campaign paused' }
}

export async function deleteInstagramCampaign(input: { id: string }): Promise<Result> {
  const userId = await currentUserId()
  if (!userId) return { ok: false, error: 'Sign in again.' }
  await prismaClient.instagramCampaign.deleteMany({ where: { id: input.id, userId } })
  revalidatePath('/social/instagram')
  return { ok: true, message: 'Campaign deleted' }
}

export async function disconnectInstagram(): Promise<Result> {
  const userId = await currentUserId()
  if (!userId) return { ok: false, error: 'Sign in again.' }
  await prismaClient.instagramConnection.deleteMany({ where: { userId } })
  await prismaClient.instagramCampaign.updateMany({ where: { userId }, data: { active: false } })
  revalidatePath('/social/instagram')
  revalidatePath('/integrations')
  revalidatePath('/social')
  return { ok: true, message: 'Instagram disconnected. Campaigns are paused.' }
}
