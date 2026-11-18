'use client'

import React from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import { Building2, ClipboardList, MessageSquare, Mic, Wand2 } from 'lucide-react'
import { CanvasRevealEffect } from '@/components/ui/canvas-reveal-effect'
import { PageViewport } from '@/components/ReusableComponent/PageViewport'
import { WarpRing, useWarpRingSlot } from '@/components/ui/warp-ring'
import { cn } from '@/lib/utils'

export type HubStatus = { label: string; on: boolean }

type Props = {
  status: { chat: HubStatus; speak: HubStatus; form: HubStatus; wizard: HubStatus; business: HubStatus }
}

const SERVICE_LABELS = ['Chat AI', 'Voice AI', 'Form', 'Tour', 'Business']
// Ring glow / flare colour per card, taken from each card's hover reveal.
const SERVICE_ACCENTS = ['#10b981', '#ec4899', '#38bdf8', '#818cf8', '#f59e0b']

/**
 * The five services (each run by its own AI Agents assistant) as canvas-reveal cards on the same
 * 3D ring the onboarding cards slide on: drag, swipe, trackpad-scroll or arrow-key to spin it.
 */
export function ServicesHubCards({ status }: Props) {
  return (
    // PageViewport: the ring fills exactly what is left of the visible screen under the header (above
    // the tab bar on phones) and the page itself doesn't scroll. Phones need this: the layout's
    // min-h-screen counts the area behind the address bar, so the page would scroll under the ring.
    // max-md:-mb-8: on phones PageViewport leaves 64px for the tab bar but the layout pads 96px
    // (pb-24), so without it the document is 32px taller than the screen and can still shift.
    <PageViewport className="flex min-h-0 w-full flex-col overflow-hidden max-md:-mb-8">
    <WarpRing ariaLabel="Services" labels={SERVICE_LABELS} accents={SERVICE_ACCENTS} className="h-full w-full">
      <HubCard href="/services/chat" title="Chat AI" description="Text chat in your own chat box." status={status.chat} icon={<MessageSquare className="h-10 w-10" aria-hidden />}>
        <CanvasRevealEffect animationSpeed={5.1} containerClassName="bg-emerald-900" />
      </HubCard>
      <HubCard href="/services/speak" title="Voice AI" description="Real-time voice calls with your AI." status={status.speak} icon={<Mic className="h-10 w-10" aria-hidden />}>
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
      <HubCard href="/services/form" title="Form" description="Callback / lead form, your design." status={status.form} icon={<ClipboardList className="h-10 w-10" aria-hidden />}>
        <CanvasRevealEffect animationSpeed={3} containerClassName="bg-sky-600" colors={[[125, 211, 252]]} />
      </HubCard>
      <HubCard href="/services/wizard" title="Tour" description="Voice-guided tour of your website." status={status.wizard} icon={<Wand2 className="h-10 w-10" aria-hidden />}>
        <CanvasRevealEffect animationSpeed={4} containerClassName="bg-indigo-950" colors={[[129, 140, 248], [34, 211, 238]]} />
      </HubCard>
      <HubCard href="/services/publish" title="Business" description="Profile, services and links your AI uses." status={status.business} icon={<Building2 className="h-10 w-10" aria-hidden />}>
        <CanvasRevealEffect animationSpeed={3} containerClassName="bg-amber-900" colors={[[251, 191, 36]]} />
      </HubCard>
    </WarpRing>
    </PageViewport>
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
  // The reveal canvas sizes itself when it mounts, so only show it once the card sits flat in front.
  const { active } = useWarpRingSlot()

  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      aria-label={`${title}: ${description} (${status.label})`}
      // Sized by its ring slot.
      className="group/canvas-card relative flex h-full w-full items-center justify-center border border-black/[0.2] p-4 dark:border-white/[0.2]"
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
        {hovered && active && (
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
