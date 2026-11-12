'use client'

import React, { useState, useTransition } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { CalendarDays, CheckCircle2, CreditCard, Loader2, Mail, MessageSquare, Mic, Radio, Sparkles, Wand2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useAttendeeStore } from '@/store/useAttendeeStore'
import { captureLead, enterBuyerExperience, forgetBuyer } from '@/actions/buyer'
import {
  describePrice,
  type BuyerContactView,
  type OfferChatMessage,
  type PublicOfferView,
} from '@/lib/offers/publicOfferTypes'
import type { AiService } from '@/lib/offers/offerTypes'
import type { PublicWizard } from '@/lib/wizard/types'
import { WizardTour } from '@/app/(publicRoutes)/wizard/[slug]/_components/WizardTour'
import { OrderPicker } from './OrderPicker'
import { OfferChat } from './OfferChat'
import { OfferVoice } from './OfferVoice'

type Props = {
  offer: PublicOfferView
  contact: BuyerContactView | null
  source: string | null
  orderStatus: string | null
  canceled: boolean
  chatHistory: OfferChatMessage[]
  /** The creator's published tour, when the Wizard AI option is on. */
  wizard: PublicWizard | null
}

const AI_TABS: Record<AiService, { label: string; icon: React.ReactNode }> = {
  CHAT: { label: 'Chat', icon: <MessageSquare className="h-4 w-4" /> },
  SPEAK: { label: 'Voice', icon: <Mic className="h-4 w-4" /> },
  WIZARD: { label: 'Guided tour', icon: <Wand2 className="h-4 w-4" /> },
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4a.5.5 0 0 0 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7a2.8 2.8 0 0 0 1.8-1.3 2.3 2.3 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3Z" />
    </svg>
  )
}

function StatusBanner({ tone, children }: { tone: 'success' | 'muted'; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm',
        tone === 'success' ? 'border-green-500/30 bg-green-500/10' : 'border-border bg-muted/40',
      )}
    >
      {tone === 'success' ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <div>{children}</div>
    </div>
  )
}

