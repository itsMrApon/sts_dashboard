'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Check, Copy, Loader2, Search } from 'lucide-react'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  createOffer,
  createStripeCatalogPrice,
  deleteOffer,
  getOfferForEdit,
  listStripeCatalog,
  saveOfferDetails,
  saveOfferOrderModes,
  saveOfferStripePricing,
  setOfferOnBusiness,
  type StripeCatalogProduct,
} from '@/actions/offers'
import type { AiService, OfferKindInput, OfferSettingsView, OrderModeKey, OrderModesInput } from '@/lib/offers/offerTypes'

const STEPS = ['Type', 'Details', 'Price', 'How people buy', 'Done'] as const
type Step = 0 | 1 | 2 | 3 | 4

const usd = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100)

/** "2026-11-21T10:00" in the creator's own time zone, for <input type="datetime-local">. */
function toLocalInput(iso: string): string {
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** The buyer-facing choices for each type, in plain words, mapped to the ways to order. */
const WAYS: Record<OfferKindInput, { mode: OrderModeKey; title: string; detail: string }[]> = {
  PRODUCT: [
    { mode: 'AI_ASSISTANT', title: 'Talk to my AI first', detail: 'Chat, a guided tour and voice, then pay' },
    { mode: 'INSTANT_CHECKOUT', title: 'Buy right away', detail: 'Leave an email or WhatsApp, then pay on Stripe' },
    { mode: 'DIRECT_PAY', title: 'Just a pay link', detail: 'Straight to Stripe, no form' },
  ],
  WEBINAR: [
    { mode: 'LIVE_HOST', title: 'Join me live', detail: 'A waiting room counts down, then you go live and drop Buy now' },
    { mode: 'AI_ASSISTANT', title: 'Talk to my AI first', detail: 'Chat, a guided tour and voice, then pay' },
    { mode: 'DIRECT_PAY', title: 'Just a pay link', detail: 'Straight to Stripe, no form' },
  ],
}

const PANELS: { id: AiService; label: string }[] = [
  { id: 'CHAT', label: 'Chat' },
  { id: 'WIZARD', label: 'Guided tour' },
  { id: 'SPEAK', label: 'Voice' },
]

function StepNav({ step, maxStep, onGo }: { step: Step; maxStep: Step; onGo: (step: Step) => void }) {
  return (
    <ol className="flex flex-wrap gap-1.5" aria-label="Steps">
      {STEPS.map((label, index) => {
        const reachable = index <= maxStep
        return (
          <li key={label}>
            <button
              type="button"
              disabled={!reachable}
              onClick={() => onGo(index as Step)}
              aria-current={index === step ? 'step' : undefined}
              className={cn(
                'rounded-full border px-3 py-1 text-xs transition-colors',
                index === step ? 'border-primary bg-primary/15 font-medium text-primary' : 'border-border text-muted-foreground',
                reachable && index !== step && 'hover:text-foreground',
                !reachable && 'opacity-40',
              )}
            >
              {index + 1}. {label}
            </button>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * Create or edit a product or webinar in five steps: Type, Details, Price (from the creator's Stripe
 * products), How people buy, Done (links, Menu, orders). Each step is saved when you go on, so
 * closing halfway keeps what was done. Opens with ?new=1 (optionally &type=product|webinar) or
 * ?edit=<id> on /projects.
 */
export function ProjectWizard({ canCreate }: { canCreate: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const editId = params.get('edit')
  const openNew = params.get('new') === '1'
  const presetType = params.get('type') === 'webinar' ? 'WEBINAR' : params.get('type') === 'product' ? 'PRODUCT' : null
  const open = Boolean(editId) || (openNew && canCreate)

  const [step, setStep] = useState<Step>(0)
  const [maxStep, setMaxStep] = useState<Step>(0)
  const [offer, setOffer] = useState<OfferSettingsView | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, startSaving] = useTransition()

  // Details
  const [kind, setKind] = useState<OfferKindInput | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [thumbnail, setThumbnail] = useState('')
  const [startTime, setStartTime] = useState('')

  const close = useCallback(() => {
    const next = new URLSearchParams(params.toString())
    for (const key of ['new', 'edit', 'type']) next.delete(key)
    router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false })
  }, [params, pathname, router])

  const goTo = (next: Step) => {
    setStep(next)
    setMaxStep((current) => (next > current ? next : current))
  }

  const fill = useCallback((view: OfferSettingsView) => {
    setOffer(view)
    setKind(view.kind)
    setTitle(view.title)
    setDescription(view.description)
    setThumbnail(view.thumbnail ?? '')
    setStartTime(toLocalInput(view.startTime))
  }, [])

  const reload = useCallback(
    async (id: string) => {
      const result = await getOfferForEdit({ id })
      if (result.ok) fill(result.offer)
      else toast.error(result.error)
      return result.ok ? result.offer : null
    },
    [fill],
  )

  // Open: a fresh form for New, the saved offer for Edit.
  useEffect(() => {
    if (!open) return
    setOffer(null)
    if (editId) {
      setLoading(true)
      reload(editId).then((view) => {
        setLoading(false)
        if (!view) return close()
        setStep(1)
        setMaxStep(4)
      })
      return
    }
    setKind(presetType)
    setTitle('')
    setDescription('')
    setThumbnail('')
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(10, 0, 0, 0)
    setStartTime(toLocalInput(tomorrow.toISOString()))
    setStep(presetType ? 1 : 0)
    setMaxStep(presetType ? 1 : 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editId])

  const saveDetails = () =>
    startSaving(async () => {
      if (!kind) return
      let id = offer?.id
      if (!id) {
        const created = await createOffer({ kind, title })
        if (!created.ok) return void toast.error(created.error)
        id = created.id
      }
      const saved = await saveOfferDetails({
        id,
        title,
        description,
        thumbnail,
        startTime: kind === 'WEBINAR' && startTime ? new Date(startTime).toISOString() : undefined,
      })
      if (!saved.ok) return void toast.error(saved.error)
      const view = await reload(id)
      if (view) {
        router.refresh()
        goTo(2)
      }
    })

  const title_ = offer ? 'Edit ' + (offer.kind === 'PRODUCT' ? 'product' : 'webinar') : 'New product or webinar'

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : close())}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader className="space-y-3">
          <DialogTitle>{offer ? offer.title || title_ : title_}</DialogTitle>
          <DialogDescription className="sr-only">Five steps: type, details, price, how people buy, done.</DialogDescription>
          <StepNav step={step} maxStep={maxStep} onGo={(target) => (offer || target <= 1 ? setStep(target) : null)} />
        </DialogHeader>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : step === 0 ? (
          <TypeStep
            value={kind}
            locked={Boolean(offer)}
            onPick={(next) => {
              setKind(next)
              goTo(1)
            }}
          />
        ) : step === 1 ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pw-title">Name</Label>
              <Input id="pw-title" value={title} maxLength={255} onChange={(e) => setTitle(e.target.value)} placeholder={kind === 'WEBINAR' ? 'Tax basics, live' : 'Home insurance check'} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw-description">What buyers get</Label>
              <Textarea
                id="pw-description"
                rows={4}
                maxLength={2000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What it is, who it's for and what's included. Your AI sells from this, so be specific."
              />
            </div>
            {kind === 'WEBINAR' ? (
              <div className="space-y-1.5">
                <Label htmlFor="pw-start">When you go live</Label>
                <Input id="pw-start" type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="pw-image">Image link (optional)</Label>
              <Input id="pw-image" value={thumbnail} onChange={(e) => setThumbnail(e.target.value)} placeholder="https://…/cover.jpg" />
            </div>
            <div className="flex justify-between gap-2 pt-2">
              {offer ? <span /> : <Button variant="outline" onClick={() => setStep(0)}>Back</Button>}
              <Button onClick={saveDetails} disabled={saving || !title.trim() || !kind}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {offer ? 'Save and continue' : 'Create and continue'}
              </Button>
            </div>
          </div>
        ) : !offer ? null : step === 2 ? (
          <PriceStep offer={offer} title={title} onSaved={async () => { await reload(offer.id); router.refresh(); goTo(3) }} onSkip={() => goTo(3)} />
        ) : step === 3 ? (
          <WaysStep offer={offer} startTime={startTime} onSaved={async () => { await reload(offer.id); router.refresh(); goTo(4) }} />
        ) : (
          <DoneStep offer={offer} onChanged={() => reload(offer.id).then(() => router.refresh())} onDeleted={() => { close(); router.refresh() }} onClose={close} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function TypeStep({ value, locked, onPick }: { value: OfferKindInput | null; locked: boolean; onPick: (kind: OfferKindInput) => void }) {
  const options: { kind: OfferKindInput; title: string; detail: string }[] = [
    { kind: 'PRODUCT', title: 'Product', detail: 'Something people buy any time: a service, a package, a course' },
    { kind: 'WEBINAR', title: 'Webinar', detail: 'A live session at a set time, with an offer you drop while live' },
  ]
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {options.map((option) => (
        <button
          key={option.kind}
          type="button"
          disabled={locked && value !== option.kind}
          onClick={() => onPick(option.kind)}
          className={cn(
            'rounded-2xl border p-4 text-left transition-colors',
            value === option.kind ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50',
            locked && value !== option.kind && 'opacity-40',
          )}
        >
          <p className="font-semibold">{option.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{option.detail}</p>
        </button>
      ))}
      {locked ? <p className="text-xs text-muted-foreground sm:col-span-2">The type can&apos;t change after it&apos;s made.</p> : null}
    </div>
  )
}

function PriceStep({ offer, title, onSaved, onSkip }: { offer: OfferSettingsView; title: string; onSaved: () => Promise<void>; onSkip: () => void }) {
  const [products, setProducts] = useState<StripeCatalogProduct[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [priceId, setPriceId] = useState<string | null>(offer.pricing.stripe?.priceId ?? null)
  const [monthlyId, setMonthlyId] = useState<string | null>(offer.pricing.monthlyOption.enabled ? (offer.pricing.monthlyOption.stripe?.priceId ?? null) : null)
  const [deposit, setDeposit] = useState(offer.pricing.deposit.enabled)
  const [depositDollars, setDepositDollars] = useState(String(Math.max(1, Math.round(offer.pricing.deposit.depositCents / 100))))
  const [balanceDays, setBalanceDays] = useState(String(offer.pricing.deposit.balanceDueDays || 14))
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState(title)
  const [newAmount, setNewAmount] = useState('')
  const [newMonthly, setNewMonthly] = useState(false)
  const [busy, startBusy] = useTransition()

  useEffect(() => {
    if (!offer.stripeConnected) return
    listStripeCatalog().then((result) => (result.ok ? setProducts(result.products) : setError(result.error)))
  }, [offer.stripeConnected])

  const allPrices = useMemo(() => (products ?? []).flatMap((product) => product.prices.map((price) => ({ ...price, product }))), [products])
  const picked = allPrices.find((price) => price.priceId === priceId) ?? null
  const shown = (products ?? []).filter((product) => product.name.toLowerCase().includes(query.trim().toLowerCase()))
  const monthlyChoices = allPrices.filter((price) => price.billing === 'MONTHLY' && price.priceId !== priceId)

  if (!offer.stripeConnected) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Prices come from your Stripe products. Connect Stripe first, then come back to this step.</p>
        <div className="flex justify-between gap-2">
          <Button asChild variant="outline"><Link href="/settings">Connect Stripe</Link></Button>
          <Button variant="outline" onClick={onSkip}>Skip for now</Button>
        </div>
      </div>
    )
  }

  const save = () =>
    startBusy(async () => {
      if (!priceId) return
      const result = await saveOfferStripePricing({
        id: offer.id,
        priceId,
        monthlyPriceId: picked?.billing === 'ONE_TIME' ? monthlyId : null,
        deposit:
          picked?.billing === 'ONE_TIME' && deposit
            ? { depositCents: Math.round(Number(depositDollars) * 100), balanceDueDays: Math.round(Number(balanceDays)) }
            : null,
      })
      if (!result.ok) return void toast.error(result.error)
      await onSaved()
    })

  const createProduct = () =>
    startBusy(async () => {
      const result = await createStripeCatalogPrice({ name: newName, amountCents: Math.round(Number(newAmount) * 100), billing: newMonthly ? 'MONTHLY' : 'ONE_TIME' })
      if (!result.ok) return void toast.error(result.error)
      setProducts((current) => [result.product, ...(current ?? [])])
      setPriceId(result.product.prices[0].priceId)
      setCreating(false)
      toast.success('Added to your Stripe products')
    })

  return (
    <div className="space-y-4">
      {!offer.pricing.stripe && offer.pricing.amountCents > 0 ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
          Now: {usd(offer.pricing.amountCents)} typed in the app, not in Stripe. Pick a Stripe price to replace it, or keep it and skip.
        </p>
      ) : null}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your Stripe products" />
        </div>
        <Button variant="outline" onClick={() => setCreating((value) => !value)}>
          {creating ? 'Cancel' : '+ New in Stripe'}
        </Button>
      </div>

      {creating ? (
        <div className="space-y-3 rounded-2xl border border-border p-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Product name" aria-label="Product name" />
            <Input value={newAmount} onChange={(e) => setNewAmount(e.target.value.replace(/[^\d.]/g, ''))} placeholder="Price ($)" inputMode="decimal" aria-label="Price in dollars" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={newMonthly} onCheckedChange={setNewMonthly} aria-label="Monthly" /> Charge monthly
          </label>
          <Button onClick={createProduct} disabled={busy || !newName.trim() || !Number(newAmount)}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Create in Stripe
          </Button>
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {!products && !error ? (
        <div className="flex h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : null}
      {products && products.length === 0 ? <p className="text-sm text-muted-foreground">No products in your Stripe yet. Create one above.</p> : null}

      <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
        {shown.map((product) => (
          <li key={product.productId} className="rounded-2xl border border-border p-3">
            <p className="truncate text-sm font-medium">{product.name}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {product.prices.map((price) => (
                <button
                  key={price.priceId}
                  type="button"
                  onClick={() => setPriceId(price.priceId)}
                  aria-pressed={price.priceId === priceId}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs',
                    price.priceId === priceId ? 'border-primary bg-primary/15 font-medium text-primary' : 'border-border hover:border-primary/50',
                  )}
                >
                  {usd(price.amountCents)}
                  {price.billing === 'MONTHLY' ? '/month' : ' one-time'}
                  {price.label ? ` · ${price.label}` : ''}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>

      {picked?.billing === 'ONE_TIME' ? (
        <div className="space-y-3 rounded-2xl border border-border p-4">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Let buyers pay a deposit first</span>
            <Switch checked={deposit} onCheckedChange={setDeposit} aria-label="Deposit" />
          </label>
          {deposit ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Input value={depositDollars} onChange={(e) => setDepositDollars(e.target.value.replace(/[^\d.]/g, ''))} aria-label="Deposit in dollars" placeholder="Deposit ($)" inputMode="decimal" />
              <Input value={balanceDays} onChange={(e) => setBalanceDays(e.target.value.replace(/\D/g, ''))} aria-label="Days until the rest is due" placeholder="Rest due in (days)" inputMode="numeric" />
            </div>
          ) : null}
          {monthlyChoices.length ? (
            <div className="space-y-1.5">
              <p className="text-sm">Also offer a monthly option (optional)</p>
              <select
                className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                value={monthlyId ?? ''}
                onChange={(e) => setMonthlyId(e.target.value || null)}
                aria-label="Monthly option"
              >
                <option value="">No monthly option</option>
                {monthlyChoices.map((price) => (
                  <option key={price.priceId} value={price.priceId}>
                    {price.product.name} · {usd(price.amountCents)}/month
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex justify-between gap-2 pt-1">
        <Button variant="outline" onClick={onSkip}>Skip for now</Button>
        <Button onClick={save} disabled={busy || !priceId}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save and continue
        </Button>
      </div>
    </div>
  )
}

function WaysStep({ offer, startTime, onSaved }: { offer: OfferSettingsView; startTime: string; onSaved: () => Promise<void> }) {
  const [modes, setModes] = useState<OrderModesInput>(offer.modes)
  const [panels, setPanels] = useState<AiService[]>(offer.aiServices.length ? offer.aiServices : ['CHAT', 'WIZARD', 'SPEAK'])
  // Null = the assistants picked in Services (recommended); an id = this product's own agent.
  const [agentId, setAgentId] = useState<string>(offer.livekitAgentId ?? '')
  const [busy, startBusy] = useTransition()
  const ways = WAYS[offer.kind]

  const save = () =>
    startBusy(async () => {
      const result = await saveOfferOrderModes({
        id: offer.id,
        modes,
        aiServices: panels,
        livekitAgentId: agentId || null,
        liveStartTime: modes.LIVE_HOST && startTime ? new Date(startTime).toISOString() : undefined,
      })
      if (!result.ok) return void toast.error(result.error)
      await onSaved()
    })

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Pick every way people can buy. They choose the one they like.</p>
      {ways.map((way) => {
        const on = modes[way.mode]
        return (
          <div key={way.mode} className={cn('rounded-2xl border p-4', on ? 'border-primary/60 bg-primary/5' : 'border-border')}>
            <label className="flex items-start justify-between gap-3">
              <span>
                <span className="block font-medium">{way.title}</span>
                <span className="block text-sm text-muted-foreground">{way.detail}</span>
              </span>
              <Switch checked={on} onCheckedChange={(next) => setModes((current) => ({ ...current, [way.mode]: next }))} aria-label={way.title} />
            </label>
            {way.mode === 'AI_ASSISTANT' && on ? (
              <div className="mt-3 space-y-3 border-t border-border pt-3">
                <div className="flex flex-wrap gap-1.5">
                  {PANELS.map((panel) => {
                    const active = panels.includes(panel.id)
                    return (
                      <button
                        key={panel.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setPanels((current) => (active ? current.filter((id) => id !== panel.id) : [...current, panel.id]))}
                        className={cn('rounded-full border px-3 py-1 text-xs', active ? 'border-primary bg-primary/15 font-medium text-primary' : 'border-border')}
                      >
                        {panel.label}
                      </button>
                    )
                  })}
                </div>
                {panels.includes('WIZARD') ? (
                  <p className="text-xs text-muted-foreground">
                    The tour is {offer.tour.status === 'published' ? 'live' : 'a draft'} ({offer.tour.steps} steps).{' '}
                    <Link href={`/services/wizard?product=${offer.id}`} className="underline underline-offset-2">Edit it in Services → Tour</Link>
                  </p>
                ) : null}
                <div className="space-y-1.5">
                  <Label htmlFor="pw-agent" className="text-xs">Who answers</Label>
                  <select id="pw-agent" className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
                    <option value="">Your Services assistants (recommended)</option>
                    {offer.agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>{agent.name} (just for this one)</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}
          </div>
        )
      })}
      <div className="flex justify-end pt-1">
        <Button onClick={save} disabled={busy || !ways.some((way) => modes[way.mode])}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save and continue
        </Button>
      </div>
    </div>
  )
}

function DoneStep({ offer, onChanged, onDeleted, onClose }: { offer: OfferSettingsView; onChanged: () => void; onDeleted: () => void; onClose: () => void }) {
  const [copied, setCopied] = useState<string | null>(null)
  const [more, setMore] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, startBusy] = useTransition()
  const main = offer.shareLinks.find((link) => link.variant === (offer.kind === 'WEBINAR' && offer.modes.LIVE_HOST ? 'live' : 'share')) ?? offer.shareLinks[0] ?? null
  const others = offer.shareLinks.filter((link) => link !== main)

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(url)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      toast.error("Couldn't copy. Select the link and copy it instead.")
    }
  }

  return (
    <div className="space-y-4">
      {main ? (
        <div className="space-y-2 rounded-2xl border border-primary/40 bg-primary/5 p-4">
          <p className="text-sm font-medium">Your link</p>
          <p className="break-all rounded-lg bg-background/60 px-3 py-2 font-mono text-xs">{main.url}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => copy(main.url)}>
              {copied === main.url ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied === main.url ? 'Copied' : 'Copy link'}
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={`https://wa.me/?text=${encodeURIComponent(`${offer.title} ${main.url}`)}`} target="_blank" rel="noopener noreferrer">Share on WhatsApp</a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={main.url} target="_blank" rel="noopener noreferrer">Open</a>
            </Button>
          </div>
          {others.length ? (
            <button type="button" onClick={() => setMore((value) => !value)} className="text-xs text-muted-foreground underline underline-offset-2">
              {more ? 'Hide other links' : `Other links (${others.length})`}
            </button>
          ) : null}
          {more ? (
            <ul className="space-y-1.5">
              {others.map((link) => (
                <li key={link.url} className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0">
                    <span className="font-medium">{link.label}</span> · <span className="text-muted-foreground">{link.hint}</span>
                  </span>
                  <button type="button" onClick={() => copy(link.url)} className="shrink-0 underline underline-offset-2">
                    {copied === link.url ? 'Copied' : 'Copy'}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Turn on a way to buy to get a link.</p>
      )}

      {offer.hasBusiness ? (
        <label className="flex items-center justify-between gap-3 rounded-2xl border border-border p-4 text-sm">
          <span>
            <span className="block font-medium">Show on my Menu</span>
            <span className="block text-muted-foreground">Your Menu, website and AI can recommend it.</span>
          </span>
          <Switch
            checked={offer.onBusiness}
            onCheckedChange={(enabled) =>
              startBusy(async () => {
                const result = await setOfferOnBusiness({ id: offer.id, enabled })
                if (!result.ok) return void toast.error(result.error)
                onChanged()
              })
            }
            aria-label="Show on my Menu"
          />
        </label>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border p-4 text-sm">
        <span>
          {offer.orderSummary.paidCount} paid · {usd(offer.orderSummary.collectedCents)} collected
          {offer.orderSummary.balanceDueCents ? ` · ${usd(offer.orderSummary.balanceDueCents)} still due` : ''}
        </span>
        <Link href={`/projects/${offer.id}/pipeline`} className="underline underline-offset-2">Buyers and chats</Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        {confirmDelete ? (
          <span className="flex items-center gap-2 text-sm">
            Delete it for good?
            <Button
              size="sm"
              variant="destructive"
              disabled={busy}
              onClick={() =>
                startBusy(async () => {
                  const result = await deleteOffer({ id: offer.id })
                  if (!result.ok) return void toast.error(result.error)
                  toast.success(`${offer.title} deleted`)
                  onDeleted()
                })
              }
            >
              Yes, delete
            </Button>
            <Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)}>Keep it</Button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className="text-sm text-destructive underline-offset-2 hover:underline">
            Delete
          </button>
        )}
        <Button onClick={onClose}>Done</Button>
      </div>
    </div>
  )
}
