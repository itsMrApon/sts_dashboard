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
    //     // myCall.join().catch((e) =>{
    // myCall.join({ create: true }).then(
    //   () => setCall(myCall),
    //   () => console.error('Failed to join call', e)
    // )
    const joinAsHost = async () => {
      try {
        await myCall.join({ create: true })
        await myCall.goLive()
        setCall(myCall)
      } catch (error) {
        console.error('Failed to join call', error)
      }
    }
    joinAsHost()
    return () => {
      // myCall.leave().catch((e) =>{
      //   console.error('Failed to leave call', e)
      // })
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
        userId={project.presenter.id}
        userToken={token}
        project={project}
        call={call}
      />
    </StreamCall>
  )
}

export default CustomLivestreamPlayer