function WayCard({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</span>
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

export function OfferLanding({ offer, contact: initialContact, source, orderStatus, canceled, chatHistory, wizard }: Props) {
  const router = useRouter()
  const { setAttendee, setEnteredProductId } = useAttendeeStore()
  const [contact, setContact] = useState(initialContact)
  const [method, setMethod] = useState<'email' | 'whatsapp'>('email')
  const [value, setValue] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const defaultPrice = offer.prices.find((p) => p.isDefault) ?? offer.prices[0] ?? null
  const isWebinar = offer.kind === 'WEBINAR'
  // AI options the buyer can actually use (the tour needs a published wizard).
  const aiTabs = offer.modes.AI_ASSISTANT
    ? offer.aiServices.filter((service) => service !== 'WIZARD' || !!wizard)
    : []
  const [aiTab, setAiTab] = useState<AiService | null>(aiTabs[0] ?? null)
  const [aiOrderShown, setAiOrderShown] = useState(false)
  const [tourOpen, setTourOpen] = useState(false)
  const anyWay = offer.modes.INSTANT_CHECKOUT || aiTabs.length > 0 || offer.modes.LIVE_HOST
  const paid = orderStatus === 'PAID' || orderStatus === 'DEPOSIT_PAID'

  const run = (key: string, task: () => Promise<void>) => {
    setBusy(key)
    startTransition(async () => {
      try {
        await task()
      } finally {
        setBusy(null)
      }
    })
  }

  const submitLead = () =>
    run('lead', async () => {
      const result = await captureLead({ slug: offer.slug, method, value, name, source })
      if (!result.ok) return void toast.error(result.error)
      setContact(result.contact)
    })

  const notMe = () =>
    run('forget', async () => {
      await forgetBuyer({ slug: offer.slug })
      setContact(null)
      setValue('')
    })

  const showAiOrder = () => setAiOrderShown(true)

  const enter = (experience: 'LIVE') =>
    run(experience, async () => {
      const result = await enterBuyerExperience({ slug: offer.slug, experience })
      if (!result.ok) return void toast.error(result.error)
      setAttendee(result.attendee)
      setEnteredProductId(offer.id)
      router.push(result.url)
    })

  const greeting = contact?.name || contact?.email || contact?.phone

  return (
    <main className="mx-auto w-full max-w-xl space-y-6 px-4 py-8 sm:py-12">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {offer.business.logo ? (
          // Logos can be hosted anywhere, so skip the image optimizer's host allow-list.
          <Image src={offer.business.logo} alt="" width={28} height={28} unoptimized className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
            {offer.business.name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="truncate">{offer.business.name}</span>
      </div>

      <header className="space-y-4">
        {offer.thumbnail ? (
          <Image
            src={offer.thumbnail}
            alt=""
            width={1120}
            height={630}
            className="aspect-video w-full rounded-2xl border border-border object-cover"
            priority
          />
        ) : null}
        <div className="space-y-2">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            {isWebinar ? (
              <>
                <CalendarDays className="h-3.5 w-3.5" />
                Live · {format(new Date(offer.startTime), 'EEE, MMM d · h:mm a')}
              </>
            ) : (
              'Offer'
            )}
          </p>
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{offer.title}</h1>
          {offer.description ? (
            <p className="whitespace-pre-line text-muted-foreground">{offer.description}</p>
          ) : null}
          {defaultPrice ? (
            <p className="text-lg font-semibold">{describePrice(defaultPrice).title}</p>
          ) : null}
        </div>
      </header>

      {paid ? (
        <StatusBanner tone="success">
          <p className="font-medium">{orderStatus === 'DEPOSIT_PAID' ? 'Deposit received.' : 'Payment received.'}</p>
          <p className="text-muted-foreground">{offer.business.name} will be in touch. A receipt is on its way from Stripe.</p>
        </StatusBanner>
      ) : orderStatus === 'PENDING' ? (
        <StatusBanner tone="muted">Your payment is still processing. This page will show it once Stripe confirms.</StatusBanner>
      ) : canceled ? (
        <StatusBanner tone="muted">Checkout was canceled. You can try again below.</StatusBanner>
      ) : null}

      {!contact ? (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-semibold">Get started</h2>
          <p className="mb-4 text-sm text-muted-foreground">So {offer.business.name} can reach you about this.</p>
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-muted/50 p-1" role="tablist" aria-label="Contact method">
            {(['email', 'whatsapp'] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={method === option}
                onClick={() => {
                  setMethod(option)
                  setValue('')
                }}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                  method === option ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {option === 'email' ? <Mail className="h-4 w-4" /> : <WhatsAppIcon className="h-4 w-4" />}
                {option === 'email' ? 'Email' : 'WhatsApp'}
              </button>
            ))}
          </div>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault()
              submitLead()
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="lead-value">{method === 'email' ? 'Email' : 'WhatsApp number'}</Label>
              <Input
                id="lead-value"
                type={method === 'email' ? 'email' : 'tel'}
                inputMode={method === 'email' ? 'email' : 'tel'}
                autoComplete={method === 'email' ? 'email' : 'tel'}
                placeholder={method === 'email' ? 'you@example.com' : '+1 212 555 0123'}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-name">
                Name <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input id="lead-name" autoComplete="name" value={name} maxLength={100} onChange={(event) => setName(event.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={busy === 'lead' || !value.trim()}>
              {busy === 'lead' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Continue
            </Button>
          </form>
        </section>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 text-sm">
            <p className="truncate">
              Hi <span className="font-medium">{greeting}</span>
            </p>
            <button type="button" onClick={notMe} className="shrink-0 text-muted-foreground underline underline-offset-2">
              Not you?
            </button>
          </div>

          {!anyWay ? (
            <StatusBanner tone="muted">{offer.business.name} will contact you soon.</StatusBanner>
          ) : null}

          {/* After a successful payment, don't invite a second one. */}
          {offer.modes.INSTANT_CHECKOUT && !paid ? (
            <WayCard
              icon={<CreditCard className="h-5 w-5" />}
              title="Buy now"
              description="Pick how you'd like to pay, then check out securely with Stripe."
            >
              <OrderPicker offer={offer} source={source} via="INSTANT_CHECKOUT" />
            </WayCard>
          ) : null}

          {aiTabs.length && !paid ? (
            <WayCard
              icon={<Sparkles className="h-5 w-5" />}
              title="Ask our AI"
              description="Get answers first. When you're ready, the AI brings up the order button."
            >
              {aiTabs.length > 1 ? (
                <div className="mb-4 grid gap-1 rounded-xl bg-muted/50 p-1" style={{ gridTemplateColumns: `repeat(${aiTabs.length}, minmax(0, 1fr))` }} role="tablist" aria-label="Talk to the AI by">
                  {aiTabs.map((service) => (
                    <button
                      key={service}
                      type="button"
                      role="tab"
                      aria-selected={aiTab === service}
                      onClick={() => setAiTab(service)}
                      className={cn(
                        'flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors',
                        aiTab === service ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {AI_TABS[service].icon}
                      {AI_TABS[service].label}
                    </button>
                  ))}
                </div>
              ) : null}

              {aiTab === 'CHAT' ? (
                <OfferChat offer={offer} initialMessages={chatHistory} onOrderRequested={showAiOrder} />
              ) : null}
              {aiTab === 'SPEAK' ? <OfferVoice slug={offer.slug} onOrderRequested={showAiOrder} /> : null}
              {aiTab === 'WIZARD' && wizard ? (
                <Button variant="outline" className="w-full" onClick={() => setTourOpen(true)}>
                  <Wand2 className="mr-2 h-4 w-4" /> Start the guided tour
                </Button>
              ) : null}

              {aiOrderShown ? (
                <div className="mt-4 rounded-xl border border-primary/40 bg-primary/5 p-4">
                  <p className="mb-3 text-sm font-medium">Ready when you are</p>
                  <OrderPicker offer={offer} source={source} via="AI_ASSISTANT" />
                </div>
              ) : null}
            </WayCard>
          ) : null}

          {offer.modes.LIVE_HOST ? (
            <WayCard
              icon={<Radio className="h-5 w-5" />}
              title={offer.webinarStatus === 'LIVE' ? 'Join the live session' : 'Save your seat'}
              description={
                offer.webinarStatus === 'LIVE'
                  ? `${offer.business.name} is live now. You'll get an order button during the session.`
                  : `Live on ${format(new Date(offer.startTime), 'EEEE, MMMM d')} at ${format(new Date(offer.startTime), 'h:mm a')}. You'll get an order button during the session.`
              }
            >
              <Button variant="outline" className="w-full" onClick={() => enter('LIVE')} disabled={busy === 'LIVE'}>
                {busy === 'LIVE' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {offer.webinarStatus === 'LIVE' ? 'Join now' : 'Save my seat'}
              </Button>
            </WayCard>
          ) : null}
        </div>
      )}

      <p className="pt-4 text-center text-xs text-muted-foreground">Powered by sts-ai</p>

      {tourOpen && wizard ? (
        <div className="fixed inset-0 z-[60] overflow-y-auto" role="dialog" aria-modal="true" aria-label={`${wizard.businessName} guided tour`}>
          <WizardTour
            wizard={wizard}
            onClose={() => setTourOpen(false)}
            orderAction={{
              label: 'Order now',
              onClick: () => {
                setTourOpen(false)
                showAiOrder()
              },
            }}
          />
        </div>
      ) : null}
    </main>
  )
}
