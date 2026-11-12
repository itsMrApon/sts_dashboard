'use client'

import React from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import { Building2, ClipboardList, MessageSquare, Mic, Wand2 } from 'lucide-react'
import { CanvasRevealEffect } from '@/components/ui/canvas-reveal-effect'
import { cn } from '@/lib/utils'

export type HubStatus = { label: string; on: boolean }

type Props = {
  status: { chat: HubStatus; speak: HubStatus; form: HubStatus; wizard: HubStatus; business: HubStatus }
}

/** The five services, as swipeable canvas-reveal cards (scroll/swipe left–right; snaps per card). */
export function MessagesHubCards({ status }: Props) {
  return (
    <div
      className="-mx-4 flex h-[calc(100dvh-14rem)] min-h-[22rem] snap-x snap-mandatory gap-9 overflow-x-auto scroll-smooth px-7 pb-5 pt-4 [scrollbar-width:thin]"
      aria-label="Services"
    >
      <HubCard href="/messages/chat" title="Chat AI" description="Text chat in your own chat box." status={status.chat} icon={<MessageSquare className="h-10 w-10" aria-hidden />}>
        <CanvasRevealEffect animationSpeed={5.1} containerClassName="bg-emerald-900" />
      </HubCard>
      <HubCard href="/messages/speak" title="Speak AI" description="Real-time voice calls with your AI." status={status.speak} icon={<Mic className="h-10 w-10" aria-hidden />}>
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
      <HubCard href="/messages/form" title="Form" description="Callback / lead form, your design." status={status.form} icon={<ClipboardList className="h-10 w-10" aria-hidden />}>
        <CanvasRevealEffect animationSpeed={3} containerClassName="bg-sky-600" colors={[[125, 211, 252]]} />
      </HubCard>
      <HubCard href="/messages/wizard" title="Wizard" description="Voice-guided tour of your website." status={status.wizard} icon={<Wand2 className="h-10 w-10" aria-hidden />}>
        <CanvasRevealEffect animationSpeed={4} containerClassName="bg-indigo-950" colors={[[129, 140, 248], [34, 211, 238]]} />
      </HubCard>
      <HubCard href="/messages/publish" title="Business" description="Profile, services and links your AI uses." status={status.business} icon={<Building2 className="h-10 w-10" aria-hidden />}>
        <CanvasRevealEffect animationSpeed={3} containerClassName="bg-amber-900" colors={[[251, 191, 36]]} />
      </HubCard>
    </div>
  )
}

function HubCard({
  href,
  title,
  description,
  status,
  icon,
  children,
}: {
  href: string
  title: string
  description: string
  status: HubStatus
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
      aria-label={`${title}: ${description} (${status.label})`}
      className="group/canvas-card relative flex h-full w-[78%] shrink-0 snap-start items-center justify-center border border-black/[0.2] p-4 dark:border-white/[0.2] sm:w-[16rem] xl:w-auto xl:min-w-[13rem] xl:flex-1"
    >
      <CornerIcon className="absolute -left-3 -top-3 h-6 w-6 text-black dark:text-white" />
      <CornerIcon className="absolute -bottom-3 -left-3 h-6 w-6 text-black dark:text-white" />
      <CornerIcon className="absolute -right-3 -top-3 h-6 w-6 text-black dark:text-white" />
      <CornerIcon className="absolute -bottom-3 -right-3 h-6 w-6 text-black dark:text-white" />

      <span
        className={cn(
          'absolute right-3 top-3 z-20 rounded-full px-2 py-0.5 text-[10px] font-medium',
          status.on ? 'bg-white text-zinc-900' : 'bg-white/10 text-muted-foreground',
        )}
      >
        {status.label}
      </span>

      <AnimatePresence>
        {hovered && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 h-full w-full">
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
