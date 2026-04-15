import { 
  StreamVideo,
  StreamVideoClient,
  User as StreamUser,
} from '@stream-io/video-react-sdk'
import { WebinarWithPresenter } from '@/lib/type'
import { User } from '@prisma/client'
import React, { useEffect, useState, useRef } from 'react'
import CustomLivestreamPlayer from './CustomLivestreamPlayer'
import { getTokenForHost } from '@/actions/streamIo'

type Props = {
  apiKey: string
  callId: string
  project: WebinarWithPresenter
  user: User
}

const LiveStreamState = ({ apiKey, callId, project, user }: Props) => {
  const [hostToken, setHostToken] = useState<string | null>(null)
  const [client, setclient] = useState<StreamVideoClient | null>(null)
  const clientRef = useRef<StreamVideoClient | null>(null)

  useEffect(() => {
    const init = async () => {
      try {
        const token = await getTokenForHost(
          project.presenterId,
          project.presenter.name,
          project.presenter.profileImage,
        )
        const hostUser: StreamUser = {
          id: project.presenterId,
          name: project.presenter.name,
          image: project.presenter.profileImage,
        }
        const streamClient = new StreamVideoClient({
          apiKey,
          user: hostUser,
          token,
        })
        clientRef.current = streamClient
        setHostToken(token)
        setclient(streamClient)
      } catch (error) {
        console.error('Error initializing client:', error)
      }
    }
    init()
    return () => {
      const c = clientRef.current
      clientRef.current = null
      if (c) {
        c.disconnectUser().catch((err) => console.error('Disconnect cleanup:', err))
      }
    }
  }, [apiKey, project])

  if (!client || !hostToken) return null

  return (
    <StreamVideo client={client}>
      <CustomLivestreamPlayer
        callId={callId}
        callType="livestream"
        project={project}
        username={user.name}
        token={hostToken}
      />
    </StreamVideo>
  )
}

export default LiveStreamState