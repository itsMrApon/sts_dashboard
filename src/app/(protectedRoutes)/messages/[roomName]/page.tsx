import { redirect } from 'next/navigation'

type Props = {
  params: Promise<{ roomName: string }>
}

/** Legacy deep link — room configuration lives on /messages/voice?room=… */
export default async function RoomDetailRedirect({ params }: Props) {
  const { roomName: rawRoomName } = await params
  let roomName = rawRoomName.trim()
  try {
    roomName = decodeURIComponent(roomName).trim()
  } catch {
    /* use raw */
  }
  if (!roomName) redirect('/messages')
  redirect(`/messages/voice?room=${encodeURIComponent(roomName)}`)
}
