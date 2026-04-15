'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { StreamCallSession } from '@/app/(publicRoutes)/chat/[roomName]/_components/StreamCallSession'

export function HostStreamCall({
  apiKey,
  callId,
  callType,
  token,
  attendee,
  roomName,
}: {
  apiKey: string
  callId: string
  callType: string
  token: string
  attendee: { id: string; name: string; image: string }
  roomName: string
}) {
  const router = useRouter()

  const onEnd = useCallback(() => {
    router.push(`/messages/${encodeURIComponent(roomName)}`)
  }, [roomName, router])

  return (
    <StreamCallSession
      apiKey={apiKey}
      callId={callId}
      callType={callType}
      attendee={attendee}
      token={token}
      role="host"
      onEnd={onEnd}
    />
  )
}

