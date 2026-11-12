import { ContextStatusEnum } from '@prisma/client'
import { prismaClient } from '@/lib/prismaClient'
import { getBusinessServices } from '@/lib/services/serviceConfig'
import { listSelectableAgents } from '@/actions/business'
import { loadMessagesContext } from './_lib/messagesContext'
import { MessagesHubCards } from './_components/MessagesHubCards'
import { BusinessAgentPicker } from './_components/BusinessAgentPicker'

const onOff = (on: boolean) => ({ on, label: on ? 'On' : 'Off' })

/** Messages home: the five website services, full width. The AI itself is managed in /ai-agents. */
export default async function MessagesPage() {
  const { business } = await loadMessagesContext()
  const [services, wizard, workspace, agents] = await Promise.all([
    getBusinessServices(business.workspaceId),
    prismaClient.voiceWizard.findFirst({ where: { userId: business.userId }, select: { isPublished: true } }),
    prismaClient.workspace.findUnique({ where: { id: business.workspaceId }, select: { contextStatus: true } }),
    listSelectableAgents(),
  ])
  const published = workspace?.contextStatus === ContextStatusEnum.PUBLISHED

  return (
    <div className="flex w-full flex-col gap-3">
      <BusinessAgentPicker agents={agents} currentAgentId={business.agentId} />
      <MessagesHubCards
        status={{
          chat: onOff(services.chat.enabled),
          speak: onOff(services.speak.enabled),
          form: onOff(services.form.enabled),
          wizard: { on: Boolean(wizard?.isPublished), label: wizard?.isPublished ? 'Live' : wizard ? 'Draft' : 'Off' },
          business: { on: published, label: published ? 'Published' : 'Draft' },
        }}
      />
    </div>
  )
}
