'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, Loader2, MessageCircle } from 'lucide-react'
import { submitHostedForm } from '@/actions/publicServices'
import { SORTED_ISO2, dialForIso2 } from '@/lib/phoneCountryCodes'
import { FORM_HONEYPOT_FIELD, accentHex, type FormField, type FormServiceConfig } from '@/lib/services/types'
import { cn } from '@/lib/utils'
import { ServiceCard } from '../../../_components/PublicServiceShell'

type Props = {
  roomName: string
  config: FormServiceConfig
  /** Country preselected for phone fields (e.g. BD for Bangla businesses). */
  defaultCountry: string
  /** The business's chat page, when Chat AI is on ("Chat with us" after sending). */
  chatHref?: string
}

/** Long text and dropdowns always take the full row in the two-column layout. */
const isWide = (field: FormField) => field.type === 'textarea' || field.type === 'select'

const FIELD_CLASS =
  'w-full rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm text-zinc-50 placeholder:text-zinc-500 focus:border-white/30 focus:outline-none'

function inputType(field: FormField): string {
  if (field.type === 'email') return 'email'
  if (field.type === 'phone') return 'tel'
  return 'text'
}

/** Form service: the creator's form fields, consent and success message. */
export function FormRoom({ roomName, config, defaultCountry, chatHref }: Props) {
  const accent = accentHex(config.accent)
  const [values, setValues] = useState<Record<string, string>>({})
  const [trap, setTrap] = useState('')
  const [countries, setCountries] = useState<Record<string, string>>({})
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState<{ message: string; fieldId?: string } | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const setValue = (id: string, value: string) => {
    setValues((current) => ({ ...current, [id]: value }))
    if (error?.fieldId === id) setError(null)
  }

  const submit = () => {
    setError(null)
    // Phone fields are sent with their country code; other values as typed (Bangla kept as-is).
    const payload: Record<string, string> = {}
    for (const field of config.fields) {
      const raw = values[field.id]?.trim() ?? ''
      if (!raw) continue
      payload[field.id] =
        field.type === 'phone' && !raw.startsWith('+')
          ? `${dialForIso2(countries[field.id] ?? defaultCountry)} ${raw}`
          : raw
    }
    // Spam trap: only bots fill the hidden field; the server drops those quietly.
    if (config.spamProtection && trap) payload[FORM_HONEYPOT_FIELD] = trap
    startTransition(async () => {
      const result = await submitHostedForm({ roomName, values: payload, consent })
      if (!result.ok) {
        setError({ message: result.error, fieldId: result.fieldId })
        return
      }
      if (config.redirectUrl) {
        window.location.assign(config.redirectUrl)
        return
      }
      setDone(result.message)
    })
  }

  if (done) {
    return (
      <ServiceCard className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <CheckCircle2 className="h-12 w-12" style={{ color: accent }} aria-hidden />
        <p className="text-lg font-semibold">{done}</p>
        {config.showChatLink && chatHref ? (
          <a
            href={chatHref}
            className="mt-1 flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            style={{ backgroundColor: accent }}
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            Chat with us
          </a>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setDone(null)
            setValues({})
            setConsent(false)
          }}
          className="mt-2 text-xs text-zinc-400 underline underline-offset-2 hover:text-white"
        >
          Send another
        </button>
      </ServiceCard>
    )
  }

  const needsConsent = Boolean(config.consentText)
  // Full-row items in the two-column layout (spanning in a one-column grid would add a column).
  const wide = config.layout === 'double' ? 'sm:col-span-2' : undefined

  return (
    <ServiceCard className="px-5 py-6 sm:px-7 sm:py-8">
      <h1 className="text-xl font-semibold tracking-tight">{config.title}</h1>
      {config.description ? <p className="mt-1.5 text-sm text-zinc-400">{config.description}</p> : null}

      <form
        className={cn('mt-6 grid gap-4', config.layout === 'double' && 'sm:grid-cols-2')}
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        {config.fields.map((field) => {
          const invalid = error?.fieldId === field.id
          const common = {
            id: `field-${field.id}`,
            required: field.required,
            'aria-invalid': invalid || undefined,
            'aria-describedby': field.helpText ? `help-${field.id}` : undefined,
            value: values[field.id] ?? '',
          }
          return (
            <div key={field.id} className={cn('space-y-1.5', isWide(field) && wide)}>
              <label htmlFor={common.id} className="text-sm font-medium">
                {field.label}
                {field.required ? <span className="text-rose-400"> *</span> : null}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  {...common}
                  rows={4}
                  placeholder={field.placeholder}
                  onChange={(event) => setValue(field.id, event.target.value)}
                  className={cn(FIELD_CLASS, 'resize-y', invalid && 'border-rose-400')}
                />
              ) : field.type === 'select' ? (
                <select
                  {...common}
                  onChange={(event) => setValue(field.id, event.target.value)}
                  className={cn(FIELD_CLASS, 'appearance-none', invalid && 'border-rose-400')}
                >
                  <option value="">{field.placeholder || 'Choose…'}</option>
                  {field.options.map((option) => (
                    <option key={option} value={option} className="bg-zinc-900">
                      {option}
                    </option>
                  ))}
                </select>
              ) : field.type === 'phone' ? (
                <div className="flex gap-2">
                  <select
                    aria-label={`${field.label} country code`}
                    value={countries[field.id] ?? defaultCountry}
                    onChange={(event) => setCountries((current) => ({ ...current, [field.id]: event.target.value }))}
                    className={cn(FIELD_CLASS, 'w-28 shrink-0 appearance-none px-2.5')}
                  >
                    {SORTED_ISO2.map((iso) => (
                      <option key={iso} value={iso} className="bg-zinc-900">
                        {iso} {dialForIso2(iso)}
                      </option>
                    ))}
                  </select>
                  <input
                    {...common}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    placeholder={field.placeholder}
                    onChange={(event) => setValue(field.id, event.target.value)}
                    className={cn(FIELD_CLASS, invalid && 'border-rose-400')}
                  />
                </div>
              ) : (
                <input
                  {...common}
                  type={inputType(field)}
                  autoComplete={field.type === 'email' ? 'email' : undefined}
                  placeholder={field.placeholder}
                  onChange={(event) => setValue(field.id, event.target.value)}
                  className={cn(FIELD_CLASS, invalid && 'border-rose-400')}
                />
              )}
              {field.helpText ? (
                <p id={`help-${field.id}`} className="text-xs text-zinc-500">
                  {field.helpText}
                </p>
              ) : null}
            </div>
          )
        })}

        {config.spamProtection ? (
          // Hidden from people and screen readers; bots that fill every input trip it.
          <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
            <label>
              Leave this empty
              <input
                tabIndex={-1}
                autoComplete="off"
                name={FORM_HONEYPOT_FIELD}
                value={trap}
                onChange={(event) => setTrap(event.target.value)}
              />
            </label>
          </div>
        ) : null}

        {needsConsent ? (
          <label className={cn('flex items-start gap-3 text-sm text-zinc-300', wide)}>
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0"
              style={{ accentColor: accent }}
            />
            <span>{config.consentText}</span>
          </label>
        ) : null}

        {error ? (
          <p role="alert" className={cn('text-sm text-rose-400', wide)}>
            {error.message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending || (needsConsent && !consent)}
          className={cn(
            'flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-medium text-white hover:opacity-90 disabled:opacity-50',
            wide,
          )}
          style={{ backgroundColor: accent }}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {config.submitLabel}
        </button>
      </form>
    </ServiceCard>
  )
}
