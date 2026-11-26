'use client'

import Link from 'next/link'
import { formatDistanceToNowStrict } from 'date-fns'
import { ArrowLeft, BrainCircuit, CornerDownLeft, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { guardAction } from '@/lib/clientActionErrors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ChatSidebar, type ChatThread } from '@/components/ui/chat-sidebar'
import {
  composeDraftAction,
  composeLeadEmailAction,
  createAssistantChatAction,
  saveAssistantTurnAction,
  discardDraftAction,
  loadThreadAction,
  searchEmailLeadsAction,
  sendLeadEmailAction,
  sendReplyAction,
  setAiPausedAction,
} from '@/actions/messages'
import type { InboxSource, InboxThread, ThreadDetail } from '@/lib/messages/inbox'
import type { PartnerAssistantInfo } from '@/actions/messages'
import { extractPartnerPrefixes, PARTNER_SLASH_COMMANDS, resolvePartnerServices } from '@/lib/partners/slashCommands'
import { normalizePartnerKind } from '@/lib/tenants/tenantServices'

const SOURCE_LABEL: Record<InboxSource, string> = {
  whatsapp: 'WhatsApp',
  website: 'Website chat',
  offer: 'Project chat',
  email: 'Email',
  instagram: 'Instagram',
  assistant: 'Partner chat',
}

/** The proposal the partner assistant waits on before it changes anything in an app. */
type PartnerProposal = { id: string; summary: string; tools: { name: string; connectorKind: string; connectorLabel: string; description: string }[] }

const STATUS_LABEL: Record<string, string> = { NEW: 'new', ON_PROCESS: 'in progress', DONE: 'done' }
const WHO_LABEL = { them: '', ai: 'Chat AI', you: 'You', agent: 'Your agent', call: '' } as const
const DRAFT_BY: Record<string, string> = { you: 'your draft', ai: 'written by AI', agent: 'written by your agent', match: 'lead match' }

/** What "Write with AI" can write. The AI only writes; you send. */
const WRITE_KINDS = [
  { kind: 'reply', label: 'Reply', hint: 'answer their last message' },
  { kind: 'message', label: 'Message', hint: 'move the chat forward' },
  { kind: 'greeting', label: 'Greeting', hint: 'Eid, new year, a check-in' },
  { kind: 'offer', label: 'New offer', hint: 'one of your offers that fits' },
  { kind: 'deadline', label: 'Deadline', hint: 'an offer ending, a slot, a date' },
] as const

const LIST_REFRESH_MS = 15_000
const THREAD_REFRESH_MS = 5_000

type Filter = 'all' | 'waiting' | 'drafts' | InboxSource

const ago = (iso: string | null) => (iso ? formatDistanceToNowStrict(new Date(iso), { addSuffix: false }) : '')

/**
 * Messages: every conversation in a chatcn sidebar, one open thread, and the composer.
 * The AI never sends: "Write with AI" and allowed lead matches leave a draft; you click Send.
 */
export function MessageInbox({
  threads,
  canEmail,
  onRefresh,
  initialOpenId = null,
  urlParam = 't',
  className,
  partnerAssistant = null,
  startNewChat = false,
}: {
  threads: InboxThread[]
  canEmail: boolean
  /** The business room and the apps connected in Integrations, for partner chats ("New chat"). */
  partnerAssistant?: PartnerAssistantInfo | null
  /** Open with a new partner chat (Integrations → a partner's Assistant button). */
  startNewChat?: boolean
  /** Reload the list (the Messages panel fetches it itself); defaults to refreshing the page. */
  onRefresh?: () => void
  initialOpenId?: string | null
  /** Query parameter that holds the open conversation, so a link can open it. */
  urlParam?: string
  className?: string
}) {
  const router = useRouter()
  const refresh = onRefresh ?? (() => router.refresh())
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh
  const [filter, setFilter] = useState<Filter>('all')
  const [openId, setOpenId] = useState<string | null>(initialOpenId)
  const [thread, setThread] = useState<ThreadDetail | null>(null)
  const [, startLoading] = useTransition()
  const [composing, setComposing] = useState(false)

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') refreshRef.current()
    }, LIST_REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const url = new URL(window.location.href)
    if (openId) url.searchParams.set(urlParam, openId)
    else url.searchParams.delete(urlParam)
    window.history.replaceState(window.history.state, '', url)
    setThread(null)
    if (!openId) return
    startLoading(
      guardAction(async () => {
        const res = await loadThreadAction({ id: openId })
        if (res.ok) setThread(res.data)
        else {
          toast.error(res.error)
          setOpenId(null)
        }
      }),
    )
  }, [openId, urlParam])

  // The open conversation stays fresh (quietly; a draft you are typing is kept by the composer).
  useEffect(() => {
    if (!openId) return
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void loadThreadAction({ id: openId }).then((res) => {
        if (!res.ok) return
        setThread((current) =>
          current && current.id === res.data.id && current.messages.length === res.data.messages.length && current.aiPaused === res.data.aiPaused
            ? current
            : res.data,
        )
      })
    }, THREAD_REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [openId])

  const sources = useMemo(() => [...new Set(threads.map((t) => t.source))], [threads])
  const waiting = threads.filter((t) => t.needsReply).length
  const drafts = threads.filter((t) => t.hasDraft).length
  const shown = threads.filter((t) =>
    filter === 'all' ? true : filter === 'waiting' ? t.needsReply : filter === 'drafts' ? t.hasDraft : t.source === filter,
  )
  const sidebarThreads: ChatThread[] = shown.map((t) => ({
    id: t.id,
    title: t.title,
    updatedAt: t.lastAt ?? 0,
    // Hand: they are waiting for you. Dot: a draft is ready to send.
    status: t.needsReply ? ('needs-input' as const) : t.hasDraft ? ('unread' as const) : ('idle' as const),
  }))

  /** A new partner chat: a conversation where the partner assistant answers from the connected apps. */
  function newChat() {
    startLoading(
      guardAction(async () => {
        const res = await createAssistantChatAction()
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        setFilter('all')
        refresh()
        setOpenId(res.data.threadId)
      }),
    )
  }

  // Opened to start a partner chat: make one once, as soon as the panel opens.
  const startedNewChat = useRef(false)
  useEffect(() => {
    if (!startNewChat || startedNewChat.current || !partnerAssistant) return
    startedNewChat.current = true
    newChat()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per opening
  }, [startNewChat, partnerAssistant])
  const activeId = thread?.id && shown.some((t) => t.id === thread.id) ? thread.id : openId

  return (
    // data-sakuga="off": the chatcn sidebar puts icons first in its buttons, which the app's
    // "no leading icon" rule would otherwise hide.
    <div
      data-sakuga="off"
      className={cn('flex min-h-[560px] overflow-hidden', className ?? 'h-[calc(100dvh-15rem)] rounded-xl border border-border')}
    >
      <div className={cn('min-h-0', openId ? 'hidden md:flex' : 'flex w-full md:w-auto')}>
        <ChatSidebar
          threads={sidebarThreads}
          activeId={activeId}
          onSelect={(id) => setOpenId(id)}
          brand="Conversations"
          searchPlaceholder="Search conversations…"
          hotkeys={false}
          defaultWidth={280}
          maxWidth={360}
          // On phones the list is the whole screen (its own width is inline, hence the !), with no
          // collapse button (there is nothing beside it to make room for).
          className="pt-(--panel-top) max-md:!w-full max-md:border-e-0 max-md:[&_button[aria-label='Close_sidebar']]:hidden"
          header={
            <div className="flex flex-col gap-2 pt-1">
              <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filter conversations">
                {(['all', 'waiting', 'drafts', ...sources] as Filter[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    role="tab"
                    aria-selected={filter === f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      'h-6 rounded-full px-2 text-[11px] transition-colors',
                      filter === f ? 'bg-foreground text-background font-medium' : 'text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {f === 'all'
                      ? 'All'
                      : f === 'waiting'
                        ? `Waiting${waiting ? ` ${waiting}` : ''}`
                        : f === 'drafts'
                          ? `Drafts${drafts ? ` ${drafts}` : ''}`
                          : SOURCE_LABEL[f]}
                  </button>
                ))}
              </div>
              <Button size="sm" variant="outline" onClick={() => setComposing(true)}>
                New email to a lead
              </Button>
              {partnerAssistant ? (
                <Button size="sm" variant="outline" onClick={newChat} title="Ask the apps connected in Integrations (n8n, Medusa, ERPNext…)">
                  New chat
                </Button>
              ) : null}
            </div>
          }
        />
      </div>

      <section className={cn('min-w-0 flex-1 flex-col pt-(--panel-top)', openId ? 'flex' : 'hidden md:flex')}>
        {!openId ? (
          <EmptyThread hasThreads={threads.length > 0} />
        ) : !thread ? (
          <div className="text-muted-foreground flex flex-1 items-center justify-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : (
          <ThreadView
            key={thread.id}
            thread={thread}
            partner={partnerAssistant}
            onBack={() => setOpenId(null)}
            onChange={(next) => {
              setThread(next)
              refresh()
            }}
          />
        )}
      </section>

      <NewEmailDialog
        open={composing}
        canEmail={canEmail}
        onClose={() => setComposing(false)}
        onOpenThread={(threadId) => {
          setComposing(false)
          refresh()
          setOpenId(threadId)
        }}
      />
    </div>
  )
}

