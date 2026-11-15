'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, ArrowUp, Bot, Globe, Link2, PenLine, RotateCcw, Save, Sparkles } from 'lucide-react'
import { createAssistant, draftNewAssistant, researchAssistantLinks } from '@/actions/assistants'
import { AgentPlanning, type PlanStep } from '@/components/ui/agent-planning'
import { Button } from '@/components/ui/button'
import { ASSISTANT_SERVICES, ASSISTANT_SERVICE_META, type AssistantService } from '@/lib/agents/assistantServices'
import { describeActionError } from '@/lib/clientActionErrors'
import { TONES } from '@/lib/services/types'
import { cn } from '@/lib/utils'

type QuestionId = 'service' | 'links' | 'goals' | 'tone' | 'language'
type Option = { id: string; label: string }
type Question = {
  id: QuestionId
  ask: string
  options?: Option[]
  multi?: boolean
  /** Free text in the composer (links, or a note next to the options). */
  input?: { placeholder: string; optional: boolean }
}

const GOALS: Option[] = [
  { id: 'book', label: 'Book calls & appointments' },
  { id: 'sell', label: 'Sell products & services' },
  { id: 'answer', label: 'Answer questions' },
  { id: 'leads', label: 'Collect leads' },
]
const LANGUAGES: Option[] = [
  { id: 'en', label: 'English' },
  { id: 'bn', label: 'বাংলা (Bangla)' },
  { id: 'both', label: 'Both: reply in the visitor’s language' },
]
const LETTERS = 'ABCDEFGH'

type Answers = {
  service: AssistantService | null
  links: string[]
  goals: string[]
  goalNote: string
  tone: string
  language: 'en' | 'bn' | 'both'
}

type Turn = { from: 'ai' | 'you'; text: string }

function questionsFor(initialService: AssistantService | null, businessName: string): Question[] {
  const list: Question[] = [
    {
      id: 'service',
      ask: 'Which service is this assistant for?',
      options: ASSISTANT_SERVICES.map((service) => ({ id: service, label: ASSISTANT_SERVICE_META[service].label })),
    },
    {
      id: 'links',
      ask: `Share links about ${businessName}: your website, Facebook page or Instagram. I'll read them so the assistant knows your business.`,
      input: { placeholder: 'https://your-site.com  facebook.com/yourpage', optional: true },
    },
    {
      id: 'goals',
      ask: 'What should it do? Pick any that apply, and add your own if you like.',
      options: GOALS,
      multi: true,
      input: { placeholder: 'Anything else it should do or avoid… (optional)', optional: true },
    },
    { id: 'tone', ask: 'How should it sound?', options: TONES.map((tone) => ({ id: tone.id, label: `${tone.label}: ${tone.hint}` })) },
    { id: 'language', ask: 'Which language should it speak?', options: LANGUAGES },
  ]
  return initialService ? list.filter((question) => question.id !== 'service') : list
}

function seconds(ms: number) {
  return `${(ms / 1000).toFixed(1)}s`
}

/**
 * New assistant: a short chat (service, links, goals, tone, language), then an AI planning view
 * while it reads the links, writes the prompt and service settings, and saves the assistant.
 */
