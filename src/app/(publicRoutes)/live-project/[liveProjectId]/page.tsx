import { onAuthenticateUser } from '@/actions/auth'
import { getProjectbyId } from '@/actions/webiner'
import React from 'react'
import RenderProject from './_components/RenderProject'
import { WebinarWithPresenter } from '@/lib/type'
import { WebinarStatusEnum } from '@prisma/client'

type Props = {
  params: Promise<{
    liveProjectId: string
  }>
  searchParams: Promise<{
    error: string
  }>
}

const page = async ({params, searchParams}: Props) => {
  const {liveProjectId} = await params
  const {error} = await searchParams
  
  const ProjectData = await getProjectbyId(liveProjectId)
  let recording: null

  if (ProjectData?.webinarStatus === WebinarStatusEnum.ENDED) {
    // recording logic here 
    // recording = await getStreamRecording(liveProjectId)
  }
  if (!ProjectData) {
    return(
      <div className="w-full min-h-screen flex justify-center items-center text-lg sm:text-4x1">
        Project not found
      </div>
    )
  }

  const checkUser = await onAuthenticateUser()

  //todo check if user is the presenter
  const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY as string
  // const token = process.env.STREAM_TOKEN as string
  // const callId = process.env.STREAM_CALL_ID as string


  return (
    <div className="w-full min-h-screen mx-auto">
      <RenderProject
        error={error}
        user={checkUser.user || null}
        project={ProjectData as WebinarWithPresenter}
        apiKey={apiKey}
        // token={token}
        // callId={callId}
        // recording={recording?.data || null}
        recording={null}
      />
    </div>
  )
}

export default page