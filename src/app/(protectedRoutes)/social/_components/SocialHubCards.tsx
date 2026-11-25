'use client'

import { Instagram, MessageCircle } from 'lucide-react'
import { CanvasRevealEffect } from '@/components/ui/canvas-reveal-effect'
import { HubCard, type HubStatus } from '../../services/_components/ServicesHubCards'

type Props = { status: { instagram: HubStatus; whatsapp: HubStatus } }

/** The social channels as the same canvas-reveal cards as the Services hub. */
export function SocialHubCards({ status }: Props) {
  return (
    // gap-8 leaves room for the + rulers that sit 12px outside each card's corners.
    <div className="mx-auto grid w-full max-w-3xl gap-8 px-3 sm:grid-cols-2">
      <HubCard
        href="/integrations/instagram"
        title="Instagram"
        description="Comment a keyword, get a DM: commenters become leads."
        status={status.instagram}
        icon={<Instagram className="h-10 w-10" aria-hidden />}
      >
        <CanvasRevealEffect
          animationSpeed={3.5}
          containerClassName="bg-black"
          colors={[
            [236, 72, 153],
            [249, 115, 22],
          ]}
        />
      </HubCard>
      <HubCard
        href="/integrations/whatsapp"
        title="WhatsApp"
        description="Your Chat AI answers customers on your own number."
        status={status.whatsapp}
        icon={<MessageCircle className="h-10 w-10" aria-hidden />}
      >
        <CanvasRevealEffect animationSpeed={4} containerClassName="bg-emerald-950" colors={[[34, 197, 94]]} />
      </HubCard>
    </div>
  )
}
