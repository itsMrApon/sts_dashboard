'use client'

import React, { useState } from 'react'
import { Loader2, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { captureLead } from '@/actions/buyer'
import type { BuyerContactView } from '@/lib/offers/publicOfferTypes'

export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4a.5.5 0 0 0 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7a2.8 2.8 0 0 0 1.8-1.3 2.3 2.3 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3Z" />
    </svg>
  )
}

type Props = {
  slug: string
  source: string | null
  submitLabel?: string
  /** Runs after the lead is saved; the form stays busy until it settles. */
  onCaptured: (contact: BuyerContactView) => void | Promise<void>
}

/** Email or WhatsApp (no code, nothing strict) plus an optional name. */
export function LeadForm({ slug, source, submitLabel = 'Continue', onCaptured }: Props) {
  const [method, setMethod] = useState<'email' | 'whatsapp'>('email')
  const [value, setValue] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    try {
      const result = await captureLead({ slug, method, value, name, source })
      if (!result.ok) return void toast.error(result.error)
      await onCaptured(result.contact)
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
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
          void submit()
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
        <Button type="submit" className="w-full" disabled={busy || !value.trim()}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {submitLabel}
        </Button>
      </form>
    </div>
  )
}
