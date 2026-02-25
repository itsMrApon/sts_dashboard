'use client'
import { getStreamIoToken } from '@/actions/streamIo';
import { Button } from '@/components/ui/button';
import { WebinarWithPresenter } from '@/lib/type';
import { useAttendeeStore } from '@/store/useAttendeeStore';
import { StreamCall, StreamVideo, StreamVideoClient, type User } from '@stream-io/video-react-sdk';
import { AlertCircle, Loader2, WifiOff } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react'
import LiveProjectView from '../Common/LiveProjectView';

type Props = {
  apiKey: string; 
  callId: string; 
  project: WebinarWithPresenter;
}

const Participant = ({apiKey, callId, project}: Props) => {
  const { attendee } = useAttendeeStore()
  const [showChat, setShowChat] = useState<boolean>(true)
  const [client, setClient] = useState<StreamVideoClient | null>(null)
  const [call, setCall] = useState<Call | null>(null)
  const [token, setToken] = useState<string | null> (null)
  const [errorMessage, setErrorMessage] = useState<string | null> (null)
  const [connectionStatus, setConnectionStatus] = useState<
  'connecting' | 'failed' | 'reconnecting' | 'connected'
  > ('connecting')

  const clientInitialized = useRef<boolean>(false)

  useEffect(() => {
    if (clientInitialized.current) return
    const initClient = async () => {
      try {
        setConnectionStatus('connecting')
        const user: User = {
          id: attendee?.id || 'guest',
          name: attendee?.name || 'Guest',
          image: `https://api.dicebear.com/7.x/initials/svg?seed=${
          attendee?.name || 'Guest'}`
        }
        const userToken = await getStreamIoToken (attendee)
        setToken(userToken)

        const streamClient = new StreamVideoClient({
          apiKey,
          user,
          token: userToken,
        })
        streamClient.on('connection.changed',
          (event) => {
            if (event.online) {
              setConnectionStatus('connected')
            } else {
              setConnectionStatus('reconnecting')
            }
          })

          await streamClient.connectUser(user, userToken)
          const streamCall = streamClient.call('livestream', callId)
          await streamCall.join({ create: false })

          setClient(streamClient)
          setCall(streamCall)
          setConnectionStatus ('connected')
          clientInitialized.current = true;
          
        } catch (error) {
          console.error('Error initializing client or joining call:', error)
          setConnectionStatus('failed')
          setErrorMessage(
            error instanceof Error 
            ? error.message 
            : 'Failed to join call on project'
          )
      }
    }
    initClient()

    return () => {
      const currentCall = call
      const currentClient = client
      if (currentCall && currentClient) {
        currentCall
        .leave()
        .then(() =>{
          console.log('Successfully left call')
          currentClient.disconnectUser()
          clientInitialized.current = false
        })
        .catch((error) =>{
          console.error('Error leaving call:', error)
        })
      }
    }  
  }, [apiKey, callId, attendee, call, client, project.id])

  if (!attendee) {
    return (
      <div className="flex items-center justify-center h-screen bg-background text-foreground">
        <div className="text-center max-w-md p-8 rounded-1g border border-border bg-card">
          <h2 className="text-2xl font-bold mb-4">
            Please register to join the live project
          </h2>
          <p className="text-muted-foreground mb-6">
            Register is required to join the live project
          </p>
          <Button
            onClick={() => window.location.reload()}
            className="bg-accent-primary hover:bg-accent-primary/90 text-accent-foreground"
          >
            Register Now
          </Button>  
        </div>
      </div>
    )
   }

   if (!client || !call || !token) {
    return (
       <div className="flex items-center justify-center h-screen bg-background text-foreground">
        <div className="text-center max-w-md p-8 rounded-1g border border-border bg-card">
          {connectionStatus === 'connecting' && (
          <>
            <div className="relative mx-auto w-24 h-24 mb-6">
              <div className="absolute inset-3 rounded-full bg-card flex items-center justify-center">
                <Loader2 className="h-10 w-10 text-accent-primary animate-spin" />
              </div>
            </div>
            <h2 className="text-xl font-semibold mb-2">Joining project...</h2>
            <p className="text-muted-foreground">
              connecting to {project.title}...
            </p>
            <div className="mt-6 flex justify-center space-x-1">
              <span className="h-2 w-2 bg-accent-primary rounded-full animate-bounce"></span>
              <span 
                className="h-2 w-2 bg-accent-primary rounded-full animate-bounce"
                style={{ animationDelay: '0.2s' }}
              ></span>
              <span 
                className="h-2 w-2 bg-accent-primary rounded-full animate-bounce"
                style={{ animationDelay: '0.4s' }}
              ></span>
            </div>
          </>
          )}

          {connectionStatus === 'reconnecting' && (
            <>
              <div className="mx-auto w-16 h-16 mb-4 text-amber-500">
                <WifiOff className="h-16 w-16 animate-pulse" />
              </div> 
              <h2 className="text-xl font-semibold mb-2">Reconnecting</h2>
              <p className="text-muted-foreground mb-4" >
                Lost connection to the project. Reconnecting...
              </p>
              <div className="w-full bg-muted rounded-full h-2 mb-6" >
                <div 
                  className=" bg-amber-500 h-2 rounded-full animate-pulse"
                  style={{ width: '60%' }}
                ></div>
              </div>
            </>
          )}

          {connectionStatus === 'failed' && (
            <>
            <div className="mx-auto w-16 h-16 mb-4 text-destructive">
              <AlertCircle className="h-16 w-16" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Connection Failed</h2>
            <p className="text-muted- foreground mb-6">
              {errorMessage || 'Unable to connect to the webinar.'}
            </p>
            <div className="flex space-x-4 justify-center">
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
              >
                Try Again
              </Button>
              <Button
                className="bg-accent-primary hover:bg-accent-primary/90 text-accent-foreground"            
                variant="outline"
                onClick={() => (window.location.href = '/')}
              >
                Go Back to Home
              </Button>
            </div>
            </>
          )}
        </div>
       </div>
    )
  }
  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <LiveProjectView
          showChat={showChat}
          setShowChat={setShowChat}
          project={project}
          username={attendee.name}
          userId={attendee.id}
          userToken={token}
          call={call}
        />
      </StreamCall>
    </StreamVideo>
  )
}

export default Participant