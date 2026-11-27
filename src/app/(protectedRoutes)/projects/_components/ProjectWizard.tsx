'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Check, Copy, ImagePlus, Loader2, Search, X } from 'lucide-react'
import { toast } from '@/lib/toast'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { CARD_CHIP, CARD_GHOST, CARD_INPUT, CARD_PRIMARY, PALETTES, StepCard } from '@/components/ReusableComponent/StepCard'
import { openMessages } from '@/components/messages/openMessages'
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

type Step = 0 | 1 | 2 | 3 | 4
const TOTAL = 5

/** Each step's two-line title, top left of the card (same look as onboarding). */
const TITLES: Record<Step, [string, string]> = {
  0: ['What are you', 'selling?'],
  1: ['The', 'details'],
  2: ['Its', 'price'],
  3: ['How people', 'buy'],
  4: ['Your', 'link'],
}

const CARD_TEXTAREA =
  'min-h-24 w-full resize-y rounded-xl border border-white/20 bg-white/10 px-3.5 py-2.5 text-[15px] text-white placeholder:text-white/45 outline-none transition-colors focus:border-white/55 focus:bg-white/15'
const CARD_SELECT = cn(CARD_INPUT, 'appearance-none [&>option]:text-black')
const CARD_OPTION =
  'rounded-xl border border-white/20 px-3.5 py-3 text-left transition-colors hover:bg-white/10 aria-pressed:border-white aria-pressed:bg-white aria-pressed:text-black disabled:opacity-40'
const CARD_BOX = 'rounded-xl border border-white/15 bg-black/15 p-3.5'

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

/** Largest side of an uploaded cover, and the size it must fit in once encoded. */
const COVER_MAX_SIDE = 1200
const COVER_MAX_CHARS = 850_000

/** Shrinks a picked photo in the browser and returns it as a JPEG data: URL (saved with the project). */
async function shrinkImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const encode = (maxSide: number, quality: number) => {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', quality)
  }
  let image = encode(COVER_MAX_SIDE, 0.82)
  if (image.length > COVER_MAX_CHARS) image = encode(900, 0.7)
  if (image.length > COVER_MAX_CHARS) image = encode(700, 0.6)
  bitmap.close()
  if (image.length > COVER_MAX_CHARS) throw new Error('too large')
  return image
}

/** A white on/off switch for the card. */
function CardToggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (next: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-50',
        checked ? 'border-white bg-white' : 'border-white/40 bg-white/10',
      )}
    >
      <span className={cn('absolute top-0.5 h-[18px] w-[18px] rounded-full transition-all', checked ? 'left-[22px] bg-black' : 'left-0.5 bg-white/80')} />
    </button>
  )
}

/** The card every step sits on: onboarding's mesh card, with step dots and a close button. */
function Frame({
  step,
  maxStep,
  onGo,
  onClose,
  line,
  footer,
  children,
}: {
  step: Step
  maxStep: Step
  onGo: (step: Step) => void
  onClose: () => void
  line?: string
  footer?: ReactNode
  children: ReactNode
}) {
  return (
    <StepCard
      palette={PALETTES[step % PALETTES.length]}
      title={TITLES[step]}
      step={step + 1}
      total={TOTAL}
      line={line}
      footer={footer}
      className="min-h-[460px] max-w-none"
      badge={
        <span className="flex items-center gap-3">
          <ol className="flex items-center gap-1.5" aria-label="Steps">
            {([0, 1, 2, 3, 4] as Step[]).map((index) => (
              <li key={index}>
                <button
                  type="button"
                  disabled={index > maxStep}
                  onClick={() => onGo(index)}
                  aria-label={`Step ${index + 1}: ${TITLES[index].join(' ')}`}
                  aria-current={index === step ? 'step' : undefined}
                  className={cn(
                    'block h-2 rounded-full transition-all disabled:opacity-30',
                    index === step ? 'w-5 bg-white' : 'w-2 bg-white/50 hover:bg-white/80',
                  )}
                />
              </li>
            ))}
          </ol>
          <button type="button" onClick={onClose} aria-label="Close" className="text-white/70 transition-colors hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </span>
      }
    >
      {children}
    </StepCard>
  )
}

