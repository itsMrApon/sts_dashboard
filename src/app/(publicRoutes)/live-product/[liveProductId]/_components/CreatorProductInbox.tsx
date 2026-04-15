import { prismaClient } from '@/lib/prismaClient'
import { WebinarWithPresenter } from '@/lib/type'
import CreatorProductRoom from './CreatorProductRoom'

type Props = {
  product: WebinarWithPresenter
}

export default async function CreatorProductInbox({ product }: Props) {
  const attendances = await prismaClient.attendance.findMany({
    where: { webinarId: product.id },
    orderBy: { joinedAt: 'desc' },
    include: {
      user: true, // Attendee
    },
  })

  const attendees = attendances
    .map((a) => a.user)
    .filter(Boolean)
    .map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      lastSeenAt: attendances.find((a) => a.user?.id === u.id)?.joinedAt ?? null,
    }))

  return (
    <CreatorProductRoom
      product={product}
      attendees={attendees}
    />
  )
}

