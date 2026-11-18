'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { AnimatePresence, motion, type Variants } from 'motion/react'
import { ArrowUpRight, CheckCircle2, CheckIcon, Globe, Loader2, Repeat, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { StripeElements } from '@/components/ReusableComponent/Stripe/Element'
import {
  confirmPackagePurchase,
  startPackagePurchase,
  type PackageCard,
} from '@/actions/platformBilling'
import type { PlanMode, PlanTier } from '@/lib/billing/platformPackages'
import { cn } from '@/lib/utils'

type Props = {
  cards: PackageCard[]
  /** Called once access is granted (e.g. to close a dialog). */
  onPurchased?: () => void
}

const CARD_STYLE = {
  style: {
    base: { fontSize: '16px', color: '#B4B0E3', '::placeholder': { color: '#B4B0E3' } },
    invalid: { color: '#9e2146' },
  },
}

// The app's button purple (rgba(135, 49, 255) in `.iconBackground`); the theme's `primary` is near-white.
const PURPLE_BUTTON =
  'border-2 border-[#a066ff] bg-gradient-to-t from-[#6d1fe0] via-[#8731ff] to-[#6d1fe0] text-white shadow-md shadow-[#8731ff]/40 hover:brightness-110'

const digitVariant: Variants = {
  initial: { opacity: 0, y: 10, filter: 'blur(4px)', scale: 0.98 },
  animate: (index: number) => ({
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    scale: 1,
    transition: { delay: index * 0.03, type: 'spring', damping: 22, stiffness: 280 },
  }),
  exit: { opacity: 0, y: -10, filter: 'blur(4px)', scale: 0.98, transition: { duration: 0.14 } },
}

/** The two choices that pick one of the four plans: each is a switch in the left card. */
const PLAN_TOGGLES = [
  {
    id: 'tier',
    label: 'Every AI tool',
    description: 'Chat AI, Voice AI, website tour, products & webinars',
    offDescription: 'Off: just your business site',
    icon: <Sparkles className="size-4" />,
  },
  {
    id: 'mode',
    label: 'We run it every month',
    description: 'Business Solutions: we grow it with you monthly',
    offDescription: 'Off: one-time setup, then you run it',
    icon: <Repeat className="size-4" />,
  },
] as const

function amountDigits(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100)
}

function currencySymbol(currency: string): string {
  return (
    new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() })
      .formatToParts(0)
      .find((part) => part.type === 'currency')?.value ?? '$'
  )
}

