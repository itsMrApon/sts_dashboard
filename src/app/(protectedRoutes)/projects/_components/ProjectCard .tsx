'use client'

import React from 'react'
import { Webinar, WebinarKind } from '@prisma/client'
import Link from 'next/link'
import Image from 'next/image'
import { format } from 'date-fns'
import { Calendar } from 'lucide-react'
import PipelineIcon from '@/icons/PipelineIcon'
import ProjectLinksSheet from './ProjectLinksSheet'

type Props = {
  project: Webinar
  hostUser: {
    id: string
    name: string
    profileImage: string
  }
}
    
const ProjectCard  = ({project}: Props) => {
  const isProduct = project.kind === WebinarKind.PRODUCT
  const roomHref = isProduct
    ? `/live-product/${project.id}`
    : `/live-project/${project.id}`

  return (
    <div className="flex gap-3 flex-col items-start w-full">
      <Link
        href={roomHref}
        className="w-full, max-w-[400px]"
      >
        <Image
          src={project.thumbnail || '/darkthumbnail.png'}
          alt="project"
          width={400}
          height={225}
          className="rounded-md w-[400px] aspect-[16/9] object-cover"
        />  
      </Link>
      <div className="w-full flex justify-between gap-3 items-center">
        <Link
          href={roomHref}
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
        <div className="flex items-center gap-1">
          <ProjectLinksSheet project={project} />
          <Link
            href={`/projects/${project?.id}/pipeline`}
            className="flex items-center justify-center p-2 rounded-md hover:opacity-80 transition-opacity"
            aria-label="View pipeline"
          >
            <PipelineIcon className="w-6 h-6" />
          </Link>
        </div>
      </div>
    </div>
  )
}

export default ProjectCard 