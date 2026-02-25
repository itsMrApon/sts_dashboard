'use client'
import { User, Webinar, WebinarStatusEnum } from '@prisma/client'
import React, { useEffect } from 'react'
import ProjectUpcomingState from './UpcomingProject/ProjectUpcomingState'
import { toast } from 'sonner'
import { usePathname, useRouter } from 'next/navigation'
import { useAttendeeStore } from '@/store/useAttendeeStore'
import LiveStreamState from './LiveProject/LiveStreamState'
import { WebinarWithPresenter } from '@/lib/type'
import Participant from './Participant/Participant'

type Props = {
  error: string | undefined
  user: User | null
  project: WebinarWithPresenter
  apiKey: string
  // token: string
  // callId: string
  recording: StreamCallRecording | null
}

const RenderProject = ({
  error, 
  user, 
  project, 
  apiKey, 
  // token, 
  // callId,
  recording,
}: Props) => {
  const router = useRouter()
  const pathname = usePathname()

  const { attendee } = useAttendeeStore()

  useEffect(() => {
    if (error) {
      toast.error(error)
      router.push(pathname)
    }
  }, [error])


  if (!project) {
    return null
  }

  return (
    <React.Fragment>
      {project.webinarStatus === WebinarStatusEnum.LIVE ? (
        <React.Fragment>
          {user?.id === project.presenterId ? (
            <LiveStreamState
              apiKey={apiKey}
              callId={project.id}
              project={project}
              user={user}
            />
          ) : attendee ? (
            <Participant
              apiKey={apiKey}
              callId={project.id}
              project={project}
            />
            ) : (
              <ProjectUpcomingState
                project={project}
                currentUser={user || null}
              />
          )}
        </React.Fragment>
      ):project.webinarStatus === WebinarStatusEnum.CANCELLED ? (
        <div className="flex justify-center items-center h-full w-full">
          <div className="text-center space-y-4">
            <h3 className="text-2x1 font-semibold text-primary">
              {project?.title}
            </h3>
            <p className="text-muted-foreground text-xs">
              This project has been cancelled.
            </p>
          </div>
        </div>
      ) : project.webinarStatus === WebinarStatusEnum.ENDED ? (
        recording?.url ? (
          <div className="w-full flex justify-center">
            <div
              className="relative w-full max-w-4xl overflow-hidden rounded-lg bg-black"
              style={{ paddingTop: '56.25%' }}
            >
              {/* <video
                className="w-full h-full rounded-lg"
                controls
                src={recording?.url}
              >
              </video> */}
              <p> this is the recording</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center items-center h-full w-full">
            <div className="text-center space-y-4">
              <h3 className="text-4xl font-semibold text-primary">
                {project?.title}
              </h3>
              <p className="text-muted-foreground text-xl">
                This project has ended. No recording is available.
              </p>
            </div>
          </div>
        )
      ) : (
        <ProjectUpcomingState
          project={project}
          currentUser={user || null}
        />
      )}
    </React.Fragment>




      
    // build a waiting room component for the scheduled project
    // <React.Fragment>
    //   {project.webinarStatus === WebinarStatusEnum.SCHEDULED ? (
    //     <ProjectUpcomingState
    //       project={project}
    //       currentUser={user || null}
    //     />  
    //   ) : project.webinarStatus === WebinarStatusEnum.WAITING_ROOM ?(
    //     <ProjectUpcomingState
    //       project={project}
    //       currentUser={user || null}
    //     />  
    //   ):project.webinarStatus === WebinarStatusEnum.LIVE ? (
    //     // add live stream component here 
    //     <React.Fragment>
    //       {user?.id === project.presenterId ? (
    //         <LiveStreamState
    //           apiKey={apiKey}
    //           token={token}
    //           callId={callId}
    //           project={project}
    //           user={user}
    //         />
    //       ) : //todo add live stream component here 
    //       attendee ? (
    //         <Participant
    //           apiKey={apiKey}
    //           project={project}
    //           callId={callId}
    //         />
    //       ) : (
    //         <ProjectUpcomingState
    //           project={project}
    //           currentUser={user || null}
    //         />
    //       )}
    //     </React.Fragment>  
    //   ):project.webinarStatus === WebinarStatusEnum.CANCELLED ? (
    //    <div className="flex justify-center items-center h-full w-full">
    //     <div className="text-center space-y-4">
    //       <h3 className="text-2xl font-semibold text-primary">
    //         {project.title}
    //       </h3>
    //       <p className="text-muted-foreground text-xs" >
    //         This project has been cancelled.
    //       </p>
    //     </div>
    //    </div> 
    //   ):(
    //     <ProjectUpcomingState
    //       project={project}
    //       currentUser={user || null}
    //     />
    //   )}
    // </React.Fragment>
  )
}

export default RenderProject