'use client'

import React, { useCallback, useRef, useState } from 'react'
import Image from 'next/image'
import { Loader2, MessageSquare, Mic, ShoppingBag, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { startBuyerCheckout } from '@/actions/buyer'
import { describePrice, type OfferChatMessage, type PublicOfferView } from '@/lib/offers/publicOfferTypes'
import { AI_SERVICE_LABEL, AI_SERVICE_ORDER, type AiService } from '@/lib/offers/offerTypes'
import type { PublicWizard } from '@/lib/wizard/types'
// The three panels are separate services, each on the agent (or tour) the creator picked for it.
import { OfferChat } from './services/OfferChat'
import { OfferTour, type OfferTourControl } from './services/OfferTour'
import { OfferVoice, type OfferVoiceControl } from './services/OfferVoice'

type Props = {
  offer: PublicOfferView
  source: string | null
  chatHistory: OfferChatMessage[]
  wizard: PublicWizard | null
  /** The AI options the creator turned on (and that can run). */
  services: AiService[]
  /** A one-line note above the payment button (checkout canceled, payment processing). */
  notice: string | null
}

/** Ring order: chat, guided tour, voice. The tour starts in front. */
const PANEL_META: Record<AiService, { label: string; icon: React.ReactNode }> = {
  CHAT: { label: AI_SERVICE_LABEL.CHAT, icon: <MessageSquare className="h-4 w-4" /> },
  WIZARD: { label: AI_SERVICE_LABEL.WIZARD, icon: <Wand2 className="h-4 w-4" /> },
  SPEAK: { label: AI_SERVICE_LABEL.SPEAK, icon: <Mic className="h-4 w-4" /> },
}

const SWIPE_MIN_PX = 50

/** Where a panel sits relative to the front one: 0 in front, -1 left, +1 right (wraps around). */
function ringOffset(index: number, active: number, count: number): number {
  if (index === active) return 0
  if (count === 2) return 1
  const diff = (index - active + count) % count
  return diff === 1 ? 1 : -1
}

function PaymentButton({
  offer,
  source,
  highlighted,
  notice,
}: {
  offer: PublicOfferView
  source: string | null
  highlighted: boolean
  notice: string | null
}) {
  const [priceId, setPriceId] = useState<string | null>(
    offer.prices.find((price) => price.isDefault)?.id ?? offer.prices[0]?.id ?? null,
  )
  const [busy, setBusy] = useState(false)

  const checkout = async () => {
    setBusy(true)
    try {
      const result = await startBuyerCheckout({ slug: offer.slug, offerPriceId: priceId, source, via: 'AI_ASSISTANT' })
      if (!result.ok) {
        toast.error(result.error)
        setBusy(false)
        return
      }
      window.location.href = result.url
    } catch {
      toast.error('Could not open checkout')
      setBusy(false)
    }
  }

  return (
    <footer className="relative z-10 flex flex-col items-center gap-2 px-4 pb-4 pt-2 md:pb-6">
      {notice ? <p className="text-xs text-muted-foreground">{notice}</p> : null}
      {/* Only a real choice (pay in full / deposit / monthly) is shown; a single price goes straight to Stripe. */}
      {offer.prices.length > 1 ? (
        <div className="flex max-w-full gap-1.5 overflow-x-auto scrollbar-hide" role="radiogroup" aria-label="Payment option">
          {offer.prices.map((option) => {
            const text = describePrice(option)
            const picked = option.id === priceId
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={picked}
                title={text.detail ?? undefined}
                onClick={() => setPriceId(option.id)}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors',
                  picked ? 'border-primary bg-primary/15 font-medium text-primary' : 'border-white/15 bg-background/40 hover:bg-muted/60',
                )}
              >
                {text.title}
              </button>
            )
          })}
        </div>
      ) : null}
      <Button
        size="lg"
        onClick={checkout}
        disabled={!offer.acceptingPayments || busy}
        className={cn(
          'h-12 w-full max-w-sm rounded-full text-base shadow-xl',
          highlighted && 'animate-pulse ring-2 ring-primary ring-offset-2 ring-offset-background',
        )}
      >
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShoppingBag className="mr-2 h-4 w-4" />}
        Continue to payment
      </Button>
      {!offer.acceptingPayments ? (
        <p className="text-xs text-muted-foreground">Online payment isn&apos;t set up yet. {offer.business.name} will contact you.</p>
      ) : null}
    </footer>
  )
}

/**
 * The share page's AI room: chat, guided tour and voice on a rotating carousel over the offer's
 * image. One panel is in front; the other two peek out at the sides. Tapping a side panel (or a
 * tab, or swiping) rotates it to the front and starts it: the tour plays, voice starts the call,
 * and whatever was in front stops. Continue to payment sits centred underneath.
 */
