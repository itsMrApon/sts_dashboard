'use client'

import Link from 'next/link'
import { ChevronLeft, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Props = {
  roomNameEncoded: string
}

/**
 * Floating chrome on the room detail page: back (top-left), configure + conversations (bottom-right).
 * Remove/delete lives on the Messages list (RoomCard), not here.
 */
export function RoomPageChrome({ roomNameEncoded }: Props) {
  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-start p-3 sm:p-4 md:top-2">
        <div className="pointer-events-auto">
          <Button variant="secondary" size="icon" className="h-10 w-10 rounded-full shadow-md" asChild>
            <Link href="/messages" aria-label="Back to messages">
              <ChevronLeft className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="pointer-events-none fixed bottom-6 right-4 z-40 flex flex-col items-end gap-2 sm:bottom-8 sm:right-6">
        <div className="pointer-events-auto">
          <Button variant="default" className="gap-2 rounded-full shadow-lg" size="sm" asChild>
            <a href="#messaging-setup">
              <Settings2 className="h-4 w-4" />
              Configure
            </a>
          </Button>
        </div>
        <div className="pointer-events-auto">
          <Button variant="secondary" className="rounded-full shadow-md" size="sm" asChild>
            <Link href={`/messages/${roomNameEncoded}/conversations`}>Conversations</Link>
          </Button>
        </div>
      </div>
    </>
  )
}
