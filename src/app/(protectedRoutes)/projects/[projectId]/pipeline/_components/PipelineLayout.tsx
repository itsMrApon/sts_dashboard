import UserInfoCard from '@/components/ReusableComponent/UserInfoCard'
import { Badge } from '@/components/ui/badge'
import { Attendee } from '@prisma/client'
import React from 'react'

type Props = {
  title: string 
  count: number
  users: Attendee[]
  tags: string[]
}

const PipelineLayout = ({title, count, users, tags}: Props) => {
  return (
    <div className="flex-shrink-0 w-[280px] sm:w-[350px] p-3 sm:p-5 border border-border bg-background/10 rounded-xl backdrop-blur-2x1">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h2 className="font-medium text-sm sm:text-base">{title}</h2>
        <Badge variant="secondary">{count}</Badge>
      </div>
      <div className="space-y-2 sm:space-y-3 max-h-[70vh] overflow-y-auto pr-1 sm:pr-2 scrollbar-hide">
        {users.map((user) => (
          <UserInfoCard
            key={user.id}
            customer={user}
            tags={tags}
          />
        ))}
      </div>
    </div>
  )
}

export default PipelineLayout