'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { prismaClient } from '@/lib/prismaClient'
import { VideoType } from '@prisma/client'
import { createPartnerConnector } from '@/actions/inboundConnectors'

export type WizardCommitInput = {
  workspaceMode: 'existing' | 'create'
  workspaceId?: string | null
  workspaceName: string
  modules: Array<'publish' | 'partners' | 'messages' | 'product' | 'webinar'>
  publish?: {
    description?: string
    pitchMessage?: string
  }
  partners?: {
    kind: string
    label: string
    mcpUrl: string
    authType?: string
    authSecret?: string
  }
  messages?: {
    agentIds: string[]
  }
}

export type WizardCommitResult =
  | {
      ok: true
      workspaceId: string
      publishProfileId: string | null
      roomName: string | null
      openProduct: boolean
      openWebinar: boolean
    }
  | { ok: false; error: string }

/**
 * Creates/attaches workspace and commits Publish / Partners / Messages modules.
 * Product & webinar are flagged for the client to open the existing project wizard.
 */
export async function commitWorkspaceWizard(
  input: WizardCommitInput,
): Promise<WizardCommitResult> {
  const { userId: clerkId } = await auth()
  if (!clerkId) return { ok: false, error: 'UNAUTHENTICATED' }

  const user = await prismaClient.user.findUnique({
    where: { clerkId },
    select: { id: true },
  })
  if (!user) return { ok: false, error: 'User not found' }

  const name = input.workspaceName.trim()
  if (!name && input.workspaceMode === 'create') {
    return { ok: false, error: 'Workspace name is required' }
  }

  try {
    let workspaceId = input.workspaceId?.trim() || null
    let publishProfileId: string | null = null

    if (input.workspaceMode === 'existing') {
      if (!workspaceId) return { ok: false, error: 'Choose a workspace' }
      const existing = await prismaClient.workspace.findFirst({
        where: { id: workspaceId, userId: user.id },
        select: { id: true, name: true, publishProfileId: true },
      })
      if (!existing) return { ok: false, error: 'Workspace not found' }
      workspaceId = existing.id
      publishProfileId = existing.publishProfileId
    } else {
      const pitch =
        input.publish?.pitchMessage?.trim() ||
        `Welcome to ${name}. Ask me anything about our services.`

      const workspace = await prismaClient.workspace.create({
        data: {
          userId: user.id,
          name,
          pitchMessage: pitch,
          videoType: VideoType.LINK,
        },
      })
      workspaceId = workspace.id
    }

    const workspaceName =
      input.workspaceMode === 'create'
        ? name
        : (
            await prismaClient.workspace.findUnique({
              where: { id: workspaceId! },
              select: { name: true },
            })
          )?.name || name

    // Publish: create or reuse publish profile, link to workspace
    if (input.modules.includes('publish') || input.modules.includes('messages')) {
      if (!publishProfileId) {
        const business = await prismaClient.publishProfile.create({
          data: {
            userId: user.id,
            name: workspaceName,
            description: input.publish?.description?.trim() || null,
          },
        })
        publishProfileId = business.id
        await prismaClient.workspace.update({
          where: { id: workspaceId! },
          data: {
            publishProfileId,
            ...(input.publish?.pitchMessage?.trim()
              ? { pitchMessage: input.publish.pitchMessage.trim() }
              : {}),
          },
        })
      } else if (input.modules.includes('publish') && input.publish) {
        await prismaClient.publishProfile.update({
          where: { id: publishProfileId },
          data: {
            description: input.publish.description?.trim() || undefined,
          },
        })
        if (input.publish.pitchMessage?.trim()) {
          await prismaClient.workspace.update({
            where: { id: workspaceId! },
            data: { pitchMessage: input.publish.pitchMessage.trim() },
          })
        }
      }
    }

    // Partners
    if (input.modules.includes('partners') && input.partners) {
      const p = input.partners
      if (!p.mcpUrl.trim()) {
        return { ok: false, error: 'Partner MCP URL is required' }
      }
      const result = await createPartnerConnector({
        workspaceId: workspaceId!,
        kind: p.kind,
        label: p.label.trim() || p.kind,
        mcpUrl: p.mcpUrl.trim(),
        authType: p.authType || 'none',
        authSecret: p.authSecret || undefined,
      })
      if (!result.success) {
        return { ok: false, error: result.error || 'Failed to create partner' }
      }
    }

    // Messages: link agents to publish profile + set workspace on channels
    let roomName: string | null = null
    if (input.modules.includes('messages')) {
      const agentIds = input.messages?.agentIds?.filter(Boolean) ?? []
      if (agentIds.length === 0) {
        return { ok: false, error: 'Select at least one AI agent for Messages' }
      }

      if (!publishProfileId) {
        const business = await prismaClient.publishProfile.create({
          data: {
            userId: user.id,
            name: workspaceName,
          },
        })
        publishProfileId = business.id
        await prismaClient.workspace.update({
          where: { id: workspaceId! },
          data: { publishProfileId },
        })
      }

      await prismaClient.publishAgent.deleteMany({ where: { publishProfileId } })
      await prismaClient.publishAgent.createMany({
        data: agentIds.map((agentId, index) => ({
          publishProfileId: publishProfileId!,
          agentId,
          isPrimary: index === 0,
        })),
      })

      const primaryAgent = await prismaClient.liveKitAgent.findUnique({
        where: { id: agentIds[0] },
        select: { roomName: true },
      })
      roomName = primaryAgent?.roomName ?? null

      if (roomName) {
        const updated = await prismaClient.messageChannel.updateMany({
          where: { roomName },
          data: {
            publishProfileId,
            workspaceId: workspaceId!,
            userId: user.id,
          },
        })

        // No channel rows yet (agent-only room) — create a durable workspace link row
        if (updated.count === 0) {
          await prismaClient.messageChannel.create({
            data: {
              roomName,
              platform: 'WHATSAPP',
              status: 'INACTIVE',
              userId: user.id,
              publishProfileId,
              workspaceId: workspaceId!,
              accountLabel: 'Workspace link',
            },
          })
        }
      }
    }

    revalidatePath('/tenants')
    revalidatePath('/tenants/publish')
    revalidatePath('/tenants/partners')
    revalidatePath('/messages')
    revalidatePath('/projects')

    return {
      ok: true,
      workspaceId: workspaceId!,
      publishProfileId,
      roomName,
      openProduct: input.modules.includes('product'),
      openWebinar: input.modules.includes('webinar'),
    }
  } catch (error) {
    console.error('commitWorkspaceWizard', error)
    return { ok: false, error: 'Failed to save workspace setup' }
  }
}
