import { getWebinarAttendance } from '@/actions/attendance'
import PageHeader from '@/components/ReusableComponent/PageHeader'
import PipelineIcon from '@/icons/PipelineIcon'
import { AttendedTypeEnum } from '@prisma/client'
import { HomeIcon, Users } from 'lucide-react'
import React from 'react'
import PipelineLayout from './_components/PipelineLayout'
import { formatColumnTitle } from './_components/utils'
import { buyNowWebinarAttendanceData } from './_components/__tests__/data'

type Props = {
  params: Promise<{
    projectId: string
  }>
}

const page = async ({params}: Props) => {
  const {projectId} = await params
  const pipelineData = await getWebinarAttendance(projectId)
  // const pipelineData = buyNowWebinarAttendanceData

  if (!pipelineData.data) {
    return (
      <div className="text-3xl h-[400px] flex justify-center items-center">
        No Pipeline data found
      </div>
    )
  }
  // todo details  and show real data
  return (
    <div className="w-full flex flex-col gap-8">
      <PageHeader
        leftIcon={<Users className="w-4 h-4" />}
        mainIcon={<PipelineIcon className="w-12 h-12"/>}
        rightIcon={<HomeIcon className="w-3 h-3" />}
        heading="Keep track of all of your customers"
        placeholder="Search Name, Tag or Email"
      />
      <div className="flex overflow-x-auto pb-4 gap-2 sm:gap-4 md:gap-6">
        {Object.entries(pipelineData.data).map(([columnType, columnData]) => (
          <PipelineLayout
            key={columnType} 
            title={formatColumnTitle(columnType as AttendedTypeEnum)}
            count={columnData.count} 
            users={columnData.users} 
            tags={pipelineData.webinarTags}
          />
        ))}
      </div>
    </div>
  )
}

export default page