/** Card field and the start button: one-time plans charge once, monthly plans start a subscription. */
function CardCheckout({ plan, onDone }: { plan: PackageCard; onDone: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()
  const [paying, setPaying] = useState(false)
  const unavailable = !plan.priceLabel

  const pay = async () => {
    if (!stripe || !elements) return toast.error('Payments are still loading')
    const card = elements.getElement(CardElement)
    if (!card) return toast.error('Card form is not ready')

    setPaying(true)
    try {
      const started = await startPackagePurchase(plan.id)
      if (!started.ok) throw new Error(started.error)

      const { error } = await stripe.confirmCardPayment(started.clientSecret, { payment_method: { card } })
      if (error) throw new Error(error.message || 'Card was declined')

      const confirmed = await confirmPackagePurchase({ packageId: plan.id, paymentIntentId: started.paymentIntentId })
      if (!confirmed.ok) throw new Error(confirmed.error)

      toast.success(`${plan.name} is active`)
      onDone()
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Payment failed')
    } finally {
      setPaying(false)
    }
  }

  if (plan.owned) {
    return (
      <p className="flex items-center justify-center gap-2 rounded-2xl border border-green-500/30 bg-green-500/10 p-3 text-sm font-medium text-green-500">
        <CheckCircle2 className="size-4" />
        {plan.billing === 'one_time' ? `${plan.name} purchased. We will contact you.` : `${plan.name} is active`}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <CardElement options={CARD_STYLE} className="w-full rounded-2xl border border-input bg-background p-3.5" />
      <button
        type="button"
        onClick={pay}
        disabled={paying || !stripe || unavailable}
        className={cn(
          'flex h-12 w-full items-center justify-center gap-2 rounded-full text-base font-semibold transition disabled:pointer-events-none disabled:opacity-50',
          PURPLE_BUTTON,
        )}
      >
        {paying ? <Loader2 className="size-4 animate-spin" /> : null}
        {unavailable ? 'Coming soon' : `Start ${plan.name}`}
        {!paying && !unavailable ? <ArrowUpRight className="size-4" /> : null}
      </button>
      <p className="text-center text-[11px] text-muted-foreground">
        {unavailable
          ? 'This plan opens soon.'
          : `${plan.priceLabel}. Secure card payment by Stripe.${plan.billing === 'month' ? ' Cancel anytime.' : ''}`}
      </p>
    </div>
  )
}

/**
 * The four plans as "build your plan": two switches on the left (every AI tool; we run it monthly)
 * pick the plan; the right card shows its price, the card field with the start button, and what it includes.
 */
export default function PackagesPanel({ cards, onPurchased }: Props) {
  // Open on the plan they already hold, else on Run My Business (the plan we grow clients into).
  const initial = cards.find((card) => card.owned && card.billing === 'month') ?? cards.find((card) => card.owned)
  const [tier, setTier] = useState<PlanTier>(initial?.tier ?? 'FULL')
  const [mode, setMode] = useState<PlanMode>(initial?.mode ?? 'SOLUTIONS')
  const plan = cards.find((card) => card.tier === tier && card.mode === mode)

  if (!plan) return <p className="text-sm text-muted-foreground">Plans could not be loaded. Please try again.</p>

  const toggles = {
    tier: { on: tier === 'FULL', set: (on: boolean) => setTier(on ? 'FULL' : 'SITE') },
    mode: { on: mode === 'SOLUTIONS', set: (on: boolean) => setMode(on ? 'SOLUTIONS' : 'INTEGRATION') },
  }
  const digits = plan.amountCents != null ? amountDigits(plan.amountCents).split('') : []

  return (
    <StripeElements>
      <section aria-label="Plans" className="mx-auto w-full max-w-4xl">
        <div className="flex flex-col items-center gap-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <Badge variant="secondary" className="w-fit">
              Build your plan
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Grow your business with sts-ai</h2>
            <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
              Start with your business site. Switch on every AI tool, and let us run it with you every month.
            </p>
          </div>

          <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Left: the two switches that pick the plan */}
            <div className="flex flex-col gap-6 rounded-3xl border border-border bg-card p-6 shadow-lg sm:p-8">
              <div className="flex flex-col gap-2">
                <h3 className="text-lg font-medium text-foreground">Your business site</h3>
                <p className="text-sm text-muted-foreground">Always in every plan. Switch on what else you need.</p>
              </div>

              <div className="flex items-center gap-3 rounded-lg p-2">
                <div className="flex size-9 items-center justify-center rounded-full bg-[#8731ff] text-white">
                  <Globe className="size-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">Business site</span>
                  <span className="text-xs text-muted-foreground">Profile, products, links and lead form</span>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                {PLAN_TOGGLES.map((toggle) => {
                  const state = toggles[toggle.id]
                  const switchId = `plan-toggle-${toggle.id}`
                  return (
                    <div key={toggle.id} className="flex items-center justify-between gap-4 rounded-lg p-2">
                      <button
                        type="button"
                        onClick={() => state.set(!state.on)}
                        className="flex flex-1 items-center gap-3 text-left"
                        aria-controls={switchId}
                      >
                        <span
                          className={cn(
                            'flex size-9 shrink-0 items-center justify-center rounded-full transition-colors',
                            state.on ? 'bg-[#8731ff] text-white' : 'bg-muted text-muted-foreground',
                          )}
                        >
                          {toggle.icon}
                        </span>
                        <span className="flex flex-col">
                          <span className="text-sm font-medium text-foreground">{toggle.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {state.on ? toggle.description : toggle.offDescription}
                          </span>
                        </span>
                      </button>
                      <Switch
                        id={switchId}
                        aria-label={toggle.label}
                        checked={state.on}
                        onCheckedChange={state.set}
                        className="data-[state=checked]:bg-[#8731ff]"
                      />
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Right: the plan, its price, the card and what's included */}
            <div className="flex flex-col gap-6 rounded-3xl bg-muted p-6 sm:p-8">
              <div className="flex flex-col gap-2">
                <h3 className="text-xl font-medium text-foreground">{plan.name}</h3>
                <p className="text-sm text-muted-foreground">{plan.tagline}</p>
              </div>

              <div className="flex flex-col gap-1">
                {plan.amountCents != null ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-6xl font-semibold tracking-tight text-foreground">{currencySymbol(plan.currency)}</span>
                    <AnimatePresence mode="popLayout">
                      {digits.map((char, index) => (
                        <motion.span
                          key={`${plan.id}-${char}-${index}`}
                          variants={digitVariant}
                          initial="initial"
                          animate="animate"
                          exit="exit"
                          custom={index}
                          className="inline-block text-6xl font-semibold tracking-tight text-foreground"
                        >
                          {char}
                        </motion.span>
                      ))}
                    </AnimatePresence>
                    <span className="text-xl text-muted-foreground">{plan.billing === 'month' ? '/month' : 'one-time'}</span>
                  </div>
                ) : (
                  <span className="text-4xl font-semibold tracking-tight text-muted-foreground">Coming soon</span>
                )}
                {plan.waivedSetupCents ? (
                  <p className="text-sm text-muted-foreground">
                    <span className="line-through">
                      {currencySymbol(plan.currency)}
                      {amountDigits(plan.waivedSetupCents)} setup
                    </span>{' '}
                    <span className="font-medium text-[#a066ff]">waived</span>
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {plan.billing === 'one_time' ? 'Pay once. Upgrade to monthly anytime.' : 'Billed monthly.'}
                  </p>
                )}
              </div>

              <CardCheckout plan={plan} onDone={() => onPurchased?.()} />

              <div className="flex flex-col gap-3">
                <p className="text-sm font-medium text-foreground">Included</p>
                <AnimatePresence mode="wait">
                  <motion.ul
                    key={plan.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
                    className="flex flex-col gap-3"
                  >
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#8731ff]">
                          <CheckIcon className="size-3 text-white" />
                        </span>
                        <span className="text-sm text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </motion.ul>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </section>
    </StripeElements>
  )
}
