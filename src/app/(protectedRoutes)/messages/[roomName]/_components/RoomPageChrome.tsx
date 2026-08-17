'use client'

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Floating chrome on the room detail page: back (top-left).
 * Remove/delete lives on the Messages list (RoomCard), not here.
 */
export function RoomPageChrome() {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-start p-3 sm:p-4 md:top-2">
      <div className="pointer-events-auto">
        <Button variant="secondary" size="icon" className="h-10 w-10 rounded-full shadow-md" asChild>
          <Link href="/messages" aria-label="Back to messages">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
