import { prismaClient } from '@/lib/prismaClient'
import { timeAsync } from '@/lib/dev/perf'
import { unstable_cache } from 'next/cache'
import { CreateBusinessModal } from './CreateBusinessModal'
import type { BusinessProfilePitchOption } from '../_lib/businessProfileOptions'

type Props = {
  userId: string
  businessProfiles: BusinessProfilePitchOption[]
  preferredTenantId?: string
}

const getCreateBusinessModalDataCached = unstable_cache(
  async (userId: string) => {
    const [agents, products] = await Promise.all([
      prismaClient.liveKitAgent.findMany({
        where: {
          OR: [
            { publishAgents: { none: {} } },
            {
              publishAgents: {
                some: { publishProfile: { userId } },
              },
            },
          ],
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, roomName: true },
      }),
      prismaClient.webinar.findMany({
        where: { presenterId: userId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, kind: true },
      }),
    ])

    return { agents, products }
  },
  ['messages-create-modal-data'],
  { revalidate: 15 },
)

export async function CreateBusinessModalLoader({ userId, businessProfiles, preferredTenantId }: Props) {
  const { agents, products } = await timeAsync(
    'route.messages.modal.cached',
    () => getCreateBusinessModalDataCached(userId),
  )

  return (
    <CreateBusinessModal
      agents={agents}
      products={products}
      businessProfiles={businessProfiles}
      preferredBusinessProfileId={
        preferredTenantId
          ? businessProfiles.find((p) => p.pitchTenantId === preferredTenantId)?.publishProfileId: undefined
      }
    />
  )
}
