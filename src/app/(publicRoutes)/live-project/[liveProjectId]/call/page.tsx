import { getAttendeeById } from '@/actions/attendance'
import { getProjectbyId } from '@/actions/webiner'
import { WebinarWithPresenter } from '@/lib/type'
import { CallStatusEnum, CtaTypeEnum, WebinarStatusEnum } from '@prisma/client'
import { redirect } from 'next/navigation'
import React from 'react'
import AutoConnectCall from './_components/AutoConnectCall'

type Props = {
  params: Promise<{
    liveProjectId: string
  }>
  searchParams: Promise<{
    attendeeId: string
  }>
}

const page = async ({params, searchParams}: Props) => {
  const {liveProjectId} = await params
  const {attendeeId} = await searchParams

  if (!liveProjectId || !attendeeId) {
    redirect('/404')
  }
  const attendee = await getAttendeeById(attendeeId, liveProjectId)

  if (!attendee.data) {
    redirect(`/live-project/${liveProjectId}?error=attendee-not-found`)
  }

  const project = await getProjectbyId(liveProjectId)
  if (!project) {
    redirect('/404')
  }

  if (
    project.webinarStatus === WebinarStatusEnum.WAITING_ROOM ||
    project.webinarStatus === WebinarStatusEnum.SCHEDULED
  ) {
    redirect(`/live-project/${liveProjectId}?error=project-not-started`)
  }

  if(
    project.ctaType !== CtaTypeEnum.BOOK_A_CALL ||
    !project.aiAgentId ||
    !project.priceId 
  ) {
    redirect(`/live-project/${liveProjectId}?error=cannot-book-a-call`)
  }

  if(attendee.data.callStatus === CallStatusEnum.COMPLETED) {
    redirect(`/live-project/${liveProjectId}?error=call-not-pending`)
  }

  return (
    <AutoConnectCall
      userName={attendee.data.name}
      assistantId={project.aiAgentId}
      project={project as WebinarWithPresenter} 
      userId={attendeeId}
    />
  )
}

export default page