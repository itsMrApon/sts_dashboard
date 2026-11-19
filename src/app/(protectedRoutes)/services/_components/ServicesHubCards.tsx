'use client'

import React from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import { ClipboardList, FileCheck2, Link2, MessageSquare, Mic, PhoneCall, Radio, ShoppingBag, Wand2 } from 'lucide-react'
import { CanvasRevealEffect } from '@/components/ui/canvas-reveal-effect'
import { PageViewport } from '@/components/ReusableComponent/PageViewport'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type HubStatus = { label: string; on: boolean }

type Props = {
  status: {
    chat: HubStatus
    speak: HubStatus
    form: HubStatus
    wizard: HubStatus
    menu: HubStatus
    docs: HubStatus
    links: HubStatus
    contact: HubStatus
    live: HubStatus
  }
}

/**
 * The five services (each run by its own AI Agents assistant) as canvas-reveal cards, laid out in a
 * grid like Integrations so every service is visible at once.
 */
export function ServicesHubCards({ status }: Props) {
  return (
    <PageViewport scrollable>
      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 md:py-12">
        <div className="text-center">
          <h2 className="text-balance text-3xl font-semibold md:text-4xl">Your website services</h2>
          <p className="text-muted-foreground mt-4">
            Everything your website runs on: AI chat, voice, forms and tours, plus your menu, docs, links, live sessions and contact.
          </p>
          <div className="mt-6 flex justify-center">
            <Button asChild variant="outline" size="sm">
              <Link href="/ai-agents">Your AI assistants</Link>
            </Button>
          </div>
        </div>

        {/* gap-8 leaves room for the + rulers that sit 12px outside each card's corners. */}
        <div className="mt-12 grid gap-8 px-3 sm:grid-cols-2 lg:grid-cols-3">
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
      <HubCard href="/services/menu" title="Menu" description="Your products and services, with order links." status={status.menu} icon={<ShoppingBag className="h-10 w-10" aria-hidden />}>
        <CanvasRevealEffect animationSpeed={3} containerClassName="bg-orange-950" colors={[[251, 146, 60]]} />
      </HubCard>
      <HubCard href="/services/docs" title="Docs" description="Forms and PDFs your customers need." status={status.docs} icon={<FileCheck2 className="h-10 w-10" aria-hidden />}>
        <CanvasRevealEffect animationSpeed={3} containerClassName="bg-teal-950" colors={[[45, 212, 191]]} />
      </HubCard>
      <HubCard href="/services/links" title="Links" description="Your socials and a link-in-bio page." status={status.links} icon={<Link2 className="h-10 w-10" aria-hidden />}>
        <CanvasRevealEffect animationSpeed={3} containerClassName="bg-fuchsia-950" colors={[[232, 121, 249], [129, 140, 248]]} />
      </HubCard>
      <HubCard href="/services/live" title="Live" description="Upcoming webinars with a countdown and a Join button." status={status.live} icon={<Radio className="h-10 w-10" aria-hidden />}>
        <CanvasRevealEffect animationSpeed={3} containerClassName="bg-red-950" colors={[[248, 113, 113]]} />
      </HubCard>
      <HubCard href="/services/contact" title="Contact" description="Tap to call, WhatsApp, map, hours and trust badges." status={status.contact} icon={<PhoneCall className="h-10 w-10" aria-hidden />}>
        <CanvasRevealEffect animationSpeed={3} containerClassName="bg-cyan-950" colors={[[34, 211, 238]]} />
      </HubCard>
        </div>
      </section>
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

  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      aria-label={`${title}: ${description} (${status.label})`}
      className="group/canvas-card relative flex h-[22rem] w-full items-center justify-center border border-black/[0.2] p-4 dark:border-white/[0.2]"
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
