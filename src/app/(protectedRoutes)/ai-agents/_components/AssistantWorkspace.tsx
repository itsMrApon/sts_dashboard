'use client'

import { useCallback, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowUpRight, Bot, Check, ChevronDown, Loader2, Pencil, Plus, Search, Settings2, X } from 'lucide-react'
import { toast } from 'sonner'
import { deleteAssistant, linkAssistantToService, renameAssistant, type AssistantSummary } from '@/actions/assistants'
import type { AgentEngineView } from '@/actions/agentEngine'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CategoryList, type Category } from '@/components/ui/category-list'
import { Input } from '@/components/ui/input'
import { ASSISTANT_SERVICES, ASSISTANT_SERVICE_META, type AssistantService } from '@/lib/agents/assistantServices'
import { guardAction } from '@/lib/clientActionErrors'
import type { ChatServiceConfig, FormServiceConfig, SpeakServiceConfig } from '@/lib/services/types'
import { cn } from '@/lib/utils'
import type { getOrCreateBusinessWizard } from '@/lib/wizard/wizardRepo'
import { ChatConfigurator } from '../../services/chat/_components/ChatConfigurator'
import { FormConfigurator } from '../../services/form/_components/FormConfigurator'
import { SpeakConfigurator } from '../../services/speak/_components/SpeakConfigurator'
import { WizardConfigurator } from '../../services/wizard/_components/configurator/WizardConfigurator'
import { AssistantPromptCard } from './AssistantPromptCard'
import { NewAssistantFlow } from './NewAssistantFlow'

export type AssistantBehaviour = { chat: ChatServiceConfig; voice: SpeakServiceConfig; form: FormServiceConfig }
type BusinessTour = Awaited<ReturnType<typeof getOrCreateBusinessWizard>>

type Props = {
  roomName: string
  businessName: string
  assistants: AssistantSummary[]
  selected: AssistantSummary | null
  behaviour: AssistantBehaviour | null
  tour: BusinessTour | null
  tourAssistantId: string | null
  /** Create flow is open: for this service, or 'pick' to choose one first. */
  newService: AssistantService | 'pick' | null
  engineView: AgentEngineView | null
  voiceLabel: string
  voiceSpeaksBangla: boolean
  ownerEmail: string
  emailReady: boolean
}

function serviceLabel(assistant: AssistantSummary): string {
  return assistant.service ? ASSISTANT_SERVICE_META[assistant.service].label : 'Classic · any service'
}

function statusLine(assistant: AssistantSummary): string {
  if (assistant.inUse.length === 0) return `${serviceLabel(assistant)} · not in use`
  return `${serviceLabel(assistant)} · running ${assistant.inUse.map((service) => ASSISTANT_SERVICE_META[service].label).join(', ')}`
}

export function AssistantWorkspace(props: Props) {
  const { assistants, selected, newService } = props
  const router = useRouter()
  const [promptDirty, setPromptDirty] = useState(false)
  const onDirtyChange = useCallback((dirty: boolean) => setPromptDirty(dirty), [])
  const [query, setQuery] = useState('')
  const [toDelete, setToDelete] = useState<AssistantSummary | null>(null)
  const [deleting, startDeleting] = useTransition()

  const go = (href: string) => {
    if (promptDirty && !window.confirm('You have unsaved changes to this prompt. Leave without saving?')) return
    router.push(href)
  }

  const confirmDelete = (assistant: AssistantSummary) =>
    startDeleting(
      guardAction(async () => {
        const result = await deleteAssistant(assistant.id)
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        toast.success(`${assistant.name} deleted`)
        setToDelete(null)
        // Deleting the open assistant: go back to the list (the first one opens).
        if (selected?.id === assistant.id) router.push('/ai-agents')
        router.refresh()
      }),
    )

  const shown = query.trim()
    ? assistants.filter((assistant) => assistant.name.toLowerCase().includes(query.trim().toLowerCase()))
    : assistants
  const categories: Category[] = shown.map((assistant) => ({
    id: assistant.id,
    title: assistant.name,
    subtitle: statusLine(assistant),
    featured: assistant.inUse.length > 0,
    // The business-address assistant can't be deleted (public links hang off it): no X.
    action: assistant.isBusinessAddress ? null : (
      <button
        type="button"
        onClick={() => setToDelete(assistant)}
        aria-label={`Delete ${assistant.name}`}
        title="Delete assistant"
        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <X className="h-4 w-4" />
      </button>
    ),
    badge: assistant.inUse.length ? (
      <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
        live
      </span>
    ) : null,
    onClick: () => go(`/ai-agents?assistant=${assistant.id}`),
  }))

  const detailOpen = Boolean(selected || newService)

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-se-xl border border-border md:flex-row">
      {/* Phones: the list, or the open assistant with a Back button. md+: the 300px list beside it. */}
      <aside
        className={cn(
          'min-h-0 w-full flex-1 overflow-y-auto md:w-[300px] md:flex-none md:border-r md:border-border',
          detailOpen ? 'hidden md:block' : 'block',
        )}
      >
        <CategoryList
          compact
          title="Your"
          subtitle="Assistants"
          headerIcon={<Bot className="h-5 w-5" />}
          categories={categories}
          activeId={newService ? null : (selected?.id ?? null)}
          toolbar={
            <div className="mb-3 space-y-2">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
                <Button variant="outline" className="w-full" onClick={() => go('/ai-agents/config')}>
                  <Settings2 className="mr-1.5 h-4 w-4" />
                  Config Agent
                </Button>
                <Button className="w-full" onClick={() => go('/ai-agents?new')}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  New assistant
                </Button>
              </div>
              {assistants.length > 3 ? (
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search assistants"
                    aria-label="Search assistants"
                    className="pl-9"
                  />
                </div>
              ) : null}
            </div>
          }
          empty={
            <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              {query ? 'No assistant matches.' : 'No assistants yet.'}
            </p>
          }
        />
      </aside>

      <section className={cn('min-h-0 min-w-0 flex-1 overflow-y-auto p-4 sm:p-6', detailOpen ? 'block' : 'hidden md:block')}>
        {detailOpen ? (
          <button
            type="button"
            onClick={() => go('/ai-agents?list')}
            className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground md:hidden"
          >
            <ArrowLeft className="h-4 w-4" /> Assistants
          </button>
        ) : null}

        {newService ? (
          <NewAssistantFlow initialService={newService === 'pick' ? null : newService} businessName={props.businessName} />
        ) : selected && props.behaviour ? (
          <AssistantDetail {...props} assistant={selected} behaviour={props.behaviour} onDirtyChange={onDirtyChange} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Pick an assistant on the left.</div>
        )}
      </section>

      <AlertDialog open={Boolean(toDelete)} onOpenChange={(open) => !open && !deleting && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {toDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete?.inUse.length
                ? `It runs ${toDelete.inUse.map((target) => ASSISTANT_SERVICE_META[target].label).join(', ')}. Those services go offline until you pick another assistant. `
                : ''}
              This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault()
                if (toDelete) confirmDelete(toDelete)
              }}
            >
              {deleting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function AssistantDetail({
  assistant,
  behaviour,
  roomName,
  tour,
  tourAssistantId,
  engineView,
  voiceLabel,
  voiceSpeaksBangla,
  ownerEmail,
  emailReady,
  onDirtyChange,
}: Props & { assistant: AssistantSummary; behaviour: AssistantBehaviour; onDirtyChange: (dirty: boolean) => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(assistant.name)
  // Classic assistants can run any service: pick which service's behaviour to edit.
  const [service, setService] = useState<AssistantService>(assistant.service ?? assistant.inUse[0] ?? 'chat')
  const services: AssistantService[] = assistant.service ? [assistant.service] : [...ASSISTANT_SERVICES]
  const live = (target: AssistantService) => assistant.inUse.includes(target)

  const run = (action: () => Promise<{ ok: true } | { ok: false; error: string }>, success: string, after?: () => void) =>
    startTransition(
      guardAction(async () => {
        const result = await action()
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        toast.success(success)
        after?.()
        router.refresh()
      }),
    )

  const saveName = () => {
    const clean = name.trim()
    if (!clean || clean === assistant.name) {
      setName(assistant.name)
      setRenaming(false)
      return
    }
    run(() => renameAssistant(assistant.id, clean), 'Renamed', () => setRenaming(false))
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header. A container query (not the viewport) decides the layout: the editor pane is narrow
          beside the list on tablets even when the window is wide. */}
      <div className="@container rounded-2xl border border-border/80 bg-card p-4">
        <div className="flex flex-col gap-3 @lg:flex-row @lg:items-center @lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Bot className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              {renaming ? (
                <form
                  className="flex items-center gap-1.5"
                  onSubmit={(event) => {
                    event.preventDefault()
                    saveName()
                  }}
                >
                  <Input value={name} maxLength={80} autoFocus onChange={(e) => setName(e.target.value)} onBlur={saveName} className="h-8" />
                  <Button type="submit" size="icon" variant="ghost" className="h-8 w-8" aria-label="Save name">
                    <Check className="h-4 w-4" />
                  </Button>
                </form>
              ) : (
                <button type="button" onClick={() => setRenaming(true)} className="group flex max-w-full items-center gap-1.5 text-left" title="Rename">
                  <span className="truncate text-lg font-semibold">{assistant.name}</span>
                  <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              )}
              <p className="truncate text-xs text-muted-foreground">{serviceLabel(assistant)}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {assistant.inUse.map((target) => (
              <Link
                key={target}
                href={ASSISTANT_SERVICE_META[target].servicePath}
                title={`${ASSISTANT_SERVICE_META[target].label}: look, switch and website code`}
                className="flex h-7 items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 text-xs font-medium text-emerald-600 hover:bg-emerald-500/25 dark:text-emerald-400"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                {ASSISTANT_SERVICE_META[target].label}
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            ))}
            {assistant.service && !live(assistant.service) ? (
              <Button
                size="sm"
                disabled={pending}
                onClick={() => run(() => linkAssistantToService(assistant.service!, assistant.id), `Now running ${ASSISTANT_SERVICE_META[assistant.service!].label}`)}
              >
                {pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                Use for {ASSISTANT_SERVICE_META[assistant.service].label}
              </Button>
            ) : null}
            {!assistant.service && services.filter((target) => !live(target)).length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" disabled={pending}>
                    {pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                    Use for…
                    <ChevronDown className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Make it run</DropdownMenuLabel>
                  {services.filter((target) => !live(target)).map((target) => (
                    <DropdownMenuItem
                      key={target}
                      onSelect={() => run(() => linkAssistantToService(target, assistant.id), `Now running ${ASSISTANT_SERVICE_META[target].label}`)}
                    >
                      {ASSISTANT_SERVICE_META[target].label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>
      </div>

      <AssistantPromptCard
        assistant={{
          id: assistant.id,
          name: assistant.name,
          firstMessage: assistant.firstMessage,
          systemPrompt: assistant.systemPrompt,
          language: assistant.language,
        }}
        engineView={engineView}
        onDirtyChange={onDirtyChange}
      />

      {services.length > 1 ? (
        <div role="tablist" aria-label="Service to edit" className="flex flex-wrap items-center gap-1.5">
          <span className="pr-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Edit behaviour for</span>
          {services.map((target) => (
            <button
              key={target}
              type="button"
              role="tab"
              aria-selected={service === target}
              onClick={() => setService(target)}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors',
                service === target ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:bg-muted/60',
              )}
            >
              {live(target) ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden /> : null}
              {ASSISTANT_SERVICE_META[target].label}
            </button>
          ))}
        </div>
      ) : null}

      {service === 'chat' ? (
        <ChatConfigurator
          key={`chat-${assistant.id}`}
          mode="assistant"
          roomName={roomName}
          assistant={{ id: assistant.id, name: assistant.name }}
          initialConfig={behaviour.chat}
          live={live('chat')}
        />
      ) : service === 'voice' ? (
        <SpeakConfigurator
          key={`voice-${assistant.id}`}
          mode="assistant"
          roomName={roomName}
          assistant={{ id: assistant.id, name: assistant.name, firstMessage: assistant.firstMessage, language: assistant.language }}
          initialConfig={behaviour.voice}
          live={live('voice')}
          voiceLabel={voiceLabel}
          voiceSpeaksBangla={voiceSpeaksBangla}
        />
      ) : service === 'form' ? (
        <FormConfigurator
          key={`form-${assistant.id}`}
          mode="assistant"
          roomName={roomName}
          assistant={{ id: assistant.id, name: assistant.name }}
          initialConfig={behaviour.form}
          live={live('form')}
          ownerEmail={ownerEmail}
          emailReady={emailReady}
        />
      ) : tour && tourAssistantId === assistant.id ? (
        <WizardConfigurator key={`tour-${tour.slug}`} part="assistant" initialWizard={tour} assistantName={assistant.name} />
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center">
          <p className="font-medium">This guide isn&apos;t running your tour</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Your business tour has one set of steps. Make this assistant its guide to write and edit them here.
          </p>
          <Button
            className="mt-4"
            disabled={pending}
            onClick={() => run(() => linkAssistantToService('tour', assistant.id), 'Now guiding your Tour')}
          >
            Use for Tour
          </Button>
        </div>
      )}

    </div>
  )
}
