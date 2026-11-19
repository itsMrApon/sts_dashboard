'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { AnimatePresence, motion, type Variants } from 'motion/react'
import {
  ArrowUpRight,
  AudioLines,
  Box,
  BrainCircuit,
  CheckCircle2,
  CheckIcon,
  Clapperboard,
  Globe,
  Loader2,
  Megaphone,
  Radar,
  Rocket,
  Share2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { StripeElements } from '@/components/ReusableComponent/Stripe/Element'
import {
  confirmPackagePurchase,
  startPackagePurchase,
  type PackageCard,
} from '@/actions/platformBilling'
import {
  LAUNCHPAD_SUMMARY,
  PLAN_MODULE_GROUPS,
  PLAN_MODULE_IDS,
  PLAN_MODULES,
  planForModuleToggle,
  type PlanModuleId,
  type PlatformPackageId,
} from '@/lib/billing/planCatalog'
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

const MODULE_ICONS: Record<PlanModuleId, React.ReactNode> = {
  SITEFORGE: <Globe className="size-4" />,
  LEADRADAR: <Radar className="size-4" />,
  VOICEPILOT: <AudioLines className="size-4" />,
  REELHOUSE: <Clapperboard className="size-4" />,
  SOCIALPULSE: <Share2 className="size-4" />,
  ADMIND: <BrainCircuit className="size-4" />,
  DEPTH3D: <Box className="size-4" />,
  CAMPAIGNDROP: <Megaphone className="size-4" />,
}

/** The plan the picker opens on when the creator holds none: full integration. */
const DEFAULT_PLAN: PlatformPackageId = 'AUTOPILOT'

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

  if (plan.owned || plan.includedIn) {
    return (
      <p className="flex items-center justify-center gap-2 rounded-2xl border border-green-500/30 bg-green-500/10 p-3 text-sm font-medium text-green-500">
        <CheckCircle2 className="size-4" />
        {plan.includedIn && !plan.owned
          ? `Included in your ${plan.includedIn} plan`
          : plan.billing === 'one_time'
            ? `${plan.name} purchased. We will contact you.`
            : `${plan.name} is active`}
      </p>
    )
  }

  const terms =
    plan.billing === 'one_time'
      ? 'Pay once.'
      : plan.minimumMonths
        ? `${plan.minimumMonths}-month minimum, then cancel anytime.`
        : 'Cancel anytime.'

  return (
    <div className="flex flex-col gap-3">
      <CardElement options={CARD_STYLE} className="w-full rounded-2xl border border-input bg-background p-3.5" />
      <button
        type="button"
        onClick={pay}
        disabled={paying || !stripe}
        className={cn(
          'flex h-12 w-full items-center justify-center gap-2 rounded-full text-base font-semibold transition disabled:pointer-events-none disabled:opacity-50',
          PURPLE_BUTTON,
        )}
      >
        {paying ? <Loader2 className="size-4 animate-spin" /> : null}
        {`Start ${plan.name}`}
        {!paying ? <ArrowUpRight className="size-4" /> : null}
      </button>
      <p className="text-center text-[11px] text-muted-foreground">
        {`${plan.priceLabel}. ${terms} Secure card payment by Stripe.`}
      </p>
    </div>
  )
}

/** The line under the price: what is waived, credited or committed to. */
function priceNote(plan: PackageCard): React.ReactNode {
  const symbol = currencySymbol(plan.currency)
  if (plan.billing === 'one_time') {
    if (plan.dueCents < plan.amountCents) {
      return `${symbol}${amountDigits(plan.amountCents)}, less ${symbol}${amountDigits(plan.amountCents - plan.dueCents)} you already paid.`
    }
    return 'Pay once. Add a monthly plan anytime.'
  }
  if (plan.minimumMonths) return `Billed monthly. ${plan.minimumMonths}-month minimum, 3D site build included.`
  if (plan.waivedSetup) {
    return (
      <>
        <span className="line-through">
          {symbol}
          {amountDigits(plan.waivedSetup.amountCents)} {plan.waivedSetup.name} setup
        </span>{' '}
        <span className="font-medium text-[#a066ff]">included</span>
      </>
    )
  }
  return 'Billed monthly.'
}

/**
 * The six plans as "build your plan": pick a plan from the strip, or flip add-on modules on the left
 * and the picker moves to the plan that has them. The right card shows the plan's price, the card
 * field with the start button, and what it includes.
 */
