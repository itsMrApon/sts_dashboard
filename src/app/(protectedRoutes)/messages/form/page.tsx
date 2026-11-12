import { prismaClient } from '@/lib/prismaClient'
import { getBusinessServices } from '@/lib/services/serviceConfig'
import { loadMessagesContext } from '../_lib/messagesContext'
import { MessagesShell } from '../_components/MessagesShell'
import { FormConfigurator } from './_components/FormConfigurator'

export default async function FormServicePage() {
  const { business, user } = await loadMessagesContext()
  const [services, submissions] = await Promise.all([
    getBusinessServices(business.workspaceId),
    prismaClient.formSubmission.findMany({
      where: { workspaceId: business.workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, fields: true, source: true, createdAt: true },
    }),
  ])

  return (
    <MessagesShell
      businessName={business.name}
      title="Form"
      description="A callback / lead form. Your designer styles it; submissions land here and in your inbox."
    >
      <FormConfigurator
        roomName={business.roomName}
        initial={services.form}
        ownerEmail={user.email ?? ''}
        submissions={submissions.map((row) => ({
          id: row.id,
          source: row.source,
          createdAt: row.createdAt.toISOString(),
          fields: (row.fields ?? {}) as Record<string, string>,
        }))}
      />
    </MessagesShell>
  )
}
