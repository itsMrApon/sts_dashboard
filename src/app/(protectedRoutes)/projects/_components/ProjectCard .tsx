'use client'

import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { format } from 'date-fns'
import { Calendar, MessageCircleQuestion, Package, Settings2, Store, Tag, Video } from 'lucide-react'
import PipelineIcon from '@/icons/PipelineIcon'
import ProjectLinksSheet from './ProjectLinksSheet'
import type { CreatorOfferItem } from '@/lib/offers/creatorOffers'
import { WEBINAR_STATUS_LABEL, formatOfferPrice, isWebinarOver } from '@/lib/offers/offerSummary'
import { cn } from '@/lib/utils'

type Props = {
  project: CreatorOfferItem
  shareBaseUrl: string
}

const ProjectCard = ({ project, shareBaseUrl }: Props) => {
  const isProduct = project.kind === 'PRODUCT'
  // Products: what buyers said to your AI lives in the pipeline. Webinars: your host room (until it's over).
  const webinarOver = project.status !== null && isWebinarOver(project.status)
  const roomHref = isProduct
    ? `/projects/${project.id}/pipeline`
    : project.slug && !webinarOver
      ? `/live/${project.slug}/room`
      : `/projects/${project.id}`

  return (
    <div className="flex w-full flex-col items-start gap-3">
      <Link href={roomHref} className="relative w-full max-w-[400px]">
        <Image
            unoptimized
          src={project.thumbnail || '/darkthumbnail.png'}
          alt=""
          width={400}
          height={225}
          className="aspect-[16/9] w-full rounded-md object-cover"
        />
        <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
          <span className="flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">
            {isProduct ? <Package className="h-3 w-3" aria-hidden /> : <Video className="h-3 w-3" aria-hidden />}
            {isProduct ? 'Product' : 'Webinar'}
          </span>
          {project.status ? (
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[11px] font-medium backdrop-blur',
                project.status === 'LIVE' ? 'bg-red-600 text-white' : 'bg-black/70 text-white/80',
              )}
            >
              {WEBINAR_STATUS_LABEL[project.status]}
            </span>
          ) : null}
        </div>
      </Link>
      <div className="flex w-full items-center justify-between gap-3">
        <Link href={roomHref} className="flex min-w-0 flex-col items-start gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-primary">{project.title}</p>
            {project.description ? (
              <p className="line-clamp-2 text-xs text-muted-foreground">{project.description}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {project.startTime ? (
              <span className="flex items-center gap-1.5">
                <Calendar size={14} aria-hidden />
                {format(new Date(project.startTime), 'dd MMM yyyy, HH:mm')}
              </span>
            ) : null}
            <span className="flex items-center gap-1.5">
              <Tag size={14} aria-hidden />
              {project.price ? formatOfferPrice(project.price) : 'No price yet'}
            </span>
            {project.onBusiness ? (
              <span className="flex items-center gap-1.5" title="Listed on your business and recommended by your AI">
                <Store size={14} aria-hidden />
                On business
              </span>
            ) : null}
          </div>
        </Link>
        <div className="flex shrink-0 items-center gap-1">
          <Link
            href={`/projects?edit=${project.id}`}
            scroll={false}
            className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-secondary"
            aria-label="Edit"
          >
            <Settings2 className="h-5 w-5" />
          </Link>
          <ProjectLinksSheet project={project} shareBaseUrl={shareBaseUrl} />
          <Link
            href={`/projects/${project.id}/pipeline`}
            className="flex items-center justify-center rounded-md p-2 transition-opacity hover:opacity-80"
            aria-label="View pipeline"
          >
            <PipelineIcon className="h-6 w-6" />
          </Link>
          <Link
            href={`/projects/${project.id}/questions`}
            className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-secondary"
            aria-label="Questions buyers asked"
            title="Questions buyers asked"
          >
            <MessageCircleQuestion className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </div>
  )
}

export default ProjectCard