function Primary({ label, onClick, disabled, busy }: { label: string; onClick: () => void; disabled?: boolean; busy?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={busy || disabled} className={CARD_PRIMARY}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {label}
      {busy ? null : <ArrowRight className="h-4 w-4" />}
    </button>
  )
}

/**
 * Create or edit a product or webinar in five steps: Type, Details, Price (from the creator's Stripe
 * products), How people buy, Done (the link, Menu, orders). Each step is saved when you go on, so
 * closing halfway keeps what was done. Opens with ?new=1 (optionally &type=product|webinar) or
 * ?edit=<id> on /projects. Same card design as onboarding.
 */
export function ProjectWizard({ canCreate }: { canCreate: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const editId = params.get('edit')
  const openNew = params.get('new') === '1'
  const presetType = params.get('type') === 'webinar' ? 'WEBINAR' : params.get('type') === 'product' ? 'PRODUCT' : null
  // "Make it a new project" from General questions passes the question as a starting title.
  const presetTitle = (params.get('title') ?? '').slice(0, 255)
  const open = Boolean(editId) || (openNew && canCreate)

  const [step, setStep] = useState<Step>(0)
  const [maxStep, setMaxStep] = useState<Step>(0)
  const [offer, setOffer] = useState<OfferSettingsView | null>(null)
  /** Set as soon as a new project exists, so a failed save never makes a second one. */
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, startSaving] = useTransition()

  // Details
  const [kind, setKind] = useState<OfferKindInput | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [thumbnail, setThumbnail] = useState('')
  const [startTime, setStartTime] = useState('')

  const close = useCallback(() => {
    const next = new URLSearchParams(params.toString())
    for (const key of ['new', 'edit', 'type', 'title']) next.delete(key)
    router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false })
  }, [params, pathname, router])

  const goTo = (next: Step) => {
    setError(null)
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
      else setError(result.error)
      return result.ok ? result.offer : null
    },
    [fill],
  )

  // Open: a fresh form for New, the saved offer for Edit.
  useEffect(() => {
    if (!open) return
    setOffer(null)
    setCreatedId(null)
    setError(null)
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
    setTitle(presetTitle)
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
      setError(null)
      let id = offer?.id ?? createdId
      if (!id) {
        const created = await createOffer({ kind, title })
        if (!created.ok) return setError(created.error)
        id = created.id
        setCreatedId(id)
      }
      const saved = await saveOfferDetails({
        id,
        title,
        description,
        thumbnail,
        startTime: kind === 'WEBINAR' && startTime ? new Date(startTime).toISOString() : undefined,
      })
      if (!saved.ok) return setError(saved.error)
      const view = await reload(id)
      if (view) {
        router.refresh()
        goTo(2)
      }
    })

  const frame = {
    step,
    maxStep,
    onGo: (target: Step) => (offer || target <= 1 ? goTo(target) : null),
    onClose: close,
  }
  const errorLine = error ? <p className="text-xs text-rose-200">{error}</p> : null

  let card: ReactNode
  if (loading) {
    card = (
      <Frame {...frame}>
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-white/80" />
        </div>
      </Frame>
    )
  } else if (step === 0) {
    card = (
      <Frame {...frame} line="A product people buy any time, or a webinar at a set time.">
        <TypeStep
          value={kind}
          locked={Boolean(offer)}
          onPick={(next) => {
            setKind(next)
            goTo(1)
          }}
        />
      </Frame>
    )
  } else if (step === 1) {
    card = (
      <Frame
        {...frame}
        line="Name it and say what buyers get. Your AI sells from this."
        footer={
          <>
            {offer ? <span /> : <button type="button" onClick={() => goTo(0)} disabled={saving} className={CARD_GHOST}>Back</button>}
            <Primary
              label={offer || createdId ? 'Save and continue' : 'Create and continue'}
              onClick={saveDetails}
              busy={saving}
              disabled={!title.trim() || !kind}
            />
          </>
        }
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-white/75">Name</span>
          <input
            value={title}
            maxLength={255}
            autoFocus
            onChange={(e) => setTitle(e.target.value)}
            placeholder={kind === 'WEBINAR' ? 'Webinar name' : 'Product name'}
            className={CARD_INPUT}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-white/75">What buyers get</span>
          <textarea
            rows={3}
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's included and who it's for"
            className={CARD_TEXTAREA}
          />
        </label>
        {kind === 'WEBINAR' ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-white/75">When you go live</span>
            <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={cn(CARD_INPUT, '[color-scheme:dark]')} />
          </label>
        ) : null}
        <CoverField value={thumbnail} onChange={setThumbnail} />
        {errorLine}
      </Frame>
    )
  } else if (!offer) {
    // The project exists but couldn't be loaded: offer a retry instead of a blank card.
    card = (
      <Frame {...frame} line="Couldn't load it just now.">
        {errorLine}
        <div>
          <Primary label="Try again" onClick={() => void (createdId ? reload(createdId) : Promise.resolve(null))} disabled={!createdId} />
        </div>
      </Frame>
    )
  } else if (step === 2) {
    card = <PriceStep frame={frame} offer={offer} title={title} onSaved={async () => { await reload(offer.id); router.refresh(); goTo(3) }} onSkip={() => goTo(3)} />
  } else if (step === 3) {
    card = <WaysStep frame={frame} offer={offer} startTime={startTime} onSaved={async () => { await reload(offer.id); router.refresh(); goTo(4) }} />
  } else {
    card = (
      <DoneStep
        frame={frame}
        offer={offer}
        onChanged={() => reload(offer.id).then(() => router.refresh())}
        onDeleted={() => {
          close()
          router.refresh()
        }}
      />
    )
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : close())}>
      <DialogContent isHideCloseButton className="max-h-[92vh] gap-0 overflow-y-auto border-0 bg-transparent p-0 shadow-none sm:max-w-[500px]">
        <DialogTitle className="sr-only">{offer ? `Edit ${offer.title}` : 'New product or webinar'}</DialogTitle>
        <DialogDescription className="sr-only">Five steps: type, details, price, how people buy, your link.</DialogDescription>
        {card}
      </DialogContent>
    </Dialog>
  )
}

