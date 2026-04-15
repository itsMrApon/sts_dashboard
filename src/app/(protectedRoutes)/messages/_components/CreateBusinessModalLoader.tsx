import { prismaClient } from '@/lib/prismaClient'
import { timeAsync } from '@/lib/dev/perf'
import { unstable_cache } from 'next/cache'
import { CreateBusinessModal } from './CreateBusinessModal'
import type { BusinessProfilePitchOption } from '../[roomName]/_components/RoomTenantPicker'

type Props = {
  userId: string
  businessProfiles: BusinessProfilePitchOption[]
}

const getCreateBusinessModalDataCached = unstable_cache(
  async (userId: string) => {
    const [agents, products] = await Promise.all([
      prismaClient.liveKitAgent.findMany({
        where: {
          OR: [
            { businessAgents: { none: {} } },
            {
              businessAgents: {
                some: { business: { userId } },
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

export async function CreateBusinessModalLoader({ userId, businessProfiles }: Props) {
  const { agents, products } = await timeAsync(
    'route.messages.modal.cached',
    () => getCreateBusinessModalDataCached(userId),
  )

  return (
    <CreateBusinessModal
      agents={agents}
      products={products}
      businessProfiles={businessProfiles}
    />
  )
}
