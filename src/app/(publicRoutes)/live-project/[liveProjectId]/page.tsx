import { getProjectbyId } from '@/actions/webiner'
import React from 'react'

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
  if (!ProjectData) {
    return(
      <div className="w-full min-h-screen flex justify-center items-center text-lg sm:text-4x1">
        Project not found
      </div>
    )
  }

  const checkUser = await onAuthenticateUser()

  return (
    <div>page</div>
  )
}

export default page