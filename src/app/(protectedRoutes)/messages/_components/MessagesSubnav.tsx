import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { withRoomQuery } from '../_lib/messagingRooms'

export type MessagesSection = 'rooms' | 'connections' | 'publish'

type Props = {
  active: MessagesSection
  selectedRoomName?: string | null
}

function hrefFor(section: MessagesSection, roomName?: string | null): string {
  const base =
    section === 'rooms'
      ? '/messages/voice'
      : section === 'connections'
        ? '/messages/connections'
        : '/messages/publish'
  return withRoomQuery(base, roomName ?? null)
}

export function MessagesSubnav({ active, selectedRoomName = null }: Props) {
  return (
    <nav aria-label="Messages sections" className="flex h-10 items-center gap-1.5">
      <Button size="sm" variant="ghost" className="h-10 px-2" asChild>
        <Link href={withRoomQuery('/messages', selectedRoomName)}>Hub</Link>
      </Button>
      <Button
        size="sm"
        variant={active === 'rooms' ? 'default' : 'secondary'}
        className="h-10"
        asChild
      >
        <Link href={hrefFor('rooms', selectedRoomName)}>Voice AI</Link>
      </Button>
      <Button
        size="sm"
        variant={active === 'connections' ? 'default' : 'secondary'}
        className="h-10"
        asChild
      >
        <Link href={hrefFor('connections', selectedRoomName)}>Connections</Link>
      </Button>
      <Button
        size="sm"
        variant={active === 'publish' ? 'default' : 'secondary'}
        className="h-10"
        asChild
      >
        <Link href={hrefFor('publish', selectedRoomName)}>Publish</Link>
      </Button>
    </nav>
  )
}
