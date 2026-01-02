'use client'
import { useStreamVideoClient, Call, StreamCall } from '@stream-io/video-react-sdk'
import { WebinarWithPresenter } from '@/lib/type'
import React, { useState, useEffect } from 'react'
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
  const[showchat, setshowchat] = useState(true)

  useEffect(() => {
    if(!client) return
    const myCall = client.call(callType, callId)
    setCall(myCall)
    myCall.join().catch((e) =>{
      console.error('Failed to join call', e)
    })

    return () => {
      myCall.leave().catch((e) =>{
        console.error('Failed to leave call', e)
      })
      setCall(undefined)
    }

  }, [client, callId, callType])

  if (!call) return null

  return (
    <StreamCall call={call}>
      <LiveProjectView
        showChat={showchat}
        setShowChat={setshowchat}
        isHost={true}
        username={username}
        userId={process.env.NEXT_PUBLIC_STREAM_USER_ID!}
        userToken={token}
        project={project}
      />
    </StreamCall>
  )
}

export default CustomLivestreamPlayer