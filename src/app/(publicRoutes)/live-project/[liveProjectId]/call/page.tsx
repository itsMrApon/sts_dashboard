import { getAttendeeById } from '@/actions/attendance'
import { getLiveKitAgentById } from '@/actions/livekitAgent'
import { getProjectbyId } from '@/actions/webiner'
import { WebinarWithPresenter } from '@/lib/type'
import { CtaTypeEnum, WebinarStatusEnum } from '@prisma/client'
import { redirect } from 'next/navigation'
import React from 'react'
import AutoConnectCall from './_components/AutoConnectCall'
import LiveKitCall from './_components/LiveKitCall'

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

  // Book a Call requires an AI agent (Vapi or LiveKit). priceId is only for Buy Now.
  const livekitAgentId = (project as { livekitAgentId?: string | null }).livekitAgentId
  const hasAiAgent = project.aiAgentId || livekitAgentId
  if (project.ctaType !== CtaTypeEnum.BOOK_A_CALL || !hasAiAgent) {
    redirect(`/live-project/${liveProjectId}?error=cannot-book-a-call`)
  }

  // LiveKit agents: render LiveKitCall (same flow as Vapi, different backend)
  if (livekitAgentId && !project.aiAgentId) {
    const livekitResult = await getLiveKitAgentById(livekitAgentId)
    if (livekitResult.success && livekitResult.data?.roomName) {
      return (
        <LiveKitCall
          roomName={livekitResult.data.roomName}
          userName={attendee.data.name}
          assistantName={livekitResult.data.name}
          callTimeLimit={180}
          project={project as WebinarWithPresenter}
          userId={attendeeId}
        />
      )
    }
  }

  if (!project.aiAgentId) {
    redirect(`/live-project/${liveProjectId}?error=cannot-book-a-call`)
  }

  return (
    <AutoConnectCall
      userName={attendee.data.name}
      assistantId={project.aiAgentId}
      assistantName="AI Assistant"
      assistantImage=""
      callTimeLimit={180}
      project={project as WebinarWithPresenter}
      userId={attendeeId}
    />
  )
}

export default page