'use client'

import { useCallback, useEffect, useRef, useState, useTransition, type ChangeEvent, type CSSProperties, type ReactNode } from 'react'
import { AlertCircle, ArrowRight, Check, CheckCircle2, ChevronDown, ChevronUp, Loader2, MessageCircle, Star } from 'lucide-react'
import { guardAction } from '@/lib/clientActionErrors'
import { SORTED_ISO2, dialForIso2 } from '@/lib/phoneCountryCodes'
import {
  FORM_HONEYPOT_FIELD,
  accentHex,
  hasAnswer,
  validateFieldAnswer,
  type FormAnswer,
  type FormAnswers,
  type FormField,
  type FormServiceConfig,
  type FormTheme,
} from '@/lib/services/types'
import { cn } from '@/lib/utils'

export type FormFlowSubmitResult = { ok: true; message: string } | { ok: false; error: string; fieldId?: string }

type Props = {
  config: FormServiceConfig
  /** Country preselected for phone questions (e.g. BD for Bangla businesses). */
  defaultCountry: string
  onSubmit: (answers: FormAnswers, consent: boolean) => Promise<FormFlowSubmitResult>
  /** `page` fills the screen (hosted form); `embedded` fits a fixed-height box (dashboard preview). */
  frame: 'page' | 'embedded'
  /** Top-left corner, e.g. the business name. */
  corner?: ReactNode
  /** The business's chat page, when Chat AI is on ("Chat with us" after sending). */
  chatHref?: string
  /** The dashboard preview never leaves the page; it says where visitors would go instead. */
  followRedirect?: boolean
}

const LETTERS = 'ABCDEFGHIJKL'
/** Single-answer questions move on by themselves shortly after a pick (like Typeform). */
const AUTO_ADVANCE_MS = 350

const TONE: Record<FormTheme, { root: string; muted: string; line: string; choice: string; control: string }> = {
  light: {
    root: 'bg-[#fafafa] text-zinc-900 [color-scheme:light]',
    muted: 'text-zinc-500',
    line: 'border-zinc-300 placeholder:text-zinc-400',
    choice: 'border-zinc-300 bg-white hover:bg-zinc-50',
    control: 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100',
  },
  dark: {
    root: 'bg-[#0b0b10] text-zinc-50 [color-scheme:dark]',
    muted: 'text-zinc-400',
    line: 'border-white/25 placeholder:text-zinc-500',
    choice: 'border-white/15 bg-white/[0.04] hover:bg-white/[0.08]',
    control: 'border-white/15 bg-white/[0.04] text-zinc-200 hover:bg-white/10',
  },
}

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')

