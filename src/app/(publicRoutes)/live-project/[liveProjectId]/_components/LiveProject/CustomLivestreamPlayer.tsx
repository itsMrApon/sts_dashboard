'use client'
import { useStreamVideoClient, Call, StreamCall } from '@stream-io/video-react-sdk'
import { WebinarWithPresenter } from '@/lib/type'
import React, { useState, useEffect, useRef } from 'react'
import LiveProjectView from '../Common/LiveProjectView'

type Props = {
  username:string
  callId:string
  callType:string
  project:WebinarWithPresenter
  token:string
}

const CustomLivestreamPlayer = ({
  username,
  callId,
  callType,
  project,
  token
}: Props) => {
  const client = useStreamVideoClient()
  const [call, setCall] = useState<Call>()
  const [showchat, setshowchat] = useState(true)
  const [joinError, setJoinError] = useState<string | null>(null)
  const callRef = useRef<Call | null>(null)

  useEffect(() => {
    if (!client) return
    setJoinError(null)
    const myCall = client.call(callType, callId)
    callRef.current = myCall
    setCall(myCall)

    const joinAsHost = async () => {
      try {
        await myCall.join({ create: true })
        await myCall.goLive()
        setCall(myCall)
      } catch (error) {
        console.error('Failed to join call', error)
        setJoinError(
          error instanceof Error ? error.message : 'Failed to get video stream. Allow camera and microphone access, then refresh.'
        )
      }
    }
    joinAsHost()

    return () => {
      const toLeave = callRef.current
      callRef.current = null
      setCall(undefined)
      setJoinError(null)
      if (toLeave) {
        toLeave.leave().catch((err) => console.error('Leave call cleanup:', err))
      }
    }
  }, [client, callId, callType])

  if (joinError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[280px] rounded-xl border border-border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground mb-2">{joinError}</p>
        <p className="text-xs text-muted-foreground">Check browser permissions for camera and microphone, then refresh the page.</p>
      </div>
    )
  }

  if (!call) return null

  return (
    <StreamCall call={call}>
      <LiveProjectView
        showChat={showchat}
        setShowChat={setshowchat}
        isHost={true}
        username={username}
        userId={project.presenter.id}
        userToken={token}
        project={project}
        call={call}
      />
    </StreamCall>
  )
}

export default CustomLivestreamPlayer