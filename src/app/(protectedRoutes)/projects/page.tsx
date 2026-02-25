import React from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Webcam, Users, HomeIcon } from 'lucide-react'
import PageHeader from '@/components/ReusableComponent/PageHeader'
import { onAuthenticateUser } from '@/actions/auth'
import { redirect } from 'next/navigation'
import { getProjectByPresenterId } from '@/actions/webiner'
import ProjectCard from './_components/ProjectCard '
import { Webinar, WebinarStatusEnum } from '@prisma/client'
import Link from 'next/link'

type Props = {
  searchParams: Promise<{
    webinarStatus?: string
  }> 
}

const page = async({searchParams}: Props) => {
  const { webinarStatus } =  await searchParams
  const checkUser = await onAuthenticateUser()

  if (!checkUser.user) {
    redirect('/')
  }

  const webinars = await getProjectByPresenterId(
    checkUser?.user?.id,
    webinarStatus as WebinarStatusEnum
  )

  const now = new Date()
  const upcomingWebinars = webinars.filter((project: Webinar) => {
    const isUpcoming = new Date(project.startTime) > now || 
      (project.webinarStatus === 'SCHEDULED' || 
       project.webinarStatus === 'WAITING_ROOM' || 
       project.webinarStatus === 'LIVE')
    return isUpcoming
  })

  const completedWebinars = webinars.filter((project: Webinar) => {
    const isCompleted = project.webinarStatus === 'ENDED' || 
      project.webinarStatus === 'CANCELLED' ||
      (project.endTime && new Date(project.endTime) < now) ||
      (!project.endTime && new Date(project.startTime) < now)
    return isCompleted
  })

  return (
    <Tabs
      defaultValue="all"
      className="w-full flex flex-col gap-8"
    >
      <PageHeader
        leftIcon={<HomeIcon className="w-3 h-3" />}
        mainIcon={<Webcam className="w-12 h-12" />} 
        rightIcon={<Users className="w-4 h-4" />} 
        heading="The home to all your Projects" 
        placeholder="Search option..."
      >
        <TabsList className="bg-transparent space-x-3">
          <TabsTrigger
            value="all"
            className="bg-secondary opacity-50 data-[state=active]:opacity-100 px-6 py-4"
          >
            <Link href="/webinars?webinarStatus=all">All</Link>
          </TabsTrigger>
          <TabsTrigger 
            value="active"
            className="bg-secondary px-6 py-4"
          >
            <Link href="/webinars?webinarStatus=upcoming">OnDemand</Link>
          </TabsTrigger>
          <TabsTrigger 
            value="completed"
            className="bg-secondary px-6 py-4"
          >
            <Link href="/webinars?webinarStatus=ended">Ended</Link>
          </TabsTrigger>
        </TabsList>
      </PageHeader>
      
      <TabsContent
        value="all"
        className="w-full grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-4 place-items-start place-content-start gap-x-6 gap-y-10"
      >
        {webinars?.length > 0 ? (
          webinars.map((project: Webinar, index: number) => 
            (<ProjectCard
                key={index} 
                project={project} 
              />
          ))
        ) : (
          <div className="w-full h-[200px] flex justify-center items-center text-primary font-semibold text-2x1 col-span-12" >
            No projects found
          </div>
        )}
      </TabsContent>

      <TabsContent
        value="onDemand"
        className="w-full grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-4 place-items-start place-content-start gap-x-6 gap-y-10"
      >
        {webinars?.length > 0 ? (
          webinars.map((project: Webinar, index: number) => 
            (<ProjectCard
                key={index} 
                project={project} 
              />
          ))
        ) : (
          <div className="w-full h-[200px] flex justify-center items-center text-primary font-semibold text-2x1 col-span-12" >
            No onDemand projects found
          </div>
        )}
      </TabsContent>

      <TabsContent
        value="ended"
        className="w-full grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-4 place-items-start place-content-start gap-x-6 gap-y-10"
      >
        {webinars?.length > 0 ? (
          webinars.map((project: Webinar, index: number) => 
            (<ProjectCard
                key={index} 
                project={project} 
              />
          ))
        ) : (
          <div className="w-full h-[200px] flex justify-center items-center text-primary font-semibold text-2x1 col-span-12" >
            No completed projects found
          </div>
        )}
      </TabsContent>
    </Tabs>
  )
}

export default page