type FrameProps = { step: Step; maxStep: Step; onGo: (step: Step) => void; onClose: () => void }

function TypeStep({ value, locked, onPick }: { value: OfferKindInput | null; locked: boolean; onPick: (kind: OfferKindInput) => void }) {
  const options: { kind: OfferKindInput; title: string; detail: string }[] = [
    { kind: 'PRODUCT', title: 'Product', detail: 'Something people buy any time: a service, a package, a course' },
    { kind: 'WEBINAR', title: 'Webinar', detail: 'A live session at a set time, with an offer you drop while live' },
  ]
  return (
    <div className="flex flex-col gap-2">
      {options.map((option) => (
        <button
          key={option.kind}
          type="button"
          aria-pressed={value === option.kind}
          disabled={locked && value !== option.kind}
          onClick={() => onPick(option.kind)}
          className={CARD_OPTION}
        >
          <span className="block text-sm font-medium">{option.title}</span>
          <span className="mt-0.5 block text-xs opacity-75">{option.detail}</span>
        </button>
      ))}
      {locked ? <p className="text-xs text-white/70">The type can&apos;t change after it&apos;s made.</p> : null}
    </div>
  )
}

/** The cover: an uploaded photo (shrunk in the browser), shown as a preview. */
function CoverField({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const pick = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return void toast.error('Pick an image file')
    setBusy(true)
    try {
      onChange(await shrinkImage(file))
    } catch {
      toast.error("Couldn't use that image. Try another one.")
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-white/75">Cover image (optional)</span>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
      {value ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Cover" className="aspect-video w-32 rounded-lg object-cover" />
          <div className="flex flex-col items-start gap-1">
            <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className={CARD_GHOST}>
              {busy ? 'Loading…' : 'Change'}
            </button>
            <button type="button" onClick={() => onChange('')} className={CARD_GHOST}>Remove</button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-dashed border-white/30 text-sm text-white/80 transition-colors hover:bg-white/10"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          Upload a cover
        </button>
      )}
    </div>
  )
}

function PriceStep({
  frame,
  offer,
  title,
  onSaved,
  onSkip,
}: {
  frame: FrameProps
  offer: OfferSettingsView
  title: string
  onSaved: () => Promise<void>
  onSkip: () => void
}) {
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
    // No Stripe: say so and let them carry on. The price can be added later from this step.
    return (
      <Frame
        {...frame}
        line="Prices come from your Stripe products. Connect Stripe any time and pick the price here."
        footer={
          <>
            <a href="/settings" target="_blank" rel="noopener noreferrer" className={CARD_GHOST}>
              Connect Stripe
            </a>
            <Primary label="Continue without a price" onClick={onSkip} />
          </>
        }
      >
        <p className="text-sm text-white/75">Buyers can still leave their details and talk to your AI. Checkout turns on once a price is set.</p>
      </Frame>
    )
  }

  const save = () =>
    startBusy(async () => {
      if (!priceId) return
      setError(null)
      const result = await saveOfferStripePricing({
        id: offer.id,
        priceId,
        monthlyPriceId: picked?.billing === 'ONE_TIME' ? monthlyId : null,
        deposit:
          picked?.billing === 'ONE_TIME' && deposit
            ? { depositCents: Math.round(Number(depositDollars) * 100), balanceDueDays: Math.round(Number(balanceDays)) }
            : null,
      })
      if (!result.ok) return setError(result.error)
      await onSaved()
    })

  const createProduct = () =>
    startBusy(async () => {
      setError(null)
      const result = await createStripeCatalogPrice({ name: newName, amountCents: Math.round(Number(newAmount) * 100), billing: newMonthly ? 'MONTHLY' : 'ONE_TIME' })
      if (!result.ok) return setError(result.error)
      setProducts((current) => [result.product, ...(current ?? [])])
      setPriceId(result.product.prices[0].priceId)
      setCreating(false)
      toast.success('Added to your Stripe products')
    })

  return (
    <Frame
      {...frame}
      line="Pick the price from your Stripe products, or add a new one."
      footer={
        <>
          <button type="button" onClick={onSkip} disabled={busy} className={CARD_GHOST}>Skip for now</button>
          <Primary label="Save and continue" onClick={save} busy={busy} disabled={!priceId} />
        </>
      }
    >
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" aria-hidden />
          <input className={cn(CARD_INPUT, 'pl-9')} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your Stripe products" aria-label="Search your Stripe products" />
        </div>
        <button type="button" onClick={() => setCreating((value) => !value)} aria-pressed={creating} className={CARD_CHIP}>
          {creating ? 'Cancel' : '+ New'}
        </button>
      </div>

      {creating ? (
        <div className={cn(CARD_BOX, 'flex flex-col gap-3')}>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px]">
            <input className={CARD_INPUT} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Product name" aria-label="Product name" />
            <input className={CARD_INPUT} value={newAmount} onChange={(e) => setNewAmount(e.target.value.replace(/[^\d.]/g, ''))} placeholder="Price ($)" inputMode="decimal" aria-label="Price in dollars" />
          </div>
          <label className="flex items-center justify-between gap-3 text-sm">
            Charge monthly
            <CardToggle checked={newMonthly} onChange={setNewMonthly} label="Charge monthly" />
          </label>
          <div>
            <Primary label="Create in Stripe" onClick={createProduct} busy={busy} disabled={!newName.trim() || !Number(newAmount)} />
          </div>
        </div>
      ) : null}

      {!products && !error ? (
        <div className="flex h-20 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-white/70" /></div>
      ) : null}
      {products && products.length === 0 ? <p className="text-sm text-white/75">No products in your Stripe yet. Add one with + New.</p> : null}

      {shown.length ? (
        <ul className="flex max-h-56 flex-col gap-2 overflow-y-auto pr-1">
          {shown.map((product) => (
            <li key={product.productId} className={CARD_BOX}>
              <p className="truncate text-sm font-medium">{product.name}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {product.prices.map((price) => (
                  <button
                    key={price.priceId}
                    type="button"
                    onClick={() => setPriceId(price.priceId)}
                    aria-pressed={price.priceId === priceId}
                    className={cn(CARD_CHIP, 'px-3 py-1 text-xs')}
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
      ) : null}

      {picked?.billing === 'ONE_TIME' ? (
        <div className={cn(CARD_BOX, 'flex flex-col gap-3')}>
          <label className="flex items-center justify-between gap-3 text-sm">
            Let buyers pay a deposit first
            <CardToggle checked={deposit} onChange={setDeposit} label="Deposit" />
          </label>
          {deposit ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <input className={CARD_INPUT} value={depositDollars} onChange={(e) => setDepositDollars(e.target.value.replace(/[^\d.]/g, ''))} aria-label="Deposit in dollars" placeholder="Deposit ($)" inputMode="decimal" />
              <input className={CARD_INPUT} value={balanceDays} onChange={(e) => setBalanceDays(e.target.value.replace(/\D/g, ''))} aria-label="Days until the rest is due" placeholder="Rest due in (days)" inputMode="numeric" />
            </div>
          ) : null}
          {monthlyChoices.length ? (
            <label className="flex flex-col gap-1.5 text-sm">
              Also offer a monthly option (optional)
              <select className={CARD_SELECT} value={monthlyId ?? ''} onChange={(e) => setMonthlyId(e.target.value || null)} aria-label="Monthly option">
                <option value="">No monthly option</option>
                {monthlyChoices.map((price) => (
                  <option key={price.priceId} value={price.priceId}>
                    {price.product.name} · {usd(price.amountCents)}/month
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="text-xs text-rose-200">{error}</p> : null}
    </Frame>
  )
}

function WaysStep({ frame, offer, startTime, onSaved }: { frame: FrameProps; offer: OfferSettingsView; startTime: string; onSaved: () => Promise<void> }) {
  const [modes, setModes] = useState<OrderModesInput>(offer.modes)
  const [panels, setPanels] = useState<AiService[]>(offer.aiServices.length ? offer.aiServices : ['CHAT', 'WIZARD', 'SPEAK'])
  // Empty = the assistants picked in Services (recommended); an id = this product's own agent.
  const [agentId, setAgentId] = useState<string>(offer.livekitAgentId ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, startBusy] = useTransition()
  const ways = WAYS[offer.kind]

  const save = () =>
    startBusy(async () => {
      setError(null)
      const result = await saveOfferOrderModes({
        id: offer.id,
        modes,
        aiServices: panels,
        livekitAgentId: agentId || null,
        liveStartTime: modes.LIVE_HOST && startTime ? new Date(startTime).toISOString() : undefined,
      })
      if (!result.ok) return setError(result.error)
      await onSaved()
    })

  return (
    <Frame
      {...frame}
      line="Turn on every way people can buy. They pick the one they like."
      footer={
        <>
          <button type="button" onClick={() => frame.onGo(2)} disabled={busy} className={CARD_GHOST}>Back</button>
          <Primary label="Save and continue" onClick={save} busy={busy} disabled={!ways.some((way) => modes[way.mode])} />
        </>
      }
    >
      {ways.map((way) => {
        const on = modes[way.mode]
        return (
          <div key={way.mode} className={cn(CARD_BOX, on && 'border-white/50 bg-white/10')}>
            <div className="flex items-start justify-between gap-3">
              <span>
                <span className="block text-sm font-medium">{way.title}</span>
                <span className="block text-xs text-white/70">{way.detail}</span>
              </span>
              <CardToggle checked={on} onChange={(next) => setModes((current) => ({ ...current, [way.mode]: next }))} label={way.title} />
            </div>
            {way.mode === 'AI_ASSISTANT' && on ? (
              <div className="mt-3 flex flex-col gap-3 border-t border-white/15 pt-3">
                <div className="flex flex-wrap gap-1.5">
                  {PANELS.map((panel) => {
                    const active = panels.includes(panel.id)
                    return (
                      <button
                        key={panel.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setPanels((current) => (active ? current.filter((id) => id !== panel.id) : [...current, panel.id]))}
                        className={cn(CARD_CHIP, 'px-3 py-1 text-xs')}
                      >
                        {panel.label}
                      </button>
                    )
                  })}
                </div>
                {panels.includes('WIZARD') ? (
                  <p className="text-xs text-white/70">
                    The tour is {offer.tour.status === 'published' ? 'live' : 'a draft'} ({offer.tour.steps} steps).{' '}
                    <Link href={`/services/wizard?product=${offer.id}`} className="underline underline-offset-2">Edit it in Services → Tour</Link>
                  </p>
                ) : null}
                <label className="flex flex-col gap-1.5 text-xs text-white/75">
                  Who answers
                  <select className={CARD_SELECT} value={agentId} onChange={(e) => setAgentId(e.target.value)}>
                    <option value="">Your Services assistants (recommended)</option>
                    {offer.agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>{agent.name} (just for this one)</option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}
          </div>
        )
      })}
      {error ? <p className="text-xs text-rose-200">{error}</p> : null}
    </Frame>
  )
}

function DoneStep({ frame, offer, onChanged, onDeleted }: { frame: FrameProps; offer: OfferSettingsView; onChanged: () => void; onDeleted: () => void }) {
  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, startBusy] = useTransition()
  // One link per project: a webinar's Live link, a product's Share (or pay) link.
  const link = offer.shareLinks[0] ?? null

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error("Couldn't copy. Select the link and copy it instead.")
    }
  }

  return (
    <Frame
      {...frame}
      line={link ? `Share this ${offer.kind === 'WEBINAR' ? 'live ' : ''}link. Buyers' chats and calls show up in Messages.` : 'Turn on a way to buy to get a link.'}
      footer={
        <>
          {confirmDelete ? (
            <span className="flex items-center gap-3">
              Delete for good?
              <button
                type="button"
                disabled={busy}
                className="text-rose-200 underline-offset-2 hover:underline"
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
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className={CARD_GHOST}>Keep it</button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className="text-sm text-rose-200/90 transition-colors hover:text-rose-100">
              Delete
            </button>
          )}
          <button type="button" onClick={frame.onClose} className={CARD_PRIMARY}>
            Done <Check className="h-4 w-4" />
          </button>
        </>
      }
    >
      {link ? (
        <div className={cn(CARD_BOX, 'flex flex-col gap-3')}>
          <p className="break-all font-mono text-xs text-white/90">{link.url}</p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void copy(link.url)} className={CARD_PRIMARY}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy link'}
            </button>
            <a href={link.url} target="_blank" rel="noopener noreferrer" className={CARD_GHOST}>Open</a>
          </div>
        </div>
      ) : null}

      {offer.hasBusiness ? (
        <div className={cn(CARD_BOX, 'flex items-center justify-between gap-3')}>
          <span>
            <span className="block text-sm font-medium">Show on my Menu</span>
            <span className="block text-xs text-white/70">Your Menu, website and AI can recommend it.</span>
          </span>
          <CardToggle
            checked={offer.onBusiness}
            disabled={busy}
            label="Show on my Menu"
            onChange={(enabled) =>
              startBusy(async () => {
                const result = await setOfferOnBusiness({ id: offer.id, enabled })
                if (!result.ok) return void toast.error(result.error)
                onChanged()
              })
            }
          />
        </div>
      ) : null}

      <div className={cn(CARD_BOX, 'flex flex-wrap items-center justify-between gap-2 text-sm')}>
        <span>
          {offer.orderSummary.paidCount} paid · {usd(offer.orderSummary.collectedCents)} collected
          {offer.orderSummary.balanceDueCents ? ` · ${usd(offer.orderSummary.balanceDueCents)} still due` : ''}
        </span>
        <button
          type="button"
          onClick={() => {
            frame.onClose()
            openMessages()
          }}
          className="underline underline-offset-2"
        >
          Conversations
        </button>
      </div>
    </Frame>
  )
}
