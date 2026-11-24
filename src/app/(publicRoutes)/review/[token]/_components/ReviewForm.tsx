'use client'

import { useState, useTransition } from 'react'
import { Star } from 'lucide-react'
import { submitCustomerReview } from '@/actions/reviews'
import { track } from '@/lib/analytics/track'
import { cn } from '@/lib/utils'

type Props = { token: string; businessName: string; projectTitle: string | null; defaultName: string }

export function ReviewForm({ token, businessName, projectTitle, defaultName }: Props) {
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [text, setText] = useState('')
  const [name, setName] = useState(defaultName)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pending, startTransition] = useTransition()

  if (done) {
    return (
      <div className="space-y-2 text-center">
        <h1 className="text-lg font-semibold">Thank you!</h1>
        <p className="text-sm text-zinc-400">Your review was sent to {businessName}.</p>
      </div>
    )
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault()
        if (!rating) {
          setError('Choose 1 to 5 stars.')
          return
        }
        setError(null)
        startTransition(async () => {
          const result = await submitCustomerReview({ token, rating, text, name })
          if (result.ok) {
            setDone(true)
            track('review_submitted', { rating })
          }
          else setError(result.error)
        })
      }}
    >
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">How was {projectTitle ?? businessName}?</h1>
        <p className="text-sm text-zinc-400">Your review helps {businessName} and other customers.</p>
      </div>

      <div role="radiogroup" aria-label="Your rating" className="flex gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={rating === value}
            aria-label={`${value} ${value === 1 ? 'star' : 'stars'}`}
            onClick={() => setRating(value)}
            onMouseEnter={() => setHover(value)}
            className="rounded-md p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            <Star className={cn('h-8 w-8 transition-colors', value <= (hover || rating) ? 'fill-amber-400 text-amber-400' : 'text-zinc-600')} />
          </button>
        ))}
      </div>

      <label className="block space-y-1.5 text-sm">
        <span className="text-zinc-300">Your review</span>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={4}
          maxLength={1500}
          placeholder="What did you like? What could be better?"
          className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-zinc-50 placeholder:text-zinc-500 focus:border-white/30 focus:outline-none"
        />
      </label>

      <label className="block space-y-1.5 text-sm">
        <span className="text-zinc-300">Your name</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={100}
          placeholder="Shown as your first name only"
          className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm text-zinc-50 placeholder:text-zinc-500 focus:border-white/30 focus:outline-none"
        />
      </label>

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      <button type="submit" disabled={pending} className="w-full rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black hover:opacity-90 disabled:opacity-50">
        {pending ? 'Sending…' : 'Send review'}
      </button>
    </form>
  )
}