function EmptyThread({ hasThreads }: { hasThreads: boolean }) {
  return (
    <div className="flex flex-1 items-center justify-center p-8 text-center">
      <div className="max-w-sm space-y-2">
        <p className="font-medium">{hasThreads ? 'Pick a conversation' : 'Your conversations land here'}</p>
        <p className="text-muted-foreground text-sm">
          WhatsApp, Instagram, your website chat, project chats and emails to leads. The AI writes drafts for you; you always click
          Send. Leads that need what you sell show up in{' '}
          <Link href="/lead/approval" className="text-foreground underline underline-offset-2">
            Lead → Approval
          </Link>
          .
        </p>
      </div>
    </div>
  )
}

function ThreadView({
  thread,
  partner,
  onBack,
  onChange,
}: {
  thread: ThreadDetail
  partner: PartnerAssistantInfo | null
  onBack: () => void
  onChange: (next: ThreadDetail) => void
}) {
  const [text, setText] = useState(thread.draft?.body ?? '')
  const [subject, setSubject] = useState(thread.draft?.subject ?? thread.replySubject ?? '')
  const [writing, setWriting] = useState(false)
  const [note, setNote] = useState('')
  const [pending, startTransition] = useTransition()
  const end = useRef<HTMLDivElement>(null)
  const aiChannel = thread.source === 'whatsapp' || thread.source === 'website' || thread.source === 'offer'
  const isEmail = thread.source === 'email'
  // A partner chat: the creator asks, the partner assistant answers from the connected apps.
  const isPartner = thread.source === 'assistant'
  const partnerKinds = new Set(
    (partner?.connectedPartners ?? []).map((p) => {
      const kind = normalizePartnerKind(p.kind)
      return kind.startsWith('custom') ? 'custom' : kind
    }),
  )
  // The app list: opened from the AI button, or by typing / at the start (like Claude Code's / menu).
  const [pickerOpen, setPickerOpen] = useState(false)
  const appCommands = PARTNER_SLASH_COMMANDS.filter((c) => c.showInBar)
  const slashOnly = isPartner && /^\/\S*$/.test(text)
  const slashMatches = slashOnly ? appCommands.filter((c) => c.prefix.startsWith(text.toLowerCase())) : []
  const appMenu = isPartner && (pickerOpen || slashOnly)
  useEffect(() => {
    if (!pickerOpen) return
    const close = (event: PointerEvent) => {
      if (!(event.target as Element | null)?.closest('[data-app-picker]')) setPickerOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [pickerOpen])
  function pickApp(prefix: string) {
    setText((current) => `${prefix} ${current.replace(/^\/\S*\s*/, '')}`)
    setPickerOpen(false)
  }
  const [asking, setAsking] = useState<string | null>(null)
  const [proposal, setProposal] = useState<PartnerProposal | null>(null)

  // A new draft (AI, agent, lead match) replaces what is in the box.
  const draftStamp = thread.draft?.updatedAt ?? null
  useEffect(() => {
    if (!thread.draft) return
    setText(thread.draft.body)
    if (thread.draft.subject) setSubject(thread.draft.subject)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when a different draft arrives
  }, [draftStamp])

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [thread.messages.length, asking])

  /** Asks the partner assistant (same API as the old Integrations chat) and saves the turn here. */
  async function askPartner(body: Record<string, unknown>, ask?: string) {
    if (!partner) {
      toast.error('Create your business room in Services first.')
      return
    }
    const history = thread.messages
      .filter((m) => m.who === 'you' || m.who === 'ai')
      .map((m) => ({ role: m.who === 'you' ? ('user' as const) : ('assistant' as const), content: m.text }))
    // The app this turn is for: the /command in it, or else the last one used in this chat.
    const fromText = (value: string) =>
      resolvePartnerServices({ prefixes: extractPartnerPrefixes(value), connectedPartners: partner.connectedPartners })
    const earlier = [...thread.messages].reverse().filter((m) => m.who === 'you').map((m) => fromText(m.text)).find((s) => s.length > 0)
    const services = (ask ? fromText(ask) : []).length ? fromText(ask!) : (earlier ?? [])
    let reply = ''
    let next: PartnerProposal | null = null
    try {
      const res = await fetch('/api/tenants/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: partner.tenantId, services, sessionId: thread.id, history, ...body }),
      })
      const data = (await res.json().catch(() => ({}))) as { reply?: string; error?: string; pendingProposal?: PartnerProposal | null }
      reply = res.ok ? data.reply || 'Done.' : data.error || 'The assistant could not answer. Try again.'
      next = res.ok ? (data.pendingProposal ?? null) : null
    } catch {
      reply = 'Could not reach the assistant. Check your connection and try again.'
    }
    const saved = await saveAssistantTurnAction({ id: thread.id, ask, reply })
    if (!saved.ok) toast.error(saved.error)
    else onChange(saved.data)
    setProposal(next)
  }

  function sendToPartner() {
    const ask = text.trim()
    if (!ask || asking) return
    setText('')
    setAsking(ask)
    setProposal(null)
    startTransition(
      guardAction(async () => {
        try {
          await askPartner({ message: ask }, ask)
        } finally {
          setAsking(null)
        }
      }),
    )
  }

  function resolveProposal(action: 'confirm' | 'cancel') {
    if (!proposal) return
    const id = proposal.id
    startTransition(
      guardAction(async () => {
        await askPartner(action === 'confirm' ? { confirmProposalId: id } : { cancelProposalId: id })
      }),
    )
  }

  function send() {
    if (isPartner) return sendToPartner()
    if (!text.trim()) return
    startTransition(
      guardAction(async () => {
        const res = await sendReplyAction({ id: thread.id, text, subject: isEmail ? subject : undefined })
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        setText('')
        onChange(res.data)
      }),
    )
  }

  function write(kind: string) {
    startTransition(
      guardAction(async () => {
        const res = await composeDraftAction({ id: thread.id, kind, note: note || undefined })
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        setWriting(false)
        setNote('')
        onChange(res.data)
        toast.success('Draft ready', { description: 'Read it, change anything, then Send.' })
      }),
    )
  }

  function discard() {
    startTransition(
      guardAction(async () => {
        const res = await discardDraftAction({ id: thread.id })
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        setText('')
        onChange({ ...thread, draft: null, hasDraft: false })
      }),
    )
  }

  function toggleAi() {
    startTransition(
      guardAction(async () => {
        const res = await setAiPausedAction({ id: thread.id, paused: !thread.aiPaused })
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        onChange({ ...thread, aiPaused: !thread.aiPaused })
      }),
    )
  }

  return (
    <>
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4">
        <button type="button" onClick={onBack} aria-label="Back to conversations" className="text-muted-foreground hover:text-foreground md:hidden">
          <ArrowLeft className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-medium">{thread.title}</h2>
          <p className="text-muted-foreground truncate text-[11px]">
            {SOURCE_LABEL[thread.source]}
            {thread.context ? ` · ${thread.context}` : ''}
            {thread.lead ? (
              <>
                {' · '}
                <Link href={`/lead/${thread.lead.id}`} className="hover:text-foreground underline-offset-2 hover:underline">
                  Lead ({STATUS_LABEL[thread.lead.status] ?? thread.lead.status})
                </Link>
              </>
            ) : null}
          </p>
        </div>
        {aiChannel ? (
          <button
            type="button"
            disabled={pending}
            onClick={toggleAi}
            title="Your Chat AI answers customers on this channel. Take over to answer them yourself."
            className="text-muted-foreground hover:text-foreground rounded-md border border-border px-2.5 py-1 text-xs disabled:opacity-50"
          >
            {thread.aiPaused ? 'Hand back to Chat AI' : 'Take over from Chat AI'}
          </button>
        ) : null}
      </header>

      <div className={cn('min-h-0 flex-1 overflow-y-auto px-4 py-4', isPartner ? 'space-y-5' : 'space-y-3')}>
        {thread.messages.length === 0 && !asking ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            {isPartner
              ? 'Ask the apps you connected in Integrations. Start with /n8n, /medusa, /erpnext…'
              : 'No messages yet. Your draft below is the first one.'}
          </p>
        ) : null}
        {thread.messages.map((m) =>
          m.who === 'call' ? (
            <CallCard key={m.id} message={m} />
          ) : isPartner ? (
            // Partner chat, like Claude Code: your ask full width on a soft background (no border), the answer as plain text.
            m.who === 'you' ? (
              <div key={m.id} className="bg-muted/60 w-full rounded-xl px-3.5 py-2.5 text-sm whitespace-pre-wrap">
                {m.text}
              </div>
            ) : (
              <PartnerAnswer key={m.id} text={m.text} />
            )
          ) : (
            <div key={m.id} className={cn('flex flex-col', m.who === 'them' ? 'items-start' : 'items-end')}>
              <div
                className={cn(
                  'max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap',
                  m.who === 'them' ? 'bg-muted rounded-bl-md' : 'bg-primary/10 rounded-br-md',
                )}
              >
                {m.subject ? <p className="mb-1 font-medium">{m.subject}</p> : null}
                {m.text}
              </div>
              <span className="text-muted-foreground mt-0.5 px-1 text-[11px]">{[WHO_LABEL[m.who], ago(m.at)].filter(Boolean).join(' · ')}</span>
            </div>
          ),
        )}
        {asking ? (
          <>
            <div className="bg-muted/60 w-full rounded-xl px-3.5 py-2.5 text-sm whitespace-pre-wrap">{asking}</div>
            <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <span aria-hidden className="animate-pulse text-[#d97757]">✻</span> Working…
            </p>
          </>
        ) : null}
        <div ref={end} />
      </div>

      <footer className="space-y-2 px-3 pt-1 pb-3">
        {thread.draft ? (
          <div className="flex items-start gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs">
            <span className="min-w-0 flex-1">
              <span className="font-medium">Draft, {DRAFT_BY[thread.draft.source] ?? 'ready'}.</span> Nothing is sent until you click Send.
              {thread.draft.note ? <span className="text-muted-foreground block">{thread.draft.note}</span> : null}
            </span>
            <button type="button" onClick={discard} disabled={pending} className="text-muted-foreground hover:text-foreground shrink-0 underline-offset-2 hover:underline">
              Discard
            </button>
          </div>
        ) : null}
        {proposal ? (
          <div className="space-y-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs">
            <p className="font-medium">Confirm before it runs</p>
            <ul className="text-muted-foreground space-y-0.5">
              {proposal.tools.map((tool) => (
                <li key={`${tool.name}-${tool.connectorKind}`}>
                  <span className="text-foreground font-medium">{tool.connectorLabel}</span>: {tool.description}
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Button size="sm" disabled={pending} onClick={() => resolveProposal('confirm')}>
                Confirm & run
              </Button>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => resolveProposal('cancel')}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
        {thread.replyNote && !isPartner ? <p className="text-muted-foreground text-xs">{thread.replyNote}</p> : null}

        {writing ? (
          <div className="space-y-2 rounded-md border border-border p-2.5">
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything it should say? (optional: “Eid offer 20% till Friday”)"
              aria-label="Note for the AI"
              className="h-8 text-xs"
            />
            <div className="flex flex-wrap gap-1.5">
              {WRITE_KINDS.map((k) => (
                <button
                  key={k.kind}
                  type="button"
                  disabled={pending}
                  onClick={() => write(k.kind)}
                  title={k.hint}
                  className="border-border hover:bg-muted rounded-full border px-2.5 py-1 text-xs disabled:opacity-50"
                >
                  {k.label}
                </button>
              ))}
              <button type="button" onClick={() => setWriting(false)} className="text-muted-foreground ml-auto text-xs">
                Cancel
              </button>
            </div>
            {pending ? (
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <Loader2 className="size-3 animate-spin" /> Writing…
              </p>
            ) : null}
          </div>
        ) : null}

        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
        >
          {isEmail ? <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" aria-label="Subject" /> : null}
          {/*
            The message box, like Claude Code: one line to start. Beside it the AI button (the app list in
            a partner chat, Write with AI elsewhere) and, only once there is text, the ↵ send button.
          */}
          <div className="border-border bg-background focus-within:border-foreground/30 flex items-end gap-1 rounded-2xl border py-1.5 pr-1.5 pl-3 transition-colors">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && appMenu) {
                  e.preventDefault()
                  setPickerOpen(false)
                  if (slashOnly) setText('')
                  return
                }
                if (appMenu && e.key === 'Enter' && !e.shiftKey && slashMatches[0]) {
                  e.preventDefault()
                  pickApp(slashMatches[0].prefix)
                  return
                }
                const sends = isEmail ? e.key === 'Enter' && (e.metaKey || e.ctrlKey) : e.key === 'Enter' && !e.shiftKey
                if (sends) {
                  e.preventDefault()
                  if (thread.canReply && !pending) send()
                }
              }}
              placeholder={
                isPartner
                  ? 'Ask your apps, or type / to pick one'
                  : isEmail
                    ? 'Write your email… (Cmd/Ctrl + Enter to send)'
                    : 'Write a message…'
              }
              aria-label="Message"
              rows={1}
              className="placeholder:text-muted-foreground block max-h-48 min-h-9 min-w-0 flex-1 resize-none bg-transparent py-1.5 text-base outline-none [field-sizing:content] md:text-sm"
            />
            <div data-app-picker className="relative flex shrink-0 items-center gap-1">
              <button
                type="button"
                aria-label={isPartner ? 'Pick an app' : 'Write with AI'}
                title={isPartner ? 'Pick an app (or type /)' : 'Write with AI'}
                aria-expanded={isPartner ? appMenu : writing}
                disabled={pending && !isPartner}
                onClick={() => (isPartner ? setPickerOpen((open) => !open) : setWriting((open) => !open))}
                className={cn(
                  'text-muted-foreground hover:text-foreground hover:border-border grid size-8 place-items-center rounded-lg border border-transparent transition-colors disabled:opacity-50',
                  (isPartner ? appMenu : writing) && 'border-border text-foreground',
                )}
              >
                <BrainCircuit className="size-4" />
              </button>
              {text.trim() || pending ? (
                <button
                  type="submit"
                  aria-label="Send"
                  disabled={pending || !text.trim() || !thread.canReply}
                  className="text-foreground hover:border-border grid size-8 place-items-center rounded-lg border border-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pending ? <Loader2 className="size-4 animate-spin" /> : <CornerDownLeft className="size-4" strokeWidth={2.25} />}
                </button>
              ) : null}

              {isPartner && appMenu ? (
                <div
                  role="listbox"
                  aria-label="Apps"
                  className="border-border bg-popover absolute right-0 bottom-full z-30 mb-2 w-72 rounded-xl border p-1 shadow-lg"
                >
                  {(slashOnly ? slashMatches : appCommands).map((c) => {
                    // Green: connected in Integrations → Partner apps, so the command can run.
                    const on = partnerKinds.has(c.serviceKind)
                    return (
                      <button
                        key={c.id}
                        type="button"
                        role="option"
                        aria-selected={false}
                        onClick={() => pickApp(c.prefix)}
                        className="hover:bg-muted flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left"
                      >
                        <span aria-hidden className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', on ? 'bg-emerald-500' : 'bg-muted-foreground/40')} />
                        <span className="min-w-0">
                          <span className="block font-mono text-xs">{c.prefix}</span>
                          <span className="text-muted-foreground block text-xs">
                            {c.description}
                            {on ? '' : ' · connect it in Integrations'}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                  {slashOnly && slashMatches.length === 0 ? (
                    <p className="text-muted-foreground px-2.5 py-2 text-xs">No app starts with {text.trim()}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </form>
      </footer>
    </>
  )
}

/** The partner assistant's answer, like Claude Code: plain text with markdown, no bubble. */
function PartnerAnswer({ text }: { text: string }) {
  return (
    <div className="text-sm leading-relaxed break-words [&_a]:underline [&_a]:underline-offset-2 [&_code]:bg-muted [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_h1]:mt-3 [&_h1]:mb-1.5 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:font-medium [&_li]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_pre]:bg-muted [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_strong]:font-semibold [&_table]:my-2 [&_table]:w-full [&_table]:text-xs [&_td]:border-border [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_th]:border-border [&_th]:border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  )
}

/** A voice call with the AI, in the middle of the thread: summary, length, and the transcript on demand. */
function CallCard({ message }: { message: ThreadDetail['messages'][number] }) {
  const call = message.call
  const minutes = call?.durationSec ? `${Math.max(1, Math.round(call.durationSec / 60))} min` : null
  return (
    <div className="bg-muted/60 mx-auto w-full max-w-md rounded-xl px-3.5 py-2.5 text-sm">
      <p className="text-muted-foreground text-[11px]">{['Voice call with the AI', minutes, call?.outcome, ago(message.at)].filter(Boolean).join(' · ')}</p>
      <p className="mt-1">{message.text}</p>
      {call?.lines.length ? (
        <details className="mt-1.5">
          <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-xs">Transcript</summary>
          <div className="mt-2 space-y-1 text-xs">
            {call.lines.map((line, i) => (
              <p key={i}>
                <span className="text-muted-foreground">{line.role === 'user' ? 'Them' : 'AI'}:</span> {line.text}
              </p>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  )
}

function NewEmailDialog({
  open,
  canEmail,
  onClose,
  onOpenThread,
}: {
  open: boolean
  canEmail: boolean
  onClose: () => void
  onOpenThread: (threadId: string) => void
}) {
  const [search, setSearch] = useState('')
  const [leads, setLeads] = useState<{ id: string; name: string; email: string; status: string }[]>([])
  const [lead, setLead] = useState<{ id: string; name: string; email: string } | null>(null)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open || !canEmail || lead) return
    const timer = window.setTimeout(() => {
      void searchEmailLeadsAction({ search }).then((res) => {
        if (res.ok) setLeads(res.data)
      })
    }, 200)
    return () => window.clearTimeout(timer)
  }, [open, canEmail, search, lead])

  function reset() {
    setLead(null)
    setSearch('')
    setSubject('')
    setBody('')
  }

  function aiWrite(kind: string) {
    if (!lead) return
    startTransition(
      guardAction(async () => {
        const res = await composeLeadEmailAction({ leadId: lead.id, kind })
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success('Draft ready', { description: 'Read it, change anything, then Send.' })
        reset()
        onOpenThread(res.data.threadId)
      }),
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset()
          onClose()
        }
      }}
    >
      <DialogContent className="gap-4 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New email to a lead</DialogTitle>
          <DialogDescription>
            {canEmail ? 'From your own mailbox. Write it yourself, or let the AI write a draft you send.' : 'Connect your email first so it goes out from your own address.'}
          </DialogDescription>
        </DialogHeader>

        {!canEmail ? (
          <DialogFooter>
            <Button asChild>
              <Link href="/integrations/email">Connect email</Link>
            </Button>
          </DialogFooter>
        ) : !lead ? (
          <div className="space-y-2">
            <Input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search leads with an email…" aria-label="Search leads" />
            <ul className="max-h-64 overflow-y-auto rounded-md border border-border">
              {leads.length === 0 ? (
                <li className="text-muted-foreground px-3 py-6 text-center text-sm">No leads with an email address.</li>
              ) : (
                leads.map((l) => (
                  <li key={l.id}>
                    <button type="button" onClick={() => setLead(l)} className="hover:bg-muted flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm">
                      <span className="truncate font-medium">{l.name}</span>
                      <span className="text-muted-foreground truncate text-xs">{l.email}</span>
                      <span className="text-muted-foreground ml-auto text-[11px]">{STATUS_LABEL[l.status] ?? l.status}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        ) : (
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault()
              startTransition(
                guardAction(async () => {
                  const res = await sendLeadEmailAction({ leadId: lead.id, subject, text: body })
                  if (!res.ok) {
                    toast.error(res.error)
                    return
                  }
                  toast.success(`Sent to ${lead.name}`)
                  reset()
                  onOpenThread(res.data.threadId)
                }),
              )
            }}
          >
            <p className="text-sm">
              To <span className="font-medium">{lead.name}</span> <span className="text-muted-foreground">&lt;{lead.email}&gt;</span>{' '}
              <button type="button" onClick={() => setLead(null)} className="text-muted-foreground text-xs underline">
                change
              </button>
            </p>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Write with AI:</span>
              {(['email', 'offer', 'greeting'] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  disabled={pending}
                  onClick={() => aiWrite(kind)}
                  className="border-border hover:bg-muted rounded-full border px-2.5 py-1 disabled:opacity-50"
                >
                  {kind === 'email' ? 'First email' : kind === 'offer' ? 'An offer that fits' : 'Greeting'}
                </button>
              ))}
              {pending ? <Loader2 className="size-3 animate-spin" /> : null}
            </div>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" aria-label="Subject" />
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Or write it yourself…" aria-label="Email" rows={7} />
            <DialogFooter>
              <Button type="submit" disabled={pending || !subject.trim() || !body.trim()}>
                Send
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
