'use client'
import { changeProjectStatus } from '@/actions/webiner'
import { Loader2, MessageSquare, Users } from 'lucide-react'
import { WebinarWithPresenter } from '@/lib/type'
import 'stream-chat-react/dist/css/v2/index.css'

import { useCallStateHooks, ParticipantView, type Call } from '@stream-io/video-react-sdk'
import { StreamChat } from 'stream-chat'
import React, { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { CtaTypeEnum } from '@prisma/client'
import { useRouter } from 'next/navigation'
import { Chat, Channel, MessageList, MessageInput } from 'stream-chat-react'
import CTADialogBox from './CTADialogBox'
import { toast } from 'sonner'
import ObsDialogBox from './ObsDialogBox'

type Props = {
  showChat: boolean 
  setShowChat: (show: boolean) => void
  project: WebinarWithPresenter
  isHost?:boolean
  username: string 
  userId: string
  call: Call,
  userToken: string
}

const LiveProjectView = ({
  showChat, 
  setShowChat, 
  project, 
  isHost,
  username,
  userId,
  userToken,
  call,
}: Props) => {

  const { useParticipantCount, useParticipants } = useCallStateHooks ();
  const participants = useParticipants();
  const hostParticipant = participants.length > 0 ? participants [0] : null;
  const viewerCount = useParticipantCount();
  const [chatClient, setChatClient] = useState<StreamChat | null>(null);
  const [channel, setChannel] = useState<any> (null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const [obsDialogBox, setObsDialogBox] = useState(false)
  const recordingStartedRef = useRef(false)

  const handleEndStream = async () => {
    setLoading(true)
    try {
      call.stopLive({
        continue_recording: false,
      })
      call.endCall()


      const res = await changeProjectStatus(project.id, "ENDED");
      if (!res.success) {
        throw new Error(res.message)
      }
      toast.success('Project ended successfully')
      router.push('/');
    } catch (error) {
      console.log('Error ending stream', error)
      toast.error('Failed to end stream')
    } finally {
      setLoading(false)
    }
  }


  const handleCTAButtonClick = async () => { 
    if (!channel) return
    console.log('CTA button clicked', channel)
    await channel.sendEvent({
      type: 'open_cta_dialog',
    })
  }

  useEffect (() => {
    // if (!project) return
    const initChat = async () => {
      const client = StreamChat.getInstance(
        process.env.NEXT_PUBLIC_STREAM_API_KEY!
      )
      await client.connectUser (
        {
          id: userId, 
          name: username,
        }, 
        userToken
      )
      const channel = client.channel( 'livestream', project.id, {
        name: project.title,
      })
      await channel.watch()

      setChatClient (client)
      setChannel (channel)
    }
    initChat()

    return () => {
     if (chatClient) {
      chatClient.disconnectUser()
     }
    }
  }, [userId, username, userToken, project.id, project.title]);

  useEffect (() => {
    if (chatClient && channel) {
      channel.on ((event: any) => {
        if (event.type === 'open_cta_dialog' && !isHost) {
          setDialogOpen (true)
        }
        // console. Log("New message:", event); s
        if (event.type === 'start_live') {
          window.location.reload ();
        }
      });
    }
  }, [chatClient, channel, isHost]);


  // feature to record the stream
  useEffect(() => {
    if (!isHost) return
    const logAllEvents = (event: unknown) => {
      console.log('call.all', event)
    }
    call.on('all', logAllEvents)
    const markRecordingStarted = () => {
      recordingStartedRef.current = true
    }
    call.on('call.recording_started', markRecordingStarted)
    const startRecording = async () => {
      try {
        if (recordingStartedRef.current) return
        const record = (call as any).startRecording
        if (typeof record === 'function') {
          await record.call(call)
          recordingStartedRef.current = true
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to start recording'
        if (!message.includes('already being recorded')) {
          console.error('Failed to start recording', error)
          toast.error('Failed to start recording')
        }
      }
    }
    const onBroadcastStarted = () => {
      startRecording()
    }
    call.on('call.rtmp_broadcast_started', onBroadcastStarted)
    return () => {
      call.off('all', logAllEvents)
      call.off('call.recording_started', markRecordingStarted)
      call.off('call.rtmp_broadcast_started', onBroadcastStarted)
    }
  }, [call, isHost]);


  if (!chatClient || !channel) return null;

  return (
    <div className="flex flex-col w-full h-screen max-h-screen overflow-hidden bg-background text-foreground">
      <div className="py-2 px-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="bg-accent-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium flex items-center">
            <span className="relative flex h-2 w-2 mr-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive animate-pulse"></span>
            </span>
            LIVE
          </div>
        </div>

        <div className="flex items-center space-x-1 bg-muted/50 px-3 py-1 rounded-full">
          <div className="flex items-center space-x-3">
            <Users size={16} />
            <span className="text-sm"> {viewerCount}</span>
          </div>
          <button
            onClick={()=> setShowChat(!showChat)}
            className={`px-3 py-1 rounded-full text-sm flex items-center space-x-1 ${
              showChat 
               ? "bg-accent-primary text-primary-foreground"
               : "bg-muted/50"
            }`}
          >
            <MessageSquare size={16} />
            <span>Chat</span>
          </button>
        </div>
      </div>
      <div className="flex flex-1 p-2 gap-2 overflow-hidden">
        <div className="flex-1 rounded-lg overflow-hidden border border-border flex flex-col bg-card">
          <div className="flex-1 relative overflow-hidden">
            {hostParticipant ? (
              <div className={`w-full h-full`}>
                <ParticipantView
                participant={hostParticipant}
                className="w-full h-full object-cover !max-w-full"
                />
              </div> 
            ): (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground flex-col space-y-4">
                <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center">
                  < Users
                    size={40} 
                    className="text-muted-foreground"
                  />
                </div>
                <p>Waiting for stream to start... </p>
              </div>
            )}

            {isHost && (
              <div className="absolute top-4 right-4 bg-background/80 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium">
                Host
              </div>
            )}
          </div>
          <div className="p-2 border-t border-border flex items-center justify-between py-2">
            <div className="flex items-center space-x-2">
              <div className="text-sm font-medium capitalize">
                {project?.title}
              </div>
            </div>

            {isHost 
              && (
              <div className="flex items-center space-x-1">
                <Button 
                  onClick={() => setObsDialogBox (true)}
                  variant="outline"
                  className="mr-2"
                  >Observe
                </Button>
                <Button
                  onClick={async () => {
                    await channel.sendEvent({
                      type: 'start_live',
                    })
                  }}
                  variant="outline"
                  className="mr-2"
                >
                    Go Live
                </Button>
                <Button onClick={handleEndStream} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin mr-2" />
                      Loading...
                    </>
                  ) : (
                    'End Stream'
                  )}
                </Button>
                <Button onClick={handleCTAButtonClick}>
                  {project.ctaType === CtaTypeEnum.BOOK_A_CALL
                    ?'Book a Call'
                    :'Buy Now'}
                </Button>
              </div>
            )}
          </div>
        </div>

        {showChat && (
          <Chat client={chatClient}>
            <Channel channel={channel}>
              <div className="w-72 bg-card border border-border rounded-lg overflow-hidden flex flex-col">
                <div className="py-2 text-primary px-3 border-b border-border font-medium flex items-center justify-between">
                  <span>Chat</span>
                  <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                    {viewerCount} viewers
                  </span>
                </div>

                <MessageList />

                <div className="p-2 border-t border-border">
                  <MessageInput />
                </div>
              </div>
            </Channel>  
          </Chat>  
        )}
      </div>

      {/* todo: add CTA dialog box here */}
      {dialogOpen &&(
        <CTADialogBox
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          project={project}
          userId={userId}
        />
      )}
      {obsDialogBox && (
        <ObsDialogBox
          open={obsDialogBox}
          onOpenChange={setObsDialogBox}
          rtmpURL={`rtmps://ingress.stream-io-video.com:443/${process.env.NEXT_PUBLIC_STREAM_API_KEY}.livestream.${project.id}`}
          streamKey={userToken}
        />
      )}
    </div>
  )
}

export default LiveProjectView