export function NewAssistantFlow({ initialService, businessName }: { initialService: AssistantService | null; businessName: string }) {
  const router = useRouter()
  const questions = useMemo(() => questionsFor(initialService, businessName), [initialService, businessName])
  const [step, setStep] = useState(0)
  // Greeting + first question up front (not in an effect: dev mode runs effects twice).
  const [turns, setTurns] = useState<Turn[]>(() => [
    {
      from: 'ai',
      text: initialService
        ? `Let's build your ${ASSISTANT_SERVICE_META[initialService].noun}. A few quick questions, then I'll write it for you.`
        : "Let's build a new assistant. A few quick questions, then I'll write it for you.",
    },
    ...(questions[0] ? [{ from: 'ai' as const, text: questions[0].ask }] : []),
  ])
  const [answers, setAnswers] = useState<Answers>({
    service: initialService,
    links: [],
    goals: [],
    goalNote: '',
    tone: 'friendly',
    language: 'en',
  })
  const [picked, setPicked] = useState<string[]>([])
  const [draftText, setDraftText] = useState('')
  const [phase, setPhase] = useState<'ask' | 'build'>('ask')
  const [plan, setPlan] = useState<PlanStep[]>([])
  const [created, setCreated] = useState<{ id: string; linked: boolean; name: string } | null>(null)
  const [failedAt, setFailedAt] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  // The question being answered. A double click or key press before React re-renders must not
  // answer the same question twice.
  const answeringRef = useRef(0)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const question = questions[step]
  const service = answers.service

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns, phase])
  useEffect(() => {
    if (question?.input) inputRef.current?.focus()
  }, [question])

  const optionLabel = (id: string) => question?.options?.find((option) => option.id === id)?.label ?? id

  /** Records the answer to the current question and asks the next one (or starts building). */
  const answer = (patch: Partial<Answers>, said: string) => {
    if (answeringRef.current !== step) return
    answeringRef.current = step + 1
    const next = { ...answers, ...patch }
    setAnswers(next)
    const nextQuestion = questions[step + 1]
    setTurns((current) => [
      ...current,
      { from: 'you', text: said },
      ...(nextQuestion ? [{ from: 'ai' as const, text: nextQuestion.ask }] : []),
    ])
    setPicked([])
    setDraftText('')
    if (nextQuestion) setStep(step + 1)
    else void build(next)
  }

  const submitCurrent = () => {
    if (!question) return
    const text = draftText.trim()
    if (question.id === 'links') {
      const links = text.split(/[\s,]+/).filter(Boolean).slice(0, 5)
      answer({ links }, links.length ? links.join('\n') : 'No links, use what you already know')
      return
    }
    if (question.id === 'goals') {
      if (!picked.length && !text) return
      const said = [picked.map((id) => optionLabel(id)).join(', '), text].filter(Boolean).join(' · ')
      answer({ goals: picked, goalNote: text }, said)
      return
    }
    if (picked[0]) choose(picked[0])
  }

  const choose = (id: string) => {
    if (!question) return
    if (question.multi) {
      setPicked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
      return
    }
    if (question.id === 'service') answer({ service: id as AssistantService }, optionLabel(id))
    else if (question.id === 'tone') answer({ tone: id }, optionLabel(id).split(':')[0])
    else if (question.id === 'language') answer({ language: id as Answers['language'] }, optionLabel(id))
  }

  // A, B, C… pick options while not typing.
  useEffect(() => {
    if (phase !== 'ask' || !question?.options) return
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (event.metaKey || event.ctrlKey || event.altKey || target?.tagName === 'TEXTAREA' || target?.tagName === 'INPUT') return
      const option = question.options?.[LETTERS.indexOf(event.key.toUpperCase())]
      if (event.key.length === 1 && option) {
        event.preventDefault()
        choose(option.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const setStepState = (id: string, patch: Partial<PlanStep>) =>
    setPlan((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)))

  async function build(final: Answers) {
    const target = final.service
    if (!target) return
    const meta = ASSISTANT_SERVICE_META[target]
    setPhase('build')
    setFailedAt(null)
    setCreated(null)
    setPlan([
      {
        id: 'answers',
        title: 'Read your answers',
        status: 'success',
        duration: '0.1s',
        icon: <PenLine className="h-3.5 w-3.5" />,
        content: (
          <div className="mt-2 grid grid-cols-[96px_1fr] gap-1.5 rounded-md border border-border/50 bg-secondary/30 p-2.5 font-mono text-[11px]">
            <span className="text-foreground/50">Service</span>
            <span>{meta.label}</span>
            <span className="text-foreground/50">Goals</span>
            <span>{[...final.goals.map((goal) => GOALS.find((item) => item.id === goal)?.label ?? goal), final.goalNote].filter(Boolean).join(' · ') || '—'}</span>
            <span className="text-foreground/50">Tone</span>
            <span>{TONES.find((tone) => tone.id === final.tone)?.label ?? final.tone}</span>
            <span className="text-foreground/50">Language</span>
            <span>{LANGUAGES.find((item) => item.id === final.language)?.label}</span>
            <span className="text-foreground/50">Links</span>
            <span className="break-all">{final.links.join(' ') || '—'}</span>
          </div>
        ),
      },
      { id: 'links', title: final.links.length ? 'Read your links' : 'Use your business details', status: 'pending', icon: <Globe className="h-3.5 w-3.5" /> },
      { id: 'draft', title: `Write the prompt and ${meta.label} settings`, status: 'pending', icon: <Sparkles className="h-3.5 w-3.5" /> },
      { id: 'save', title: 'Create the assistant', status: 'pending', icon: <Save className="h-3.5 w-3.5" /> },
    ])

    let failed = 'links'
    try {
      // 1) Links → facts (the scrape agent reads them server-side).
      let started = performance.now()
      setStepState('links', { status: 'active' })
      const research = final.links.length ? await researchAssistantLinks(final.links) : null
      if (research && !research.ok) throw new Error(research.error)
      const sources = research?.ok ? research.sources : []
      setStepState('links', {
        status: 'success',
        duration: seconds(performance.now() - started),
        defaultExpanded: sources.length > 0,
        content: (
          <ul className="mt-2 space-y-1.5 font-mono text-[11px]">
            {sources.length === 0 ? (
              <li className="text-muted-foreground">No links. Using your business details and services from Services → Business.</li>
            ) : (
              sources.map((source) => (
                <li key={source.url} className="rounded-md border border-border/50 bg-secondary/30 p-2">
                  <span className={cn('flex items-center gap-1.5 font-medium', source.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>
                    <Link2 className="h-3 w-3" />
                    {source.url}
                  </span>
                  <span className="mt-1 line-clamp-3 block text-muted-foreground">{source.ok ? source.summary : `Skipped: ${source.error}`}</span>
                </li>
              ))
            )}
          </ul>
        ),
      })

      // 2) The AI writes it.
      failed = 'draft'
      started = performance.now()
      setStepState('draft', { status: 'active' })
      const drafted = await draftNewAssistant({
        service: target,
        goals: final.goals,
        goalNote: final.goalNote,
        tone: final.tone,
        language: final.language,
        sources,
      })
      if (!drafted.ok) throw new Error(drafted.error)
      const { draft } = drafted
      setStepState('draft', {
        status: 'success',
        duration: seconds(performance.now() - started),
        defaultExpanded: true,
        content: (
          <div className="mt-2 space-y-2 text-[12px]">
            <p>
              <span className="text-muted-foreground">Name:</span> <span className="font-medium">{draft.name}</span>
            </p>
            {draft.firstMessage ? (
              <p className="rounded-lg bg-secondary/40 px-3 py-2">“{draft.firstMessage}”</p>
            ) : null}
            <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md border border-border/50 bg-zinc-950 p-3 font-mono text-[11px] text-zinc-300">
              {draft.systemPrompt}
            </pre>
          </div>
        ),
      })

      // 3) Save (and run the service if it had no assistant yet).
      failed = 'save'
      started = performance.now()
      setStepState('save', { status: 'active' })
      const saved = await createAssistant({
        name: draft.name,
        service: target,
        systemPrompt: draft.systemPrompt,
        firstMessage: draft.firstMessage,
        language: draft.language,
        behaviour: draft.behaviour,
        link: 'if-free',
      })
      if (!saved.ok) throw new Error(saved.error)
      setStepState('save', {
        status: 'success',
        duration: seconds(performance.now() - started),
        content: (
          <p className="mt-2 text-[12px] text-muted-foreground">
            {saved.linked
              ? `${draft.name} now runs ${meta.label}. Turn it on in Services → ${meta.label} when you're ready.`
              : `${meta.label} already has an assistant, so ${draft.name} is saved but not in use yet.`}
          </p>
        ),
      })
      setCreated({ id: saved.id, linked: saved.linked, name: draft.name })
      router.refresh()
    } catch (error) {
      setFailedAt(failed)
      const message = error instanceof Error && error.message ? error.message : describeActionError(error)
      setStepState(failed, {
        status: 'error',
        defaultExpanded: true,
        content: <p className="mt-2 rounded-md border border-rose-500/20 bg-rose-500/10 p-3 text-[12px] text-rose-600 dark:text-rose-400">{message}</p>,
      })
    }
  }

  const restart = () => {
    answeringRef.current = 0
    setPhase('ask')
    setStep(0)
    setPlan([])
    setCreated(null)
    setFailedAt(null)
    setAnswers({ service: initialService, links: [], goals: [], goalNote: '', tone: 'friendly', language: 'en' })
    setTurns([{ from: 'ai', text: questions[0]?.ask ?? '' }])
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-lg font-semibold">New {service ? ASSISTANT_SERVICE_META[service].noun : 'assistant'}</h1>
          <p className="text-xs text-muted-foreground">Answer a few questions. AI writes the prompt and settings; you can edit everything after.</p>
        </div>
      </div>

      {/* Conversation */}
      <div ref={scrollRef} className="max-h-[42vh] space-y-2.5 overflow-y-auto rounded-2xl border border-border/70 bg-card p-4">
        {turns.map((turn, index) => (
          <div key={index} className={cn('flex gap-2', turn.from === 'you' && 'justify-end')}>
            {turn.from === 'ai' ? (
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Bot className="h-3.5 w-3.5" />
              </span>
            ) : null}
            <p
              className={cn(
                'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm animate-in fade-in slide-in-from-bottom-1',
                turn.from === 'ai' ? 'rounded-tl-sm bg-muted' : 'rounded-tr-sm bg-primary text-primary-foreground',
              )}
            >
              {turn.text}
            </p>
          </div>
        ))}
      </div>

      {phase === 'ask' && question ? (
        /* Composer with a drawer for the current question (options as A/B/C). */
        <div className="overflow-hidden rounded-2xl border border-border shadow-sm">
          <div className="border-b border-border/70 bg-muted/40 px-3 py-3">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-primary">
                {step + 1} / {questions.length}
              </span>
              Your input requested
            </div>
            <p className="mb-2 text-sm font-semibold">{question.ask}</p>
            {question.options ? (
              <ul className="space-y-1" role={question.multi ? 'group' : 'radiogroup'} aria-label={question.ask}>
                {question.options.map((option, index) => {
                  const selected = picked.includes(option.id)
                  return (
                    <li key={option.id}>
                      <button
                        type="button"
                        role={question.multi ? 'checkbox' : 'radio'}
                        aria-checked={selected}
                        onClick={() => choose(option.id)}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors',
                          selected ? 'bg-primary/10 text-foreground' : 'hover:bg-background/70',
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-semibold',
                            selected ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground ring-1 ring-border',
                          )}
                        >
                          {LETTERS[index]}
                        </span>
                        {option.label}
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </div>
          <form
            className="flex items-end gap-2 bg-card p-2"
            onSubmit={(event) => {
              event.preventDefault()
              submitCurrent()
            }}
          >
            <textarea
              ref={inputRef}
              rows={1}
              value={draftText}
              disabled={!question.input}
              onChange={(event) => setDraftText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  submitCurrent()
                }
              }}
              placeholder={question.input?.placeholder ?? `Pick an option above (${LETTERS.slice(0, question.options?.length ?? 0).split('').join(', ')})`}
              className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-default"
            />
            {question.input?.optional && question.id === 'links' && !draftText.trim() ? (
              <Button type="submit" variant="ghost" size="sm">
                Skip
              </Button>
            ) : null}
            {question.input || question.multi ? (
              <Button
                type="submit"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-full"
                disabled={question.id === 'goals' ? !picked.length && !draftText.trim() : question.id !== 'links' && !draftText.trim()}
                aria-label="Send"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            ) : null}
          </form>
        </div>
      ) : null}

      {phase === 'build' ? (
        <>
          <AgentPlanning title={created ? 'Assistant ready' : failedAt ? 'Something went wrong' : 'Building your assistant'} steps={plan} className="my-0" />
          <div className="flex flex-wrap items-center justify-end gap-2">
            {failedAt ? (
              <Button variant="outline" onClick={() => void build(answers)}>
                <RotateCcw className="mr-1.5 h-4 w-4" />
                Try again
              </Button>
            ) : null}
            {created || failedAt ? (
              <Button variant="ghost" onClick={restart}>
                Start over
              </Button>
            ) : null}
            {created ? (
              <Button onClick={() => router.push(`/ai-agents?assistant=${created.id}`)}>
                Open {created.name}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  )
}
