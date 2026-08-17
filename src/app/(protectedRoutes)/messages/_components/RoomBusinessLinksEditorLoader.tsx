import { getRoomSelectableOptionsCached } from '../_lib/getRoomPageData'
import type { RoomBusinessData } from '../_lib/getRoomPageData'
import { RoomBusinessLinksEditor } from './RoomBusinessLinksEditor'

type Props = {
  userId: string
  publishProfile: RoomBusinessData
  roomName: string
}

export async function RoomBusinessLinksEditorLoader({
  userId,
  publishProfile,
  roomName,
}: Props) {
  const { selectableAgents, selectableProducts } = await getRoomSelectableOptionsCached(userId)

  return (
    <RoomBusinessLinksEditor
      publishProfile={publishProfile}
      roomName={roomName}
      selectableAgents={selectableAgents}
      selectableProducts={selectableProducts}
    />
  )
}
