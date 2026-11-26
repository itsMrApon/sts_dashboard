'use client'

import { openMessages } from '@/components/messages/openMessages'
import { formatDistanceToNow } from 'date-fns'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { guardAction } from '@/lib/clientActionErrors'
import { ApprovalInbox, type PendingApproval } from '@/components/ui/approval-inbox'
import { approveAgentRequests, denyAgentRequests, findLeadMatchesAction, revokeAgentToolGrant } from '@/actions/agentRequests'

export type PendingRow = {
  id: string
  runId: string
  runTitle: string
  tool: string
  title: string
  detail?: string
  reason?: string
  input?: unknown
  requestedAt: number
  area: string
  client: string
}
type Decision = {
  id: string
  tool: string
  title: string
  status: string
  error: string | null
  note: string | null
  autoApproved: boolean
  decidedAt: string | null
}
type Grant = { id: string; tool: string; createdAt: string }

const CLIENT_LABEL: Record<string, string> = { claude: 'Claude Code', codex: 'Codex', cursor: 'Cursor' }

/** What each kind of request means, in plain words. Unknown tools fall back to their stored title. */
const ACTION_LABEL: Record<string, string> = {
  propose_lead_match: 'Lead match',
  draft_reply: 'Send a reply',
  draft_email_to_lead: 'Email a lead',
  propose_answer: 'Save an answer to a customer question',
  propose_business_description: 'Update your business description',
  propose_connection: 'Add a connection',
  import_n8n_workflow: 'Import an n8n workflow',
  act_on_connection: 'Run an action on a connection',
  set_service_on: 'Turn a website service on or off',
}

const STATUS_LABEL: Record<string, string> = { APPLIED: 'Done', FAILED: 'Failed', DENIED: 'Denied', EXPIRED: 'Expired' }

const ago = (time: string | number | null) => (time ? formatDistanceToNow(new Date(time), { addSuffix: true }) : '')

const humanKey = (key: string) => key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

/** The change itself, shown as text: before → after, a question and its answer, or plain rows. */
function ChangePreview({ input }: { input: unknown }) {
  if (!input || typeof input !== 'object') return null
  const data = input as Record<string, unknown>

  if ('reply' in data || 'message' in data) {
    return (
      <span className="block space-y-2 text-sm">
        <span className="block text-muted-foreground">To {String(data.to ?? '')}</span>
        {data.offer ? (
          <span className="block">
            Needs <span className="font-medium">{String(data.offer)}</span>
            {data.whyItFits ? <span className="text-muted-foreground"> · {String(data.whyItFits)}</span> : null}
          </span>
        ) : null}
        {data.theyWrote ? <span className="block text-muted-foreground border-l-2 pl-3 italic">{String(data.theyWrote)}</span> : null}
        {data.subject ? <span className="block font-medium">{String(data.subject)}</span> : null}
        <span className="block whitespace-pre-wrap">{String(data.reply ?? data.message)}</span>
      </span>
    )
  }
  if ('before' in data && 'after' in data) {
    return (
      <span className="block space-y-2 text-sm">
        {data.before ? <span className="block text-muted-foreground line-through decoration-muted-foreground/40">{String(data.before)}</span> : null}
        <span className="block whitespace-pre-wrap">{String(data.after)}</span>
      </span>
    )
  }
  if ('question' in data && 'answer' in data) {
    return (
      <span className="block space-y-1.5 text-sm">
        <span className="block font-medium">{String(data.question)}</span>
        <span className="block text-muted-foreground whitespace-pre-wrap">{String(data.answer)}</span>
      </span>
    )
  }
  return (
    <span className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      {Object.entries(data).map(([key, value]) => (
        <span key={key} className="contents">
          <span className="text-muted-foreground">{humanKey(key)}</span>
          <span className="min-w-0 break-words">
            {value && typeof value === 'object' ? (
              <code className="text-xs">{JSON.stringify(value)}</code>
            ) : (
              String(value ?? '')
            )}
          </span>
        </span>
      ))}
    </span>
  )
}

/** Lead → Approval: what your AI agent wants to change, one card each. Nothing happens until you allow it. */
/** Tools whose raw input is worth showing (connections); message drafts read better as text. */
const SHOW_RAW_INPUT = new Set(['propose_connection', 'act_on_connection', 'import_n8n_workflow'])

/**
 * Lead → Approval: what the AI agent wants to send to a customer or change in a connection,
 * in the approval inbox (select many, filter by task or tool, A / D / X on the focused row).
 */