export default function PackagesPanel({ cards, onPurchased }: Props) {
  // Open on the plan they hold (a monthly one first), else on full integration.
  const initial =
    cards.find((card) => card.owned && card.billing === 'month') ??
    [...cards].reverse().find((card) => card.owned) ??
    cards.find((card) => card.id === DEFAULT_PLAN)
  const [planId, setPlanId] = useState<PlatformPackageId>(initial?.id ?? DEFAULT_PLAN)
  const plan = cards.find((card) => card.id === planId) ?? cards[0]

  if (!plan) return <p className="text-sm text-muted-foreground">Plans could not be loaded. Please try again.</p>

  const digits = amountDigits(plan.dueCents).split('')

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
              Every plan starts with Launchpad. Switch on the modules you need, from a website to a full digital agency.
            </p>
          </div>

          <div role="radiogroup" aria-label="Plan" className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {cards.map((card) => {
              const selected = card.id === plan.id
              return (
                <button
                  key={card.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setPlanId(card.id)}
                  className={cn(
                    'flex flex-col items-start gap-0.5 rounded-2xl border px-3 py-2.5 text-left transition-colors',
                    selected
                      ? 'border-[#8731ff] bg-[#8731ff]/15'
                      : 'border-border bg-card hover:border-[#a066ff]/60',
                  )}
                >
                  <span className="text-[11px] text-muted-foreground">{card.track}</span>
                  <span className="text-sm font-medium text-foreground">{card.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {currencySymbol(card.currency)}
                    {amountDigits(card.amountCents)}
                    {card.billing === 'month' ? '/mo' : ' once'}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Left: Launchpad (always on) and the add-on modules that pick the plan */}
            <div className="flex flex-col gap-5 rounded-3xl border border-border bg-card p-6 shadow-lg sm:p-8">
              <div className="flex flex-col gap-2">
                <h3 className="text-lg font-medium text-foreground">Add-on modules</h3>
                <p className="text-sm text-muted-foreground">Launchpad is in every plan. Switch on what else you need.</p>
              </div>

              <div className="flex items-center gap-3 rounded-lg p-2">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#8731ff] text-white">
                  <Rocket className="size-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">Launchpad</span>
                  <span className="text-xs text-muted-foreground">{LAUNCHPAD_SUMMARY}</span>
                </div>
              </div>

              {PLAN_MODULE_GROUPS.map((group) => (
                <div key={group} className="flex flex-col gap-1">
                  <p className="px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{group}</p>
                  {PLAN_MODULE_IDS.filter((id) => PLAN_MODULES[id].group === group).map((moduleId) => {
                    const addOn = PLAN_MODULES[moduleId]
                    const on = plan.modules.includes(moduleId)
                    const switchId = `plan-module-${moduleId}`
                    const flip = (next: boolean) => setPlanId(planForModuleToggle(plan.id, moduleId, next))
                    return (
                      <div key={moduleId} className="flex items-center justify-between gap-4 rounded-lg p-2">
                        <button
                          type="button"
                          onClick={() => flip(!on)}
                          className="flex flex-1 items-center gap-3 text-left"
                          aria-controls={switchId}
                        >
                          <span
                            className={cn(
                              'flex size-9 shrink-0 items-center justify-center rounded-full transition-colors',
                              on ? 'bg-[#8731ff] text-white' : 'bg-muted text-muted-foreground',
                            )}
                          >
                            {MODULE_ICONS[moduleId]}
                          </span>
                          <span className="flex flex-col">
                            <span className="text-sm font-medium text-foreground">{addOn.name}</span>
                            <span className="text-xs text-muted-foreground">{addOn.description}</span>
                          </span>
                        </button>
                        <Switch
                          id={switchId}
                          aria-label={addOn.name}
                          checked={on}
                          onCheckedChange={flip}
                          className="data-[state=checked]:bg-[#8731ff]"
                        />
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* Right: the plan, its price, the card and what's included */}
            <div className="flex flex-col gap-6 rounded-3xl bg-muted p-6 sm:p-8">
              <div className="flex flex-col gap-2">
                <Badge variant="outline" className="w-fit border-[#a066ff]/50 text-[#a066ff]">
                  {plan.track}
                </Badge>
                <h3 className="text-xl font-medium text-foreground">{plan.name}</h3>
                <p className="text-sm text-muted-foreground">{plan.tagline}</p>
              </div>

              <div className="flex flex-col gap-1">
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
                <p className="text-sm text-muted-foreground">{priceNote(plan)}</p>
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
