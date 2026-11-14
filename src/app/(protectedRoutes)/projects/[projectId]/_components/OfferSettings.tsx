'use client'

import React, { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, Copy, ExternalLink, Loader2, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { OfferOrders, formatMoney } from './OfferOrders'
import {
  saveOfferDetails,
  saveOfferOrderModes,
  saveOfferPricing,
  setOfferOnBusiness,
} from '@/actions/offers'
import { AiPanelPicker, type AiPanelPicks } from './AiPanelPicker'
import {
  ORDER_MODE_COPY,
  ORDER_MODE_KINDS,
  type OfferPricingInput,
  type OfferSettingsView,
  type OrderModesInput,
} from '@/lib/offers/offerTypes'

type Props = { offer: OfferSettingsView }

const toDollars = (cents: number) => (cents > 0 ? (cents / 100).toFixed(2).replace(/\.00$/, '') : '')
const toCents = (dollars: string) => Math.round(Number.parseFloat(dollars || '0') * 100)
const formatUsd = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: cents % 100 ? 2 : 0 }).format(
    cents / 100,
  )

/** datetime-local value in the viewer's timezone. */
function toLocalInput(iso: string): string {
  const date = new Date(iso)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function Section({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-border bg-card">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-4 px-5 py-5">{children}</div>
      {footer ? <div className="flex justify-end border-t border-border px-5 py-3">{footer}</div> : null}
    </section>
  )
}

function SaveButton({ dirty, saving, onClick, disabled }: { dirty: boolean; saving: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <Button size="sm" onClick={onClick} disabled={!dirty || saving || disabled}>
      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      {dirty ? 'Save' : 'Saved'}
    </Button>
  )
}

function MoneyInput({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
      <Input
        id={id}
        inputMode="decimal"
        className="pl-7"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value.replace(/[^0-9.]/g, ''))}
        placeholder="0"
      />
    </div>
  )
}

