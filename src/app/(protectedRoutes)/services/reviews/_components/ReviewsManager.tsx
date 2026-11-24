'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Check, Copy, EyeOff, Link2, Star, Trash2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { createReviewLink, deleteReviewRequest, saveReviewSettings, setReviewStatus } from '@/actions/reviews'
import type { ReviewView } from '@/lib/reviews/reviews'
import { guardAction } from '@/lib/clientActionErrors'
import { cn } from '@/lib/utils'

type Props = {
  reviews: ReviewView[]
  settings: { autoRequest: boolean; delayDays: number }
  baseUrl: string
}

const STATUS_LABEL: Record<ReviewView['status'], string> = {
  REQUESTED: 'Waiting for the customer',
  SUBMITTED: 'New: not on your website yet',
  APPROVED: 'On your website',
  HIDDEN: 'Hidden',
}

function Stars({ rating }: { rating: number | null }) {
  if (!rating) return null
  return (
    <span className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star key={value} className={cn('h-4 w-4', value <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40')} aria-hidden />
      ))}
    </span>
  )
}

export function ReviewsManager({ reviews, settings, baseUrl }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [autoRequest, setAutoRequest] = useState(settings.autoRequest)
  const [delayDays, setDelayDays] = useState(String(settings.delayDays))
  const [customerName, setCustomerName] = useState('')
  const [newLink, setNewLink] = useState<string | null>(null)

  const link = (token: string) => `${baseUrl.replace(/\/+$/, '')}/review/${token}`
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Link copied')
    } catch {
      toast.error('Copy did not work. Select the link and copy it.')
    }
  }

  const run = (action: () => ReturnType<typeof setReviewStatus>, fallback: string, after?: (token?: string) => void) =>
    startTransition(
      guardAction(async () => {
        const result = await action()
        if (result.ok) {
          toast.success(result.message ?? fallback)
          after?.(result.token)
          router.refresh()
        } else toast.error(result.error)
      }),
    )

  const fresh = reviews.filter((review) => review.status === 'SUBMITTED')
  const rest = reviews.filter((review) => review.status !== 'SUBMITTED')

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-3">
        <p className="text-sm text-muted-foreground">
          {fresh.length > 0
            ? `${fresh.length} new ${fresh.length === 1 ? 'review' : 'reviews'} to check. Only the ones you show appear on your website.`
            : 'Reviews customers write show here first. Only the ones you show appear on your website.'}
        </p>
        <ul className="space-y-3">
          {[...fresh, ...rest].map((review) => (
            <li key={review.id} className={cn('space-y-2 rounded-xl border bg-card p-4', review.status === 'HIDDEN' && 'opacity-60')}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{review.customerName || 'A customer'}</p>
                  <p className="text-xs text-muted-foreground">
                    {review.projectTitle ? `${review.projectTitle} · ` : ''}
                    {STATUS_LABEL[review.status]}
                  </p>
                </div>
                <Stars rating={review.rating} />
              </div>
              {review.text ? <p className="whitespace-pre-wrap text-sm">{review.text}</p> : null}
              <div className="flex flex-wrap gap-2 pt-1">
                {review.status === 'SUBMITTED' || review.status === 'HIDDEN' ? (
                  <Button size="sm" disabled={pending} onClick={() => run(() => setReviewStatus({ id: review.id, status: 'APPROVED' }), 'Shown on your website')}>
                    <Check className="mr-1.5 h-4 w-4" aria-hidden />
                    Show on website
                  </Button>
                ) : null}
                {review.status === 'SUBMITTED' || review.status === 'APPROVED' ? (
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setReviewStatus({ id: review.id, status: 'HIDDEN' }), 'Hidden')}>
                    <EyeOff className="mr-1.5 h-4 w-4" aria-hidden />
                    Hide
                  </Button>
                ) : null}
                {review.status === 'REQUESTED' ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => copy(link(review.token))}>
                      <Copy className="mr-1.5 h-4 w-4" aria-hidden />
                      Copy link
                    </Button>
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => deleteReviewRequest({ id: review.id }), 'Request removed')}>
                      <Trash2 className="mr-1.5 h-4 w-4" aria-hidden />
                      Remove
                    </Button>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <aside className="space-y-4">
        <section className="space-y-3 rounded-xl border bg-card p-4">
          <h2 className="font-medium">Ask a customer</h2>
          <p className="text-sm text-muted-foreground">Make a private link and send it yourself on WhatsApp, email or in person.</p>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              run(() => createReviewLink({ customerName }), 'Link ready', (token) => {
                if (token) setNewLink(link(token))
                setCustomerName('')
              })
            }}
          >
            <Input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Customer name (optional)" maxLength={100} />
            <Button type="submit" size="sm" disabled={pending}>
              <Link2 className="mr-1.5 h-4 w-4" aria-hidden />
              Make link
            </Button>
          </form>
          {newLink ? (
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1.5 font-mono text-xs">{newLink}</code>
              <Button size="sm" variant="outline" onClick={() => copy(newLink)} aria-label="Copy review link">
                <Copy className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          ) : null}
        </section>

        <section className="space-y-3 rounded-xl border bg-card p-4">
          <label className="flex items-center justify-between gap-3">
            <span>
              <span className="block font-medium">Ask buyers automatically</span>
              <span className="block text-sm text-muted-foreground">Emails a review link after an order is paid.</span>
            </span>
            <Switch checked={autoRequest} onCheckedChange={setAutoRequest} aria-label="Ask buyers automatically" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            Wait
            <Input
              type="number"
              min={0}
              max={30}
              value={delayDays}
              onChange={(event) => setDelayDays(event.target.value)}
              className="h-8 w-16"
              aria-label="Days to wait after payment"
            />
            days after payment
          </label>
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => saveReviewSettings({ autoRequest, delayDays: Number(delayDays) }), 'Saved')}>
            Save
          </Button>
          <p className="text-xs text-muted-foreground">Needs the buyer&apos;s email and your email connected in{' '}
            <a href="/integrations/email" className="underline">
              Integrations → Email
            </a>
            . Otherwise the link waits here for you to copy.</p>
        </section>
      </aside>
    </div>
  )
}
