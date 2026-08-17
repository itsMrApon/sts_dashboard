'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircle } from 'lucide-react'
import { MultiSelect } from '@/components/ui/multi-select'
import type { MessagingRoomOption } from '../_lib/messagingRooms'

type Props = {
  rooms: MessagingRoomOption[]
  selectedRoomName: string | null
  /** Destination when the picker changes. Defaults to the messages hub. */
  basePath?: '/messages' | '/messages/voice' | '/messages/connections' | '/messages/publish'
}

export function MessagesRoomPicker({
  rooms,
  selectedRoomName,
  basePath = '/messages',
}: Props) {
  const router = useRouter()

  const options = useMemo(
    () =>
      rooms.map((room) => ({
        value: room.roomName,
        label: room.label,
        icon: MessageCircle,
      })),
    [rooms],
  )

  const handleChange = (values: string[]) => {
    const next = values.length > 0 ? values[values.length - 1] : undefined
    if (!next) {
      const fallback = rooms[0]?.roomName
      if (fallback) {
        router.replace(`${basePath}?room=${encodeURIComponent(fallback)}`, { scroll: false })
        return
      }
      router.replace(basePath, { scroll: false })
      return
    }
    router.replace(`${basePath}?room=${encodeURIComponent(next)}`, { scroll: false })
  }

  if (rooms.length === 0) return null

  return (
    <MultiSelect
      key={selectedRoomName ?? 'none'}
      options={options}
      defaultValue={selectedRoomName ? [selectedRoomName] : []}
      onValueChange={handleChange}
      placeholder="Search and select a room…"
      maxCount={1}
      hideSelectAll
      hideFooterActions
      resetOnDefaultValueChange
      singleLine
      className="h-10 w-full min-w-0"
      modalPopover
    />
  )
}
