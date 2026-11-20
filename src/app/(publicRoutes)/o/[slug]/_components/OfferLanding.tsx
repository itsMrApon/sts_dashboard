'use client'

import React, { useState, useTransition } from 'react'
import Image from 'next/image'
import { CheckCircle2, CreditCard, Sparkles, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { forgetBuyer } from '@/actions/buyer'
import {
  describePrice,
  type BuyerContactView,
  type OfferChatMessage,
  type PublicOfferView,
} from '@/lib/offers/publicOfferTypes'
import type { PublicWizard } from '@/lib/wizard/types'
import { OrderPicker } from './OrderPicker'
import { LeadForm } from './LeadForm'
import { OfferAiRoom } from './OfferAiRoom'
import { guardAction } from '@/lib/clientActionErrors'

type Props = {
  offer: PublicOfferView
  contact: BuyerContactView | null
  source: string | null
  orderStatus: string | null
  canceled: boolean
  chatHistory: OfferChatMessage[]
  /** The creator's published tour, when the Guided tour AI option is on. */
  wizard: PublicWizard | null
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

/**
 * The share link (/o/[slug]). The buyer leaves an email or WhatsApp, then:
 *  - AI on: the AI room (chat · guided tour · voice) with Continue to payment underneath;
 *  - AI off: a plain Buy now card.
 * The live session has its own link (/live/[slug]); the creator's view is the pipeline.
 */
export function OfferLanding({ offer, contact: initialContact, source, orderStatus, canceled, chatHistory, wizard }: Props) {
  const [contact, setContact] = useState(initialContact)
  const [, startTransition] = useTransition()

  const defaultPrice = offer.prices.find((p) => p.isDefault) ?? offer.prices[0] ?? null
  // AI options the buyer can actually use (the tour needs a published wizard).
  const aiServices = offer.modes.AI_ASSISTANT
    ? offer.aiServices.filter((service) => service !== 'WIZARD' || !!wizard)
    : []
  const paid = orderStatus === 'PAID' || orderStatus === 'DEPOSIT_PAID'
  const greeting = contact?.name || contact?.email || contact?.phone || ''

  const notMe = () =>
    startTransition(guardAction(async () => {
      await forgetBuyer({ slug: offer.slug })
      setContact(null)
    }))

  // The AI room opens straight away; it asks for an email or WhatsApp only when the buyer chats, calls or pays.
  if (aiServices.length && !paid) {
    return (
      <OfferAiRoom
        offer={offer}
        source={source}
        chatHistory={chatHistory}
        wizard={wizard}
        services={aiServices}
        contact={contact}
        onContact={setContact}
        onForget={notMe}
        notice={
          orderStatus === 'PENDING'
            ? 'Your payment is still processing.'
            : canceled
              ? 'Checkout was canceled. You can try again.'
              : null
        }
      />
    )
  }

  return (
    <main className="relative isolate mx-auto w-full max-w-xl space-y-6 px-4 py-8 sm:py-12">
      {offer.thumbnail ? (
        <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden">
          <Image src={offer.thumbnail} alt="" fill sizes="100vw" className="scale-110 object-cover opacity-25 blur-3xl" />
          <div className="absolute inset-0 bg-background/70" />
        </div>
      ) : null}

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
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{offer.title}</h1>
          {offer.description ? <p className="whitespace-pre-line text-muted-foreground">{offer.description}</p> : null}
          {defaultPrice ? <p className="text-lg font-semibold">{describePrice(defaultPrice).title}</p> : null}
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
          <div className="mb-4 flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {aiServices.length ? <Sparkles className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
            </span>
            <div>
              <h2 className="font-semibold">Get started</h2>
              <p className="text-sm text-muted-foreground">
                {aiServices.length
                  ? `Then chat, take the guided tour or talk to ${offer.business.name}'s AI before you order.`
                  : `So ${offer.business.name} can reach you about this.`}
              </p>
            </div>
          </div>
          <LeadForm slug={offer.slug} source={source} onCaptured={setContact} />
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

          {/* After a successful payment, don't invite a second one. */}
          {paid ? null : offer.modes.INSTANT_CHECKOUT ? (
            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-4 flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <CreditCard className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-semibold">Buy now</h2>
                  <p className="text-sm text-muted-foreground">Pick how you&apos;d like to pay, then check out securely with Stripe.</p>
                </div>
              </div>
              <OrderPicker offer={offer} source={source} via="INSTANT_CHECKOUT" />
            </section>
          ) : (
            <StatusBanner tone="muted">{offer.business.name} will contact you soon.</StatusBanner>
          )}
        </div>
      )}

      <p className="pt-4 text-center text-xs text-muted-foreground">Powered by sts-ai</p>
    </main>
  )
}