/** One question per screen with a progress bar, keyboard shortcuts and per-question checks. */
export function FormFlow({ config, defaultCountry, onSubmit, frame, corner, chatHref, followRedirect = true }: Props) {
  const accent = accentHex(config.accent)
  const tone = TONE[config.theme]
  const fields = config.fields
  const lastIndex = fields.length - 1

  const [rawStep, setStep] = useState(0)
  const [direction, setDirection] = useState<1 | -1>(1)
  const [answers, setAnswers] = useState<FormAnswers>({})
  const [countries, setCountries] = useState<Record<string, string>>({})
  const [consent, setConsent] = useState(false)
  const [trap, setTrap] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // The dashboard can delete questions while the preview is on a later one.
  const step = Math.min(rawStep, lastIndex)
  const field = fields[step]
  const isLast = step === lastIndex
  const needsConsent = Boolean(config.consentText)
  const progress = fields.length ? fields.filter((item) => hasAnswer(answers[item.id])).length / fields.length : 0

  const stepRef = useRef<HTMLDivElement>(null)
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const interacted = useRef(false)

  useEffect(() => () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current)
  }, [])

  // Focus the new question's input. The hosted page also focuses question 1 on desktop;
  // the dashboard preview waits for a click so it never steals focus from the editor.
  useEffect(() => {
    const desktopPage = frame === 'page' && window.matchMedia('(pointer: fine)').matches
    if (!interacted.current && !desktopPage) return
    stepRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true })
  }, [step, frame])

  const goTo = useCallback(
    (index: number) => {
      if (index < 0 || index > lastIndex) return
      interacted.current = true
      setDirection(index > step ? 1 : -1)
      setError(null)
      setStep(index)
    },
    [lastIndex, step],
  )

  const submit = () => {
    if (needsConsent && !consent) {
      setError('Please tick the box to continue')
      return
    }
    // Phone numbers go out with their country code; everything else as typed (Bangla kept as-is).
    const payload: FormAnswers = {}
    for (const item of fields) {
      const answer = answers[item.id]
      if (!hasAnswer(answer)) continue
      payload[item.id] =
        item.type === 'phone' && typeof answer === 'string' && !answer.trim().startsWith('+')
          ? `${dialForIso2(countries[item.id] ?? defaultCountry)} ${answer.trim()}`
          : answer!
    }
    // Spam trap: only bots fill the hidden field; the server drops those quietly.
    if (config.spamProtection && trap) payload[FORM_HONEYPOT_FIELD] = trap
    startTransition(
      guardAction(async () => {
        const result = await onSubmit(payload, consent)
        if (!result.ok) {
          const index = result.fieldId ? fields.findIndex((item) => item.id === result.fieldId) : -1
          if (index >= 0 && index !== step) goTo(index)
          setError(result.error)
          return
        }
        if (config.redirectUrl && followRedirect) {
          window.location.assign(config.redirectUrl)
          return
        }
        setDone(config.redirectUrl ? `${result.message} (Visitors are sent to ${config.redirectUrl}.)` : result.message)
      }),
    )
  }

  const next = (answerOverride?: FormAnswer) => {
    if (!field || pending) return
    interacted.current = true
    const checked = validateFieldAnswer(field, answerOverride ?? answers[field.id])
    if (!checked.ok) {
      setError(checked.error)
      return
    }
    if (isLast) submit()
    else goTo(step + 1)
  }

  const answer = (value: FormAnswer, advance = false) => {
    if (!field) return
    interacted.current = true
    setAnswers((current) => ({ ...current, [field.id]: value }))
    setError(null)
    if (advanceTimer.current) clearTimeout(advanceTimer.current)
    if (advance && !isLast) advanceTimer.current = setTimeout(() => next(value), AUTO_ADVANCE_MS)
  }

  const reset = () => {
    setDone(null)
    setAnswers({})
    setConsent(false)
    setError(null)
    setDirection(-1)
    setStep(0)
  }

  // Letter keys pick choices (A, B, C… / Y, N) and Enter moves on, when the visitor isn't typing in a box.
  const onKeyDown = (event: globalThis.KeyboardEvent) => {
    if (!field || done || event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return
    const key = event.key.toUpperCase()
    if (field.type === 'select') {
      const option = field.options[LETTERS.indexOf(key)]
      if (key.length === 1 && option) {
        event.preventDefault()
        toggleChoice(option)
      }
    } else if (field.type === 'yesno' && (key === 'Y' || key === 'N')) {
      event.preventDefault()
      answer(key === 'Y' ? 'Yes' : 'No', true)
    }
    // Enter confirms, even on a focused answer card (its native click would toggle it instead).
    // Other buttons (OK, arrows, links) keep their own Enter behaviour.
    if (event.key === 'Enter') {
      const target = event.target
      if (target instanceof HTMLButtonElement && !target.dataset.choice) return
      event.preventDefault()
      next()
    }
  }

  function toggleChoice(option: string) {
    if (!field) return
    if (!field.multiple) {
      answer(option, true)
      return
    }
    const current = Array.isArray(answers[field.id]) ? (answers[field.id] as string[]) : []
    answer(current.includes(option) ? current.filter((item) => item !== option) : [...current, option])
  }

  // Keys work anywhere on the hosted page (focus is often on <body>); the dashboard preview
  // only reacts while focus is inside it, so typing in the editor never answers questions.
  const rootRef = useRef<HTMLDivElement>(null)
  const keyHandler = useRef(onKeyDown)
  keyHandler.current = onKeyDown
  useEffect(() => {
    const listener = (event: globalThis.KeyboardEvent) => {
      if (frame === 'embedded' && !rootRef.current?.contains(document.activeElement)) return
      keyHandler.current(event)
    }
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [frame])

  const accentStyle = { '--form-accent': accent } as CSSProperties
  // The public layout centres pages in a container, so the hosted form pins itself to the viewport.
  const frameClass = frame === 'page' ? 'fixed inset-0' : 'h-full min-h-[540px]'

  if (done) {
    return (
      <div className={cn('relative flex flex-col', frameClass, tone.root)} style={accentStyle}>
        {corner ? <div className="px-6 pt-5">{corner}</div> : null}
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center animate-in fade-in zoom-in-95 duration-300">
          <CheckCircle2 className="h-14 w-14" style={{ color: accent }} aria-hidden />
          <p className="max-w-md text-xl font-medium sm:text-2xl">{done}</p>
          {config.showChatLink && chatHref ? (
            <a
              href={chatHref}
              className="mt-2 flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
              style={{ backgroundColor: accent }}
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              Chat with us
            </a>
          ) : null}
          <button type="button" onClick={reset} className={cn('mt-2 text-sm underline underline-offset-4', tone.muted)}>
            Send another response
          </button>
        </div>
      </div>
    )
  }

  if (!field) return null

  return (
    <div ref={rootRef} className={cn('relative flex flex-col overflow-hidden', frameClass, tone.root)} style={accentStyle}>
      <div
        className={cn('absolute inset-x-0 top-0 h-1', config.theme === 'light' ? 'bg-zinc-200' : 'bg-white/10')}
        role="progressbar"
        aria-label="Form progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <div className="h-full transition-[width] duration-500" style={{ width: `${progress * 100}%`, backgroundColor: accent }} />
      </div>

      {corner ? <div className="px-6 pt-5">{corner}</div> : null}

      <form
        noValidate
        className="flex flex-1 items-center overflow-y-auto px-6 py-10"
        onSubmit={(event) => {
          event.preventDefault()
          next()
        }}
      >
        <div
          key={field.id}
          ref={stepRef}
          className={cn(
            'mx-auto w-full max-w-2xl animate-in fade-in duration-300',
            direction === 1 ? 'slide-in-from-bottom-8' : 'slide-in-from-top-8',
          )}
        >
          {step === 0 && (config.title || config.description) ? (
            <div className="mb-10">
              <p className="text-lg font-semibold sm:text-xl">{config.title}</p>
              {config.description ? <p className={cn('mt-1 text-base', tone.muted)}>{config.description}</p> : null}
            </div>
          ) : null}

          <div className="flex items-start gap-3">
            {/* Same height as the question's first line, so the number lines up with it. */}
            <span className="flex h-7 shrink-0 items-center gap-1 text-sm font-medium sm:h-8" style={{ color: accent }}>
              {step + 1}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <label htmlFor={`q-${field.id}`} className="block text-xl leading-snug font-medium sm:text-2xl">
                {field.label}
                {field.required ? <span aria-hidden> *</span> : null}
              </label>
              {field.helpText ? <p className={cn('mt-1.5 text-base', tone.muted)}>{field.helpText}</p> : null}

              <div className="mt-7">
                <QuestionInput
                  field={field}
                  value={answers[field.id]}
                  country={countries[field.id] ?? defaultCountry}
                  onCountry={(iso) => setCountries((current) => ({ ...current, [field.id]: iso }))}
                  onAnswer={answer}
                  onToggleChoice={toggleChoice}
                  onEnter={() => next()}
                  accent={accent}
                  tone={tone}
                  invalid={Boolean(error)}
                />
              </div>

              {error ? (
                <p role="alert" className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-rose-500/10 px-2.5 py-1.5 text-sm text-rose-500">
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
                  {error}
                </p>
              ) : null}

              {isLast && needsConsent ? (
                <label className={cn('mt-7 flex max-w-lg items-start gap-3 text-sm', tone.muted)}>
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(event) => {
                      setConsent(event.target.checked)
                      setError(null)
                    }}
                    className="mt-0.5 h-4 w-4 shrink-0"
                    style={{ accentColor: accent }}
                  />
                  <span>{config.consentText}</span>
                </label>
              ) : null}

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

              <div className="mt-7 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={pending}
                  className="flex h-11 items-center gap-2 rounded-lg px-5 text-base font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: accent }}
                >
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  {isLast ? config.submitLabel : 'OK'}
                  {!isLast ? <Check className="h-4 w-4" aria-hidden /> : null}
                </button>
                <span className={cn('hidden text-xs sm:inline', tone.muted)}>
                  press <strong>Enter ↵</strong>
                </span>
              </div>
            </div>
          </div>
        </div>
      </form>

      <div className="flex items-center justify-between gap-3 px-6 pb-5">
        <span className={cn('text-[11px]', tone.muted)}>Powered by STS AI</span>
        <div className="flex overflow-hidden rounded-lg shadow-sm">
          <button
            type="button"
            onClick={() => goTo(step - 1)}
            disabled={step === 0}
            aria-label="Previous question"
            className={cn('flex h-9 w-9 items-center justify-center border disabled:opacity-40', tone.control)}
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => next()}
            disabled={isLast || pending}
            aria-label="Next question"
            className={cn('-ml-px flex h-9 w-9 items-center justify-center border disabled:opacity-40', tone.control)}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

type Tone = (typeof TONE)[FormTheme]

function QuestionInput({
  field,
  value,
  country,
  onCountry,
  onAnswer,
  onToggleChoice,
  onEnter,
  accent,
  tone,
  invalid,
}: {
  field: FormField
  value: FormAnswer | undefined
  country: string
  onCountry: (iso: string) => void
  onAnswer: (value: FormAnswer, advance?: boolean) => void
  onToggleChoice: (option: string) => void
  onEnter: () => void
  accent: string
  tone: Tone
  invalid: boolean
}) {
  const text = typeof value === 'string' ? value : ''
  const lineBase = cn(
    'w-full border-0 border-b-2 bg-transparent pb-2 text-xl outline-none transition-colors focus:border-[var(--form-accent)] sm:text-2xl',
    tone.line,
  )
  const line = cn(lineBase, invalid && 'border-rose-500')
  const common = {
    id: `q-${field.id}`,
    'data-autofocus': true,
    'aria-invalid': invalid || undefined,
    value: text,
    placeholder: field.placeholder || 'Type your answer here…',
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onAnswer(event.target.value),
  }

  switch (field.type) {
    case 'textarea':
      return (
        <div>
          <textarea
            {...common}
            rows={1}
            onKeyDown={(event) => {
              // Enter moves on, Shift+Enter adds a line (Typeform behaviour).
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                onEnter()
              }
            }}
            onInput={(event) => {
              const box = event.currentTarget
              box.style.height = 'auto'
              box.style.height = `${Math.min(box.scrollHeight, 240)}px`
            }}
            className={cn(line, 'resize-none')}
          />
          <p className={cn('mt-2 hidden text-xs sm:block', tone.muted)}>
            <strong>Shift ⇧ + Enter ↵</strong> to make a line break
          </p>
        </div>
      )

    case 'phone':
      return (
        <div className="flex items-end gap-3">
          <select
            aria-label={`${field.label} country code`}
            value={country}
            onChange={(event) => onCountry(event.target.value)}
            className={cn(lineBase, 'w-28 shrink-0 cursor-pointer text-lg sm:text-xl')}
          >
            {SORTED_ISO2.map((iso) => (
              <option key={iso} value={iso}>
                {iso} {dialForIso2(iso)}
              </option>
            ))}
          </select>
          <input {...common} type="tel" inputMode="tel" autoComplete="tel-national" placeholder={field.placeholder || 'Phone number'} className={line} />
        </div>
      )

    case 'select': {
      const picked = Array.isArray(value) ? value : text ? [text] : []
      return (
        <div role={field.multiple ? 'group' : 'radiogroup'} aria-labelledby={`q-${field.id}`} className="max-w-md space-y-2">
          {field.multiple ? <p className={cn('mb-3 text-sm', tone.muted)}>Choose as many as you like</p> : null}
          {field.options.map((option, index) => {
            const selected = picked.includes(option)
            return (
              <button
                key={option}
                type="button"
                role={field.multiple ? 'checkbox' : 'radio'}
                aria-checked={selected}
                data-choice
                data-autofocus={index === 0 || undefined}
                onClick={() => onToggleChoice(option)}
                className={cn('flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-base transition-colors', tone.choice)}
                style={selected ? { borderColor: accent, backgroundColor: `${accent}1f` } : undefined}
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded border text-xs font-semibold"
                  style={selected ? { borderColor: accent, backgroundColor: accent, color: '#fff' } : { borderColor: `${accent}80`, color: accent }}
                >
                  {LETTERS[index]}
                </span>
                <span className="flex-1">{option}</span>
                {selected ? <Check className="h-4 w-4" style={{ color: accent }} aria-hidden /> : null}
              </button>
            )
          })}
        </div>
      )
    }

    case 'yesno':
      return (
        <div role="radiogroup" aria-labelledby={`q-${field.id}`} className="flex max-w-md gap-3">
          {(['Yes', 'No'] as const).map((option, index) => {
            const selected = text === option
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={selected}
                data-choice
                data-autofocus={index === 0 || undefined}
                onClick={() => onAnswer(option, true)}
                className={cn('flex flex-1 items-center gap-3 rounded-lg border px-3 py-2.5 text-base transition-colors', tone.choice)}
                style={selected ? { borderColor: accent, backgroundColor: `${accent}1f` } : undefined}
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded border text-xs font-semibold"
                  style={selected ? { borderColor: accent, backgroundColor: accent, color: '#fff' } : { borderColor: `${accent}80`, color: accent }}
                >
                  {option[0]}
                </span>
                {option}
              </button>
            )
          })}
        </div>
      )

    case 'rating': {
      const score = text === '' ? null : Number(text)
      if (field.scale === 5) {
        return (
          <div role="radiogroup" aria-labelledby={`q-${field.id}`} className="flex gap-1 sm:gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={score === n}
                aria-label={`${n} out of 5`}
                data-choice
                data-autofocus={n === 1 || undefined}
                onClick={() => onAnswer(String(n), true)}
                className="rounded-md p-1 transition-transform hover:scale-110"
              >
                <Star
                  className={cn('h-9 w-9 sm:h-11 sm:w-11', score === null || n > score ? tone.muted : undefined)}
                  style={score !== null && n <= score ? { color: accent, fill: accent } : undefined}
                  strokeWidth={1.5}
                />
              </button>
            ))}
          </div>
        )
      }
      return (
        <div>
          <div role="radiogroup" aria-labelledby={`q-${field.id}`} className="grid grid-cols-6 gap-1.5 sm:grid-cols-11">
            {Array.from({ length: 11 }, (_, n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={score === n}
                data-choice
                data-autofocus={n === 0 || undefined}
                onClick={() => onAnswer(String(n), true)}
                className={cn('h-11 rounded-lg border text-base font-medium transition-colors', tone.choice)}
                style={score === n ? { borderColor: accent, backgroundColor: accent, color: '#fff' } : undefined}
              >
                {n}
              </button>
            ))}
          </div>
          <div className={cn('mt-2 flex justify-between text-xs', tone.muted)}>
            <span>Not likely</span>
            <span>Very likely</span>
          </div>
        </div>
      )
    }

    case 'date':
      return <input {...common} type="date" className={cn(line, 'max-w-xs')} />

    case 'number':
      return <input {...common} type="text" inputMode="decimal" placeholder={field.placeholder || 'Type a number…'} className={line} />

    case 'url':
      return <input {...common} type="url" inputMode="url" autoComplete="url" placeholder={field.placeholder || 'example.com'} className={line} />

    case 'email':
      return <input {...common} type="email" inputMode="email" autoComplete="email" placeholder={field.placeholder || 'name@example.com'} className={line} />

    default:
      return <input {...common} type="text" autoComplete={field.id === 'name' ? 'name' : undefined} className={line} />
  }
}