export function ApprovalView({ pending, decisions, grants }: { pending: PendingRow[]; decisions: Decision[]; grants: Grant[] }) {
  const router = useRouter()
  const [busy, startTransition] = useTransition()

  const approvals: PendingApproval[] = pending.map((row) => ({
    id: row.id,
    runId: row.runId,
    runTitle: `${row.runTitle} · ${CLIENT_LABEL[row.client] ?? row.client}`,
    tool: row.tool,
    title: ACTION_LABEL[row.tool] ?? row.title,
    detail: row.detail,
    requestedAt: row.requestedAt,
    reason: (
      <span className="block space-y-2">
        <span className="bg-muted/40 block rounded-md px-3 py-2">
          <ChangePreview input={row.input} />
        </span>
        {row.reason ? <span className="block">Why: {row.reason}</span> : null}
      </span>
    ),
    input: SHOW_RAW_INPUT.has(row.tool) ? row.input : undefined,
  }))

  function approve(ids: string[], scope: 'once' | 'always') {
    startTransition(
      guardAction(async () => {
        const res = await approveAgentRequests({ ids, scope })
        if (!res.ok) {
          toast.error(res.error)
          router.refresh()
          return
        }
        const done = res.data.filter((o) => o.status === 'APPLIED').length
        const failed = res.data.filter((o) => o.status !== 'APPLIED')
        if (failed.length === 0) toast.success(done === 1 ? 'Done' : `${done} done`, { description: scope === 'always' ? 'It won’t ask for this again.' : undefined })
        else toast.error(`${failed.length} couldn’t be done`, { description: failed.map((f) => f.error ?? 'failed').join(' · ').slice(0, 300) })
        router.refresh()
      }),
    )
  }

  function deny(ids: string[], note?: string) {
    startTransition(
      guardAction(async () => {
        const res = await denyAgentRequests({ ids, note })
        if (!res.ok) toast.error(res.error)
        else toast.info(note ? 'Denied. Your note goes back to the agent.' : 'Denied')
        router.refresh()
      }),
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Approval</h1>
          <p className="text-muted-foreground max-w-xl text-sm">
            Leads that need what you sell, found by the AI or your agent. Allow puts the email in{' '}
            <button type="button" onClick={() => openMessages()} className="text-foreground underline underline-offset-2">
              Messages
            </button>{' '}
            as a draft; you send it.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            startTransition(
              guardAction(async () => {
                const res = await findLeadMatchesAction()
                if (!res.ok) toast.error(res.error)
                else if (res.data.looked === 0) toast.info('No new leads with an email to check')
                else
                  toast.success(res.data.matched ? `${res.data.matched} lead match${res.data.matched === 1 ? '' : 'es'} found` : 'No clear matches', {
                    description: `Checked ${res.data.looked} lead${res.data.looked === 1 ? '' : 's'} against what you sell.`,
                  })
                router.refresh()
              }),
            )
          }
          className="border-border hover:bg-muted h-9 rounded-md border px-3 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {busy ? 'Working…' : 'Find matches'}
        </button>
      </header>

      <ApprovalInbox approvals={approvals} onApprove={approve} onDeny={deny} aria-busy={busy} className={cn(busy && 'opacity-80')} />
      {decisions.length > 0 ? (
        <details className="group">
          <summary className="text-muted-foreground hover:text-foreground cursor-pointer list-none text-sm">
            History ({decisions.length})
          </summary>
          <ul className="mt-3 space-y-2">
            {decisions.map((d) => (
              <li key={d.id} className="flex items-baseline gap-3 text-sm">
                <span className={cn('w-14 flex-none text-xs', d.status === 'APPLIED' ? 'text-emerald-600 dark:text-emerald-400' : d.status === 'FAILED' ? 'text-destructive' : 'text-muted-foreground')}>
                  {STATUS_LABEL[d.status] ?? d.status}
                </span>
                <span className="min-w-0 flex-1 truncate">{ACTION_LABEL[d.tool] ?? d.title}</span>
                <span className="text-muted-foreground flex-none text-xs">{ago(d.decidedAt)}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {grants.length > 0 ? (
        <details>
          <summary className="text-muted-foreground hover:text-foreground cursor-pointer list-none text-sm">
            Always allowed ({grants.length})
          </summary>
          <ul className="mt-3 space-y-2">
            {grants.map((grant) => (
              <li key={grant.id} className="flex items-center gap-3 text-sm">
                <span className="flex-1">{ACTION_LABEL[grant.tool] ?? grant.tool}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    startTransition(
                      guardAction(async () => {
                        const res = await revokeAgentToolGrant({ id: grant.id })
                        if (!res.ok) toast.error(res.error)
                        router.refresh()
                      }),
                    )
                  }
                  className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline"
                >
                  Ask me again
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  )
}
