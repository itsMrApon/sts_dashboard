'use client'

import React from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import { AudioLines, Cable, Megaphone } from 'lucide-react'
import { CanvasRevealEffect } from '@/components/ui/canvas-reveal-effect'
import { withRoomQuery } from '../_lib/messagingRooms'

type Props = {
  roomName: string | null
}

export function MessagesHubCards({ roomName }: Props) {
  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col items-stretch gap-4 lg:flex-row">
      <HubCard
        href={withRoomQuery('/messages/voice', roomName)}
        title="Voice AI"
        description="Web chat, embed, and workspace for this room."
        icon={<AudioLines className="h-10 w-10" aria-hidden />}
      >
        <CanvasRevealEffect animationSpeed={5.1} containerClassName="bg-emerald-900" />
      </HubCard>
      <HubCard
        href={withRoomQuery('/messages/connections', roomName)}
        title="Connections"
        description="Attach Telegram, Discord, or Slack to this room."
        icon={<Cable className="h-10 w-10" aria-hidden />}
      >
        <CanvasRevealEffect
          animationSpeed={3}
          containerClassName="bg-black"
          colors={[
            [236, 72, 153],
            [232, 121, 249],
          ]}
          dotSize={2}
        />
        <div className="absolute inset-0 bg-black/50 [mask-image:radial-gradient(400px_at_center,white,transparent)] dark:bg-black/90" />
      </HubCard>
      <HubCard
        href={withRoomQuery('/messages/publish', roomName)}
        title="Publish"
        description="Edit the website business details for this room."
        icon={<Megaphone className="h-10 w-10" aria-hidden />}
      >
        <CanvasRevealEffect
          animationSpeed={3}
          containerClassName="bg-sky-600"
          colors={[[125, 211, 252]]}
        />
      </HubCard>
    </div>
  )
}

function HubCard({
  href,
  title,
  description,
  icon,
  children,
}: {
  href: string
  title: string
  description: string
  icon: React.ReactNode
  children?: React.ReactNode
}) {
  const [hovered, setHovered] = React.useState(false)

  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      aria-label={`${title}: ${description}`}
      className="group/canvas-card relative flex h-full min-h-[16rem] w-full flex-1 items-center justify-center border border-black/[0.2] p-4 dark:border-white/[0.2] lg:min-h-0"
    >
      <CornerIcon className="absolute -left-3 -top-3 h-6 w-6 text-black dark:text-white" />
      <CornerIcon className="absolute -bottom-3 -left-3 h-6 w-6 text-black dark:text-white" />
      <CornerIcon className="absolute -right-3 -top-3 h-6 w-6 text-black dark:text-white" />
      <CornerIcon className="absolute -bottom-3 -right-3 h-6 w-6 text-black dark:text-white" />

      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 h-full w-full"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-20 px-4 text-center">
        <div className="mx-auto flex w-full items-center justify-center text-black transition duration-200 group-hover/canvas-card:-translate-y-4 dark:text-white group-hover/canvas-card:text-white">
          {icon}
        </div>
        <h2 className="relative z-10 mt-4 text-xl font-bold text-black transition duration-200 group-hover/canvas-card:-translate-y-2 group-hover/canvas-card:text-white dark:text-white">
          {title}
        </h2>
        <p className="relative z-10 mt-2 text-sm text-muted-foreground transition duration-200 group-hover/canvas-card:text-white/80">
          {description}
        </p>
      </div>
    </Link>
  )
}

function CornerIcon({ className, ...rest }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="1.5"
      stroke="currentColor"
      className={className}
      aria-hidden
      {...rest}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
    </svg>
  )
}
