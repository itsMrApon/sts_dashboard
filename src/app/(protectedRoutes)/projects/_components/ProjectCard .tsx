import React from 'react'
import { Webinar } from '@prisma/client'
import Link from 'next/link'
import Image from 'next/image'
import { format } from 'date-fns'
import { Calendar } from 'lucide-react'
import PipelineIcon from '@/icons/PipelineIcon'

type Props = {
  project: Webinar
}
    
const ProjectCard  = ({project}: Props) => {
  return (
    <div className="flex gap-3 flex-col items-start w-full">
      <Link
        href={`/live-webinar/${project?.id}`}
        className="w-full, max-w-[400px]"
      >
        <Image
          src={'/darkthumbnail.png'}
          alt="project"
          width={400} height= {100}
          className="rounded-md w-[400px]"
        />  
      </Link>
      <div className="w-full flex justify-between gap-3 items-center">
        <Link
          href={`/live-webinar/${project?.id}`}
          className="flex flex-col gap-2 items-start"
        >
          <div>
            <p className="text-sm text-primary font-semibold">
              {project?.title}
            </p>
            <p className="text-xs text-muted-foreground">
              {project?.description}
            </p>
          </div>
          <div className="flex gap-2 justify-start items-center">
            <div className="flex gap-2 items-center text-xs text-muted-foreground">
              <Calendar size={15} />
              <p>{format(new Date (project?.startTime), "dd/MM/yyyy")}</p>
            </div>
          </div>
        </Link>
        <Link
          href={`/projects/${project?.id}/pipeline`}
          className="flex items-center justify-center p-2 rounded-md hover:opacity-80 transition-opacity"
        >
          <PipelineIcon className="w-6 h-6" />
        </Link>
      </div>
    </div>
  )
}

export default ProjectCard 