export function OfferSettings({ offer }: Props) {
  const router = useRouter()
  const locked = !offer.hasPaidAccess
  const typeLabel = offer.kind === 'PRODUCT' ? 'Product' : 'Webinar'

  // --- Details -------------------------------------------------------------
  const initialDetails = useMemo(
    () => ({ title: offer.title, description: offer.description }),
    [offer.title, offer.description],
  )
  const [details, setDetails] = useState(initialDetails)
  const [savingDetails, startDetails] = useTransition()
  const detailsDirty = JSON.stringify(details) !== JSON.stringify(initialDetails)

  const saveDetails = () =>
    startDetails(async () => {
      const result = await saveOfferDetails({
        id: offer.id,
        title: details.title,
        description: details.description,
      })
      if (!result.ok) return void toast.error(result.error)
      toast.success('Details saved')
      router.refresh()
    })

  // --- Pricing ---------------------------------------------------------------
  const initialPricing = useMemo(
    () => ({
      billing: offer.pricing.billing,
      amount: toDollars(offer.pricing.amountCents),
      depositOn: offer.pricing.deposit.enabled,
      deposit: toDollars(offer.pricing.deposit.depositCents),
      dueDays: String(offer.pricing.deposit.balanceDueDays),
      monthlyOn: offer.pricing.monthlyOption.enabled,
      monthly: toDollars(offer.pricing.monthlyOption.amountCents),
    }),
    [offer.pricing],
  )
  const [pricing, setPricing] = useState(initialPricing)
  const [savingPricing, startPricing] = useTransition()
  const pricingDirty = JSON.stringify(pricing) !== JSON.stringify(initialPricing)
  const oneTime = pricing.billing === 'ONE_TIME'
  const amountCents = toCents(pricing.amount)
  const depositCents = toCents(pricing.deposit)

  const savePricing = () =>
    startPricing(async () => {
      const payload: OfferPricingInput = {
        currency: 'usd',
        billing: pricing.billing,
        amountCents,
        deposit: {
          enabled: oneTime && pricing.depositOn,
          depositCents,
          balanceDueDays: Number.parseInt(pricing.dueDays || '0', 10),
        },
        monthlyOption: { enabled: oneTime && pricing.monthlyOn, amountCents: toCents(pricing.monthly) },
      }
      const result = await saveOfferPricing({ id: offer.id, pricing: payload })
      if (!result.ok) return void toast.error(result.error)
      toast.success('Price saved')
      router.refresh()
    })

  // --- Ways to order -----------------------------------------------------------
  const initialModes = useMemo(
    () => ({
      modes: offer.modes,
      aiServices: offer.aiServices,
      agentId: offer.livekitAgentId ?? offer.agents[0]?.id ?? '',
      liveStart: toLocalInput(offer.startTime),
    }),
    [offer.modes, offer.aiServices, offer.livekitAgentId, offer.agents, offer.startTime],
  )
  const [modes, setModes] = useState<
    AiPanelPicks & {
      modes: OrderModesInput
      /** datetime-local value: when the live session starts (the Live link counts down to it). */
      liveStart: string
    }
  >(initialModes)
  const [savingModes, startModes] = useTransition()
  const modesDirty = JSON.stringify(modes) !== JSON.stringify(initialModes)

  const saveModes = () =>
    startModes(async () => {
      const result = await saveOfferOrderModes({
        id: offer.id,
        modes: modes.modes,
        aiServices: modes.aiServices,
        livekitAgentId: modes.agentId || null,
        liveStartTime:
          modes.modes.LIVE_HOST && modes.liveStart ? new Date(modes.liveStart).toISOString() : undefined,
      })
      if (!result.ok) return void toast.error(result.error)
      toast.success('Ways to order saved')
      router.refresh()
    })

  // --- Business ----------------------------------------------------------------
  const [onBusiness, setOnBusiness] = useState(offer.onBusiness)
  const [savingBusiness, startBusiness] = useTransition()
  const toggleBusiness = (enabled: boolean) => {
    // Flip immediately; updates inside a transition only show once the server call finishes.
    setOnBusiness(enabled)
    startBusiness(async () => {
      const result = await setOfferOnBusiness({ id: offer.id, enabled })
      if (!result.ok) {
        setOnBusiness(!enabled)
        return void toast.error(result.error)
      }
      toast.success(enabled ? 'Added to your business' : 'Removed from your business')
      router.refresh()
    })
  }

  // --- Share ---------------------------------------------------------------------
  const [copied, setCopied] = useState<string | null>(null)
  const copy = (url: string) => {
    void navigator.clipboard.writeText(url)
    setCopied(url)
    setTimeout(() => setCopied(null), 1500)
  }

  const enabledModes = ORDER_MODE_KINDS.filter((kind) => offer.modes[kind])

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link href="/projects" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Projects
          </Link>
          <h1 className="truncate text-2xl font-bold">{offer.title}</h1>
          <p className="text-sm text-muted-foreground">
            {typeLabel} · {offer.pricing.amountCents ? formatUsd(offer.pricing.amountCents) : 'No price yet'}
            {offer.pricing.billing === 'MONTHLY' ? '/month' : ''} · {enabledModes.length} way
            {enabledModes.length === 1 ? '' : 's'} to order
          </p>
          {offer.orderSummary.paidCount ? (
            <p className="mt-1 text-sm">
              <span className="font-medium">{formatMoney(offer.orderSummary.collectedCents)}</span> collected ·{' '}
              {offer.orderSummary.paidCount} paid
              {offer.orderSummary.balanceDueCents
                ? ` · ${formatMoney(offer.orderSummary.balanceDueCents)} balance scheduled`
                : ''}
            </p>
          ) : null}
        </div>
      </div>

      {locked ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <p>
            You can look around, but saving needs a package.{' '}
            <Link href="/settings" className="font-medium underline underline-offset-2">
              Choose one in Settings
            </Link>
            .
          </p>
        </div>
      ) : null}
      {!offer.stripeConnected ? (
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p>
            Buyers can&apos;t pay until you{' '}
            <Link href="/settings" className="font-medium underline underline-offset-2">
              connect Stripe
            </Link>
            .
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Section
            title="Details"
            description="What buyers see first."
            footer={<SaveButton dirty={detailsDirty} saving={savingDetails} onClick={saveDetails} disabled={locked} />}
          >
            <div className="space-y-2">
              <Label htmlFor="offer-title">Name</Label>
              <Input
                id="offer-title"
                value={details.title}
                maxLength={255}
                onChange={(event) => setDetails({ ...details, title: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="offer-description">Description</Label>
              <Textarea
                id="offer-description"
                rows={3}
                maxLength={2000}
                value={details.description}
                onChange={(event) => setDetails({ ...details, description: event.target.value })}
              />
            </div>
          </Section>

          <Section
            title="Price"
            description="Buyers see at most three choices. Amounts are in US dollars."
            footer={<SaveButton dirty={pricingDirty} saving={savingPricing} onClick={savePricing} disabled={locked} />}
          >
            {offer.pricing.legacyPriceUnsynced ? (
              <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                This offer still uses a price from your Stripe dashboard. Save a price here to manage it from sts-ai.
              </p>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="price-amount">Price</Label>
                <MoneyInput id="price-amount" value={pricing.amount} onChange={(amount) => setPricing({ ...pricing, amount })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price-billing">Billing</Label>
                <Select
                  value={pricing.billing}
                  onValueChange={(billing) => setPricing({ ...pricing, billing: billing as 'ONE_TIME' | 'MONTHLY' })}
                >
                  <SelectTrigger id="price-billing" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ONE_TIME">One-time</SelectItem>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className={cn('rounded-xl border border-border p-4', !oneTime && 'opacity-50')}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Allow a deposit</p>
                  <p className="text-xs text-muted-foreground">Pay part now; Stripe invoices the rest on the due date.</p>
                </div>
                <Switch
                  checked={oneTime && pricing.depositOn}
                  disabled={!oneTime}
                  onCheckedChange={(depositOn) => setPricing({ ...pricing, depositOn })}
                  aria-label="Allow a deposit"
                />
              </div>
              {oneTime && pricing.depositOn ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="price-deposit">Deposit today</Label>
                    <MoneyInput id="price-deposit" value={pricing.deposit} onChange={(deposit) => setPricing({ ...pricing, deposit })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price-due">Rest due after (days)</Label>
                    <Input
                      id="price-due"
                      inputMode="numeric"
                      value={pricing.dueDays}
                      onChange={(event) => setPricing({ ...pricing, dueDays: event.target.value.replace(/\D/g, '') })}
                    />
                  </div>
                  {amountCents > depositCents && depositCents > 0 ? (
                    <p className="text-xs text-muted-foreground sm:col-span-2">
                      Buyer pays {formatUsd(depositCents)} today and {formatUsd(amountCents - depositCents)} in{' '}
                      {pricing.dueDays || '0'} days.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className={cn('rounded-xl border border-border p-4', !oneTime && 'opacity-50')}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Offer monthly instead</p>
                  <p className="text-xs text-muted-foreground">Let buyers choose a monthly plan as an alternative.</p>
                </div>
                <Switch
                  checked={oneTime && pricing.monthlyOn}
                  disabled={!oneTime}
                  onCheckedChange={(monthlyOn) => setPricing({ ...pricing, monthlyOn })}
                  aria-label="Offer monthly instead"
                />
              </div>
              {oneTime && pricing.monthlyOn ? (
                <div className="mt-4 max-w-[240px] space-y-2">
                  <Label htmlFor="price-monthly">Per month</Label>
                  <MoneyInput id="price-monthly" value={pricing.monthly} onChange={(monthly) => setPricing({ ...pricing, monthly })} />
                </div>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Want buyers to pay over time with Affirm, Klarna or Afterpay? Turn them on in your Stripe dashboard and they
              appear at checkout.
            </p>
          </Section>

          <Section
            title="Ways to order"
            description="Buyers only see the ways you turn on."
            footer={<SaveButton dirty={modesDirty} saving={savingModes} onClick={saveModes} disabled={locked} />}
          >
            {ORDER_MODE_KINDS.map((kind) => {
              const on = modes.modes[kind]
              return (
                <div key={kind} className="rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">{ORDER_MODE_COPY[kind].title}</p>
                      <p className="text-xs text-muted-foreground">{ORDER_MODE_COPY[kind].description}</p>
                    </div>
                    <Switch
                      checked={on}
                      onCheckedChange={(checked) => setModes({ ...modes, modes: { ...modes.modes, [kind]: checked } })}
                      aria-label={ORDER_MODE_COPY[kind].title}
                    />
                  </div>
                  {kind === 'AI_ASSISTANT' && on ? (
                    <div className="mt-4">
                      <AiPanelPicker
                        offerId={offer.id}
                        picks={modes}
                        onChange={(picks) => setModes({ ...modes, ...picks })}
                        agents={offer.agents}
                        tour={offer.tour}
                      />
                    </div>
                  ) : null}
                  {kind === 'LIVE_HOST' && on ? (
                    <div className="mt-4 space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="offer-live-start">Live session starts</Label>
                        <Input
                          id="offer-live-start"
                          type="datetime-local"
                          value={modes.liveStart}
                          onChange={(event) => setModes({ ...modes, liveStart: event.target.value })}
                          className="sm:max-w-[260px]"
                        />
                        <p className="text-xs text-muted-foreground">
                          The Live link shows a countdown to this time. People who save a seat land in your pipeline.
                        </p>
                      </div>
                      {offer.slug ? (
                        <Link
                          href={`/live/${offer.slug}/room`}
                          className="inline-flex items-center gap-1.5 text-sm font-medium underline-offset-2 hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Open your host room
                        </Link>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </Section>

          <Section title="Business & website" description="Where else this offer shows up.">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Show on my business</p>
                <p className="text-xs text-muted-foreground">
                  Lists it on your business page and website SDK, and lets your business AI recommend it.
                </p>
              </div>
              {offer.hasBusiness ? (
                <Switch
                  checked={onBusiness}
                  disabled={locked || savingBusiness}
                  onCheckedChange={toggleBusiness}
                  aria-label="Show on my business"
                />
              ) : (
                <Link href="/messages/publish" className="shrink-0 text-sm underline underline-offset-2">
                  Set up business
                </Link>
              )}
            </div>
          </Section>

          <Section title="Orders" description="Newest first. “Didn’t finish” means the buyer left checkout: worth a follow-up.">
            <OfferOrders orders={offer.orders} />
          </Section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-2xl border border-border bg-card">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold">Share links</h2>
              <p className="text-sm text-muted-foreground">Send these on WhatsApp, email or social.</p>
            </div>
            <div className="space-y-3 px-5 py-4">
              {offer.shareLinks.length ? (
                offer.shareLinks.map((link) => (
                  <div key={link.variant} className="space-y-1.5">
                    <p className="text-xs">
                      <span className="font-medium">{link.label}</span>
                      <span className="text-muted-foreground"> · {link.hint}</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <Input readOnly value={link.url} className="h-9 text-xs" onFocus={(event) => event.target.select()} />
                      <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={() => copy(link.url)} aria-label="Copy link">
                        {copied === link.url ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                      <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" asChild>
                        <a href={link.url} target="_blank" rel="noreferrer" aria-label="Open link">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Turn on a way to order to get a link.</p>
              )}
              {offer.shareLinks[0] ? (
                <Button variant="outline" className="w-full" asChild>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`${offer.title} ${offer.shareLinks[0].url}?src=whatsapp`)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Share on WhatsApp
                  </a>
                </Button>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Add <code className="rounded bg-muted px-1">?src=email</code> (or any tag) to see where buyers came from.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
