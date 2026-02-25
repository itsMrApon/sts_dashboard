'use client'
import { User, Webinar, WebinarStatusEnum } from '@prisma/client'
import React, { useState } from 'react'
import CountdownTimer from './CountdownTimer'
import Image from 'next/image'
import WaitingListComponent from './WaitingListComponent'
import { Button } from '@/components/ui/button'
import { changeProjectStatus } from '@/actions/webiner'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Calendar, Clock, Loader2 } from 'lucide-react'
import { format } from 'date-fns'

type Props = {
  project: Webinar
  currentUser: User | null
}

const ProjectUpcomingState = ({ project, currentUser }: Props) => {
  const [ loading, setLoading ] = useState(false)
  const router = useRouter()

  const handleStartWebinar = async () => {
    setLoading(true)
    try {
      if (!currentUser?.id) {
        throw new Error('You are not authorized')
      }

      const res = await changeProjectStatus(project.id, 'LIVE')
      // const res = await changeProjectStatus(project.id, WebinarStatusEnum.LIVE)
      if (!res.success) {
        throw new Error(res.message)
      }
      toast.success('Project started successfully')
      router.refresh()
    } catch (error) {
      console.log(error)
      toast.error('Failed to start project')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full min-h-screen mx-auto max-w-[400px] flex flex-col justify-center items-center gap-8 py-20" >
      <div className="space-y-6">
        <p className="text-3xl font-semibold text-primary text-center">
          Im comming live soon...
        </p>
        <CountdownTimer
          targetDate={project.startTime}
          className="text-center"
          projectId={project.id}
          projectStatus={project.webinarStatus}
        />
      </div>
      <div className="space-y-6 w-full h-full flex justify-center items-center flex-col">
        <div className="w-full max-w-md aspect-[4/3] relative rounded-4xl overflow-hidden mb-6">
          <Image
            src={'/darkthumbnail.png'}
            alt={project.title}
            fill 
            className="object-cover" 
            priority
          />
        </div>
        { project?.webinarStatus === WebinarStatusEnum.SCHEDULED ? (
          <WaitingListComponent
            projectId={project.id}
            // projectStatus="SCHEDULED"
            projectStatus={project.webinarStatus}
            onRegistered={() => {}}
          />
        ) : project?.webinarStatus === WebinarStatusEnum.WAITING_ROOM ? (
            <>
            {currentUser?.id === project?.presenterId ? (
              <Button 
                className="w-full max-w-[300px] font-semibold"
                onClick={handleStartWebinar}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin mr-2" />
                    Starting project...
                  </>
                ) : (
                  'Start Project'
                )
                }
              </Button>
            ) : (
              <WaitingListComponent
                projectId={project.id}
                // projectStatus="WAITING_ROOM"
                projectStatus={project.webinarStatus}
                onRegistered={() => {}}
              />
            )}
          </>
        ) : project?.webinarStatus === WebinarStatusEnum.LIVE? (
          <>
            <WaitingListComponent
              projectId={project.id}
              // projectStatus="LIVE"
              projectStatus={project.webinarStatus}
              onRegistered={() => {}}
            />
          </>
        ) : project?.webinarStatus === WebinarStatusEnum.CANCELLED ? (
          <p className="text-xl text-foreground text-center font-semibold">
            Project Cancelled
          </p>
        ) : (
          <Button>Ended</Button>
        )}
      </div>
      <div className="text-center space-y-4" >
        <h3 className="text-2xl font-semibold text-primary">
          {project?.title}
        </h3>
        <p className="text-muted-foreground text-xs">
          {project?.description}
        </p>
        <div className="w-full justify-center flex gap-2 flex-wrap items-center">
          <Button
            variant={'outline'}
            className="rounded-md bg-secondary backdrop-blur-2x1"
          >
            <Calendar className="mr-2"/>
            {format (new Date(project.startTime),'dd MMMM yyyy')}
          </Button>
          <Button variant={ 'outline'}>
            <Clock className="mr-2"/>
            {format (new Date(project.startTime),'HH:mm a')}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ProjectUpcomingState