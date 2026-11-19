'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, Bot, Loader2, Sparkles } from 'lucide-react'
import { toast } from '@/lib/toast'
import { linkAssistantToService, type AssistantSummary } from '@/actions/assistants'
import { ASSISTANT_SERVICE_META, canRunService, type AssistantService } from '@/lib/agents/assistantServices'
import { guardAction } from '@/lib/clientActionErrors'
import { cn } from '@/lib/utils'
import { StudioSection } from './StudioPrimitives'

/**
 * Top of every /services page: which /ai-agents assistant runs this service. Required — the
 * service can't go live without one. Behaviour is edited on the assistant; this page keeps looks.
 */
export function ServiceAssistantPicker({
  service,
  assistants,
  currentId,
}: {
  service: AssistantService
  assistants: AssistantSummary[]
  currentId: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const meta = ASSISTANT_SERVICE_META[service]
  const eligible = assistants.filter((assistant) => canRunService(assistant.service, service))
  const current = eligible.find((assistant) => assistant.id === currentId) ?? null
  const createHref = `/ai-agents?new=${service}`

  const pick = (agentId: string) =>
    startTransition(
      guardAction(async () => {
        const result = await linkAssistantToService(service, agentId)
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        toast.success(`${meta.label} now runs on this assistant`)
        router.refresh()
      }),
    )

  return (
    <StudioSection
      id="assistant"
      icon={Bot}
      title="Assistant"
      action={
        <Link href={createHref} className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted/60">
          New {meta.noun}
        </Link>
      }
    >
      {current ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{current.name}</p>
          </div>
          <Link
            href={`/ai-agents?assistant=${current.id}`}
            className="flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
          >
            Edit behaviour <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-amber-500/50 bg-amber-500/5 p-4 text-sm">
          <p className="font-medium">No assistant yet</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Needed to go live.</p>
        </div>
      )}

      {eligible.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {eligible.map((assistant) => {
            const selected = assistant.id === current?.id
            return (
              <button
                key={assistant.id}
                type="button"
                disabled={pending || selected}
                onClick={() => pick(assistant.id)}
                className={cn(
                  'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors disabled:cursor-default',
                  selected ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
              >
                {pending && !selected ? null : (
                  <span className={cn('h-1.5 w-1.5 rounded-full', selected ? 'bg-primary' : 'bg-muted-foreground/50')} aria-hidden />
                )}
                {assistant.name}
                {assistant.service === null ? <span className="text-[10px] uppercase tracking-wide opacity-60">classic</span> : null}
              </button>
            )
          })}
          {pending ? <Loader2 className="h-4 w-4 animate-spin self-center text-muted-foreground" /> : null}
        </div>
      ) : null}
    </StudioSection>
  )
}