export function OfferAiRoom({ offer, source, chatHistory, wizard, services, notice }: Props) {
  const panels = AI_SERVICE_ORDER.filter((service) => services.includes(service) && (service !== 'WIZARD' || !!wizard))
  const [active, setActive] = useState(() => Math.max(0, panels.indexOf('WIZARD')))
  const [orderPrompt, setOrderPrompt] = useState(false)
  const tourRef = useRef<OfferTourControl>(null)
  const voiceRef = useRef<OfferVoiceControl>(null)
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  const requestOrder = useCallback(() => setOrderPrompt(true), [])
  // One voice at a time: the tour's narration and the voice call stop each other.
  const stopVoice = useCallback(() => voiceRef.current?.stop(), [])
  const stopTour = useCallback(() => tourRef.current?.stop(), [])

  /** Brings a panel to the front and starts it (called from taps, so audio is allowed). */
  const bringToFront = (index: number) => {
    const target = panels[index]
    if (index !== active) {
      if (panels[active] === 'WIZARD') tourRef.current?.stop()
      if (panels[active] === 'SPEAK') voiceRef.current?.stop()
      setActive(index)
    }
    if (target === 'WIZARD') tourRef.current?.play()
    if (target === 'SPEAK') voiceRef.current?.start()
  }

  const rotate = (step: 1 | -1) => {
    if (panels.length < 2) return
    bringToFront((active + step + panels.length) % panels.length)
  }

  const onTouchEnd = (event: React.TouchEvent) => {
    const start = touchStart.current
    touchStart.current = null
    const touch = event.changedTouches[0]
    if (!start || !touch) return
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return
    rotate(dx < 0 ? 1 : -1)
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-background text-foreground">
      <div aria-hidden className="absolute inset-0 overflow-hidden">
        {offer.thumbnail ? (
          <Image src={offer.thumbnail} alt="" fill sizes="100vw" priority className="scale-110 object-cover opacity-45 blur-2xl" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600/25 via-background to-background" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/30 to-background/80" />
      </div>

      {panels.length > 1 ? (
        <nav className="relative z-10 flex justify-center px-4 pb-2 pt-4 md:pt-6" aria-label="Talk to the AI by">
          <div className="flex gap-1 rounded-full border border-white/10 bg-background/60 p-1 backdrop-blur">
            {panels.map((service, index) => (
              <button
                key={service}
                type="button"
                onClick={() => bringToFront(index)}
                aria-current={active === index}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors md:px-4 md:text-sm',
                  active === index ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {PANEL_META[service].icon}
                {PANEL_META[service].label}
              </button>
            ))}
          </div>
        </nav>
      ) : (
        <div className="h-4 md:h-6" />
      )}

      {/*
        The stage: every panel stays mounted (chat history, a running call) and is placed by
        transform. Widths leave room for the side panels to peek out: ~28px on phones, ~110px on desktop.
      */}
      <div
        className="relative z-10 min-h-0 flex-1 overflow-hidden [--peek:28px] md:[--peek:110px]"
        onTouchStart={(event) => {
          const touch = event.touches[0]
          touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null
        }}
        onTouchEnd={onTouchEnd}
      >
        {panels.map((service, index) => {
          const offset = ringOffset(index, active, panels.length)
          const front = offset === 0
          return (
            <section
              key={service}
              aria-label={PANEL_META[service].label}
              style={{
                transform: `translateX(calc(-50% + ${offset} * (7.5% + var(--peek)))) scale(${front ? 1 : 0.85})`,
              }}
              className={cn(
                'absolute bottom-2 left-1/2 top-2 flex w-[calc(100%-80px)] flex-col overflow-hidden rounded-3xl border border-white/10 bg-card/80 shadow-2xl backdrop-blur-xl transition-[transform,opacity] duration-500 ease-out md:w-[min(760px,calc(100%-280px))]',
                front ? 'z-20 opacity-100' : 'z-10 opacity-45',
              )}
            >
              <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5 text-sm font-medium">
                <span className="text-primary">{PANEL_META[service].icon}</span>
                {PANEL_META[service].label}
              </div>
              <div className="min-h-0 flex-1" inert={!front}>
                {service === 'CHAT' ? <OfferChat offer={offer} initialMessages={chatHistory} onOrderRequested={requestOrder} /> : null}
                {service === 'WIZARD' && wizard ? (
                  <OfferTour wizard={wizard} controlRef={tourRef} onPlay={stopVoice} onOrderRequested={requestOrder} />
                ) : null}
                {service === 'SPEAK' ? (
                  <OfferVoice
                    slug={offer.slug}
                    businessName={offer.business.name}
                    onOrderRequested={requestOrder}
                    controlRef={voiceRef}
                    onStart={stopTour}
                  />
                ) : null}
              </div>
              {/* A side panel is one big button: tap it to rotate it to the front. */}
              {front ? null : (
                <button
                  type="button"
                  onClick={() => bringToFront(index)}
                  className={cn(
                    'absolute inset-0 z-30 flex cursor-pointer items-center bg-background/30',
                    offset < 0 ? 'justify-start' : 'justify-end',
                  )}
                  aria-label={`Show ${PANEL_META[service].label}`}
                >
                  {/* Sits in the strip that peeks out (the panel is scaled to 0.85). */}
                  <span className="flex w-[calc(var(--peek)/0.85)] flex-col items-center gap-2 text-foreground">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-background/70 md:h-11 md:w-11">
                      {PANEL_META[service].icon}
                    </span>
                    <span className="hidden text-sm font-medium md:block">{PANEL_META[service].label}</span>
                  </span>
                </button>
              )}
            </section>
          )
        })}
      </div>

      {orderPrompt ? <p className="relative z-10 pt-1 text-center text-xs font-medium text-primary">Ready when you are</p> : null}
      <PaymentButton offer={offer} source={source} highlighted={orderPrompt} notice={notice} />
    </div>
  )
}
