import { redirect } from 'next/navigation'
import { onAuthenticateUser } from '@/actions/auth'
import { getPartnerConnectorsForWorkspace } from '@/actions/inboundConnectors'
import { getCreatorBusiness } from '@/lib/business/creatorBusiness'
import { prismaClient } from '@/lib/prismaClient'
import { startPerf, timeAsync } from '@/lib/dev/perf'
import { PartnersIntro } from './_components/PartnersIntro'

const page = async () => {
  const timer = startPerf('route.integrations')
  const auth = await timeAsync('route.integrations.onAuthenticateUser', () => onAuthenticateUser())
  if (!auth.user) redirect('/sign-in')

  const business = await getCreatorBusiness(auth.user.id)
  if (!business) redirect('/onboarding')

  const [connectors, telegram] = await Promise.all([
    timeAsync('route.integrations.getPartnerConnectors', () =>
      getPartnerConnectorsForWorkspace(business.workspaceId, auth.user.id),
    ),
    prismaClient.telegramConnection.findFirst({
      where: { workspaceId: business.workspaceId, userId: auth.user.id, chatId: { not: null } },
      select: { workspaceId: true },
    }),
  ])
  const connectedPartners = connectors
    .filter((connector) => connector.enabled)
    .map((connector) => ({ id: connector.id, kind: connector.kind, label: connector.label }))

  timer.end({ partnerCount: connectedPartners.length })
  return (
    <PartnersIntro
      workspaceId={business.workspaceId}
      connectedPartners={connectedPartners}
      telegramLinked={Boolean(telegram)}
    />
  )
}

export default page
