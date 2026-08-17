import { redirect } from 'next/navigation'
import { onAuthenticateUser } from '@/actions/auth'
import { getTenantById } from '@/actions/tenants'
import { getMessageRoomsData } from '@/actions/publishProfiles'
import { resolveMessagingRoomName } from '../../messages/_lib/messagingRooms'

type PageProps = {
  searchParams: Promise<{ tenantId?: string; workspaceId?: string; publishProfileId?: string }>
}

/** Publish now lives on the Messages room. Keep this URL as a stable redirect. */
const page = async ({ searchParams }: PageProps) => {
  const auth = await onAuthenticateUser()
  if (!auth.user) redirect('/sign-in')

  const params = await searchParams
  const workspaceId = params.workspaceId || params.tenantId
  const publishProfileId = params.publishProfileId

  const rooms = await getMessageRoomsData(auth.user.id)

  if (workspaceId) {
    const tenant = await getTenantById(workspaceId, auth.user.id)
    const profileId = tenant?.publishProfileId
    if (profileId) {
      const room = rooms.find((row) => row.id === profileId)
      const roomName = room ? resolveMessagingRoomName(room) : null
      if (roomName) {
        redirect(`/messages/publish?room=${encodeURIComponent(roomName)}`)
      }
    }
  }

  if (publishProfileId) {
    const room = rooms.find((row) => row.id === publishProfileId)
    const roomName = room ? resolveMessagingRoomName(room) : null
    if (roomName) {
      redirect(`/messages/publish?room=${encodeURIComponent(roomName)}`)
    }
  }

  redirect('/messages/publish')
}

export default page
