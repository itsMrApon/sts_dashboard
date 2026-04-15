import Link from 'next/link'
import React from 'react'
import RightIcon from '@/icons/RightIcon'
import { cn } from '@/lib/utils'

type Props = {
  children: React.ReactNode
  heading: string
  link: string
  className?: string
}

const FeatureSectionLayout = ({ children, heading, link, className }: Props) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-between gap-10 rounded-3xl border border-border bg-background-10 p-10',
        className,
      )}
    >
      {children}
      <div className="w-full justify-between items-center flex flex-wrap gap-10">
        <h3 className="sm:w- [70%] font-semibold text-3x1 text-primary">
          {heading}
        </h3>
        <Link 
            href={link} 
            className="text-primary font-semibold text-lg flex items-center justify-center rounded-md opacity-50"
          >
            view <RightIcon className="m1-2 w-6 h-6" />
        </Link>
      </div>
    </div>
  )
}

export default FeatureSectionLayout