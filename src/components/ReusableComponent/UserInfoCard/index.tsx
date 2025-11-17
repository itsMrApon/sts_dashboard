import { cn } from '@/lib/utils'
import { Attendee } from '@prisma/client'
import React from 'react'

type Props = {
  customer: Attendee & { attendedAt?: Date }
  tags: string[] 
  className?: string
}

const formatTime = (date: Date) => {
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
}

const UserInfoCard = ({ customer, tags, className }: Props)=>{
  return (
    <div 
      className={cn(
        'flex flex-col w-full text-primary p-2 pr-4 sm:p-3 sm:pr-10 gap-2 sm:gap-3 rounded-xl border-[0.5px] border-border backdrop-blur-[20px] bg-background/10',
        className
      )}
    >
      <h3 className="font-semibold text-xs sm:text-sm">{customer.name}</h3>
      <p className="text-xs sm:text-sm truncate">{customer.email}</p>
      <div className="flex flex-col gap-1.5 sm:gap-2">
        <div className="flex gap-1 sm:gap-1.5 overflow-x-auto scrollbar-hide pb-1">
          {tags.map((tag, index) => (
            <span 
              key={index}
              className="text-[10px] sm:text-xs text-foreground px-1.5 py-0.5 sm:px-2 rounded-md border border-border whitespace-nowrap flex-shrink-0"
            >
              {tag}
            </span>
          ))}
        </div>
        {customer.attendedAt && (
          <p className="text-[10px] sm:text-xs text-muted-foreground">
            Updated {formatTime(customer.attendedAt)}
          </p>
        )}
      </div>
    </div>
  )
}

export default UserInfoCard