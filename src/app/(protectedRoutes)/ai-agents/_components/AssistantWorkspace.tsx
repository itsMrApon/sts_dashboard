'use client'

import { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, Pencil } from 'lucide-react'
import { toast } from '@/lib/toast'
import { deleteAssistant, linkAssistantToService, renameAssistant, type AssistantSummary } from '@/actions/assistants'
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
import { Input } from '@/components/ui/input'
import { ASSISTANT_SERVICE_META, type AssistantService } from '@/lib/agents/assistantServices'
import { guardAction } from '@/lib/clientActionErrors'
import type { ChatServiceConfig, FormServiceConfig, SpeakServiceConfig } from '@/lib/services/types'
import { cn } from '@/lib/utils'
import type { getOrCreateBusinessWizard } from '@/lib/wizard/wizardRepo'
import { ChatConfigurator } from '../../services/chat/_components/ChatConfigurator'
import { FormConfigurator } from '../../services/form/_components/FormConfigurator'
import { SpeakConfigurator } from '../../services/speak/_components/SpeakConfigurator'
import { WizardConfigurator } from '../../services/wizard/_components/configurator/WizardConfigurator'
import { AssistantPromptCard } from './AssistantPromptCard'
import { AssistantRail } from './AssistantRail'
import { ConfigDrawer, ConfigStack, parseConfigKey, type ConfigTarget } from './AssistantConfig'
import { AssistantWorkflow, servicesFor, type EngineSummary } from './AssistantWorkflow'
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
  /** The shared AI engine (model + voice), shown in the header. */
  engine: EngineSummary
  voiceLabel: string
  voiceSpeaksBangla: boolean
  ownerEmail: string
  emailReady: boolean
  /** Rail state saved in a cookie, read on the server. */
  railCollapsed: boolean
}

export function AssistantWorkspace(props: Props) {
  const { assistants, selected, newService } = props
  const router = useRouter()
  const [promptDirty, setPromptDirty] = useState(false)
  const onDirtyChange = useCallback((dirty: boolean) => setPromptDirty(dirty), [])
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

  const detailOpen = Boolean(selected || newService)

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-se-xl border border-border bg-background md:flex-row">
      {/* Phones: the list, or the open assistant with a Back button. md+: the rail beside it. */}
      <aside className={cn('min-h-0 w-full flex-1 md:w-auto md:flex-none', detailOpen ? 'hidden md:flex' : 'flex')}>
        <AssistantRail
          assistants={assistants}
          activeId={newService ? null : (selected?.id ?? null)}
          initialCollapsed={props.railCollapsed}
          creating={Boolean(newService)}
          onOpen={(assistant) => go(`/ai-agents?assistant=${assistant.id}`)}
          onCreate={() => go('/ai-agents?new')}
          onConfig={() => go('/ai-agents/config')}
          onDelete={setToDelete}
        />
      </aside>

      <section className={cn('min-h-0 min-w-0 flex-1 flex-col', detailOpen ? 'flex' : 'hidden md:flex')}>
        {detailOpen ? (
          <button
            type="button"
            onClick={() => go('/ai-agents?list')}
            className="mx-4 mt-3 inline-flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground md:hidden"
          >
            Assistants
          </button>
        ) : null}

        {newService ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            <NewAssistantFlow initialService={newService === 'pick' ? null : newService} businessName={props.businessName} />
          </div>
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
  assistants,
  businessName,
  behaviour,
  roomName,
  tour,
  tourAssistantId,
  engine,
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
  const [promptDirty, setPromptDirty] = useState(false)
  const services = servicesFor(assistant)
  const live = (target: AssistantService) => assistant.inUse.includes(target)
  const firstService: AssistantService = assistant.service ?? assistant.inUse[0] ?? 'chat'
  // The drawer: which editor it shows, and whether it's open. The behaviour editor for `service`
  // stays mounted while closed, so its unsaved edits survive closing the drawer.
  const [drawer, setDrawer] = useState<{ open: boolean; target: ConfigTarget; nonce: number }>({
    open: false,
    target: { group: 'prompt' },
    nonce: 0,
  })
  const [service, setService] = useState<AssistantService>(firstService)

  const handleDirty = useCallback(
    (dirty: boolean) => {
      setPromptDirty(dirty)
      onDirtyChange(dirty)
    },
    [onDirtyChange],
  )

  const openConfig = (target: ConfigTarget) => {
    if (target.group === 'behaviour') setService(target.service)
    setDrawer((current) => ({ open: true, target, nonce: current.nonce + 1 }))
  }

  const onConfigure = (configKey: string) => {
    // Another agent runs this channel: open that agent.
    if (configKey.startsWith('assistant:')) {
      if (promptDirty && !window.confirm('You have unsaved changes to this prompt. Leave without saving?')) return
      router.push(`/ai-agents?assistant=${encodeURIComponent(configKey.slice('assistant:'.length))}`)
      return
    }
    if (configKey === 'engine') {
      if (promptDirty && !window.confirm('You have unsaved changes to this prompt. Leave without saving?')) return
      router.push('/ai-agents/config#ai-engine')
      return
    }
    const target = parseConfigKey(configKey)
    if (target) openConfig(target)
  }

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

  const runFor = (target: AssistantService) =>
    run(() => linkAssistantToService(target, assistant.id), target === 'tour' ? 'Now guiding your Tour' : `Now running ${ASSISTANT_SERVICE_META[target].label}`)

  // The workflow title doubles as the rename control.
  const titleSlot = renaming ? (
    <form
      className="flex items-center gap-1.5"
      onSubmit={(event) => {
        event.preventDefault()
        saveName()
      }}
    >
      <Input value={name} maxLength={80} autoFocus onChange={(e) => setName(e.target.value)} onBlur={saveName} className="h-7 text-sm" aria-label="Assistant name" />
      <Button type="submit" size="icon" variant="ghost" className="h-7 w-7" aria-label="Save name">
        <Check className="h-4 w-4" />
      </Button>
    </form>
  ) : (
    <button type="button" onClick={() => setRenaming(true)} className="group flex max-w-full items-center gap-1.5 text-left" title="Rename assistant">
      <h1 className="truncate text-sm font-semibold">{assistant.name}</h1>
      <Pencil className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
    </button>
  )

  const activeTarget = drawer.open ? drawer.target : null
  const focusService = drawer.target.group === 'behaviour' ? drawer.target.service : service

  const behaviourEditor =
    service === 'chat' ? (
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
        <Button className="mt-4" disabled={pending} onClick={() => runFor('tour')}>
          Use for Tour
        </Button>
      </div>
    )

  return (
    <div className="min-h-0 flex-1 p-3 sm:p-4">
      <AssistantWorkflow
        assistant={assistant}
        assistants={assistants}
        businessName={businessName}
        engine={engine}
        emailReady={emailReady}
        titleSlot={titleSlot}
        onConfigure={onConfigure}
        stackTop={
          <ConfigStack
            assistant={assistant}
            services={services}
            promptDirty={promptDirty}
            active={activeTarget}
            focusService={focusService}
            onOpen={openConfig}
          />
        }
        stackMarks={[
          { id: 'prompt', label: 'P', title: 'Prompt', active: activeTarget?.group === 'prompt', onClick: () => openConfig({ group: 'prompt' }) },
          { id: 'behaviour', label: 'B', title: 'Behaviour', active: activeTarget?.group === 'behaviour', onClick: () => openConfig({ group: 'behaviour', service }) },
        ]}
        overlay={
          <ConfigDrawer
            open={drawer.open}
            target={drawer.target}
            nonce={drawer.nonce}
            live={drawer.target.group === 'behaviour' ? live(drawer.target.service) : false}
            pending={pending}
            onUseFor={runFor}
            onSection={(section) =>
              openConfig(drawer.target.group === 'prompt' ? { group: 'prompt', section } : { ...drawer.target, section })
            }
            onClose={() => setDrawer((current) => ({ ...current, open: false }))}
            prompt={
              <AssistantPromptCard
                assistant={{
                  id: assistant.id,
                  name: assistant.name,
                  firstMessage: assistant.firstMessage,
                  systemPrompt: assistant.systemPrompt,
                  language: assistant.language,
                }}
                onDirtyChange={handleDirty}
              />
            }
            behaviour={behaviourEditor}
          />
        }
      />
    </div>
  )
}
