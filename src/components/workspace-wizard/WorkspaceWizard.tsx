'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PlusIcon } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { commitWorkspaceWizard } from '@/actions/workspaceWizard'
import { WorkspaceWizardProvider, useWorkspaceWizard } from './WorkspaceWizardContext'
import { WorkspaceWizardShell } from './WorkspaceWizardShell'
import { buildWizardSteps, type AgentOption, type WorkspaceModuleId, type WorkspaceOption } from './types'
import { WorkspaceStep } from './steps/WorkspaceStep'
import { ModulesStep } from './steps/ModulesStep'
import { PublishStep } from './steps/PublishStep'
import { PartnersStep } from './steps/PartnersStep'
import { MessagesStep } from './steps/MessagesStep'
import { ProjectQueueStep } from './steps/ProjectQueueStep'

type Props = {
  /** Hide the header trigger (e.g. open from Messages New Room). */
  hideTrigger?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Pre-select modules and skip the modules multi-select step. */
  presetModules?: WorkspaceModuleId[]
  triggerLabel?: string
  /** Optional class for the default trigger button */
  triggerClassName?: string
}

function WizardBody({
  skipModulesStep,
  onClose,
}: {
  skipModulesStep: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const { draft } = useWorkspaceWizard()
  const [isPending, startTransition] = useTransition()
  const [validationError, setValidationError] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [completedIds, setCompletedIds] = useState<string[]>([])

  const steps = useMemo(
    () =>
      buildWizardSteps({
        modules: draft.modules,
        skipModulesStep,
      }),
    [draft.modules, skipModulesStep],
  )

  // Clamp index when step list shrinks (deselected modules)
  useEffect(() => {
    if (currentIndex >= steps.length) {
      setCurrentIndex(Math.max(0, steps.length - 1))
    }
  }, [steps.length, currentIndex])

  const currentStep = steps[currentIndex]

  const validateCurrent = useCallback((): string | null => {
    if (!currentStep) return 'Invalid step'
    if (currentStep.kind === 'workspace') {
      if (draft.workspaceMode === 'create' && !draft.workspaceName.trim()) {
        return 'Workspace name is required'
      }
      if (draft.workspaceMode === 'existing' && !draft.workspaceId) {
        return 'Choose a workspace'
      }
      return null
    }
    if (currentStep.kind === 'modules') {
      if (draft.modules.length === 0) return 'Select at least one module'
      return null
    }
    if (currentStep.kind === 'partners') {
      if (!draft.partners.mcpUrl.trim()) return 'Partner MCP URL is required'
      return null
    }
    if (currentStep.kind === 'messages') {
      if (draft.messages.agentIds.length === 0) return 'Select at least one AI agent'
      return null
    }
    return null
  }, [currentStep, draft])

  const finish = useCallback(() => {
    startTransition(async () => {
      const result = await commitWorkspaceWizard({
        workspaceMode: draft.workspaceMode,
        workspaceId: draft.workspaceId,
        workspaceName: draft.workspaceName,
        modules: draft.modules,
        publish: draft.publish,
        partners: draft.partners,
        messages: draft.messages,
      })

      if (!result.ok) {
        setValidationError(result.error)
        toast.error(result.error)
        return
      }

      toast.success('Workspace setup saved')
      onClose()

      if (result.openProduct && result.openWebinar) {
        toast.message('Opening Product wizard — add Live webinar next from Add to workspace.')
      }

      if (result.openProduct) {
        router.push(
          `/projects?tenantId=${encodeURIComponent(result.workspaceId)}&intent=product&openAdd=1`,
        )
        return
      }
      if (result.openWebinar) {
        router.push(
          `/projects?tenantId=${encodeURIComponent(result.workspaceId)}&intent=webinar&openAdd=1`,
        )
        return
      }
      if (result.roomName) {
        router.push(`/messages?room=${encodeURIComponent(result.roomName)}`)
        return
      }
      if (draft.modules.includes('partners')) {
        const qs = new URLSearchParams({
          tenantId: result.workspaceId,
        })
        if (draft.partners?.kind) qs.set('kind', draft.partners.kind)
        router.push(`/tenants/partners?${qs.toString()}`)
        return
      }
      if (draft.modules.includes('publish')) {
        router.push(`/messages/publish`)
        return
      }
      router.push(`/tenants?tenantId=${encodeURIComponent(result.workspaceId)}`)
      router.refresh()
    })
  }, [draft, onClose, router])

  const handleBack = () => {
    setValidationError(null)
    if (currentIndex === 0) {
      onClose()
      return
    }
    setCurrentIndex((i) => i - 1)
  }

  const handleNext = () => {
    setValidationError(null)
    const err = validateCurrent()
    if (err) {
      setValidationError(err)
      return
    }

    if (currentStep && !completedIds.includes(currentStep.id)) {
      setCompletedIds((ids) => [...ids, currentStep.id])
    }

    const isLast = currentIndex >= steps.length - 1
    if (isLast) {
      finish()
      return
    }
    setCurrentIndex((i) => i + 1)
  }

  const renderStep = () => {
    if (!currentStep) return null
    switch (currentStep.kind) {
      case 'workspace':
        return <WorkspaceStep />
      case 'modules':
        return <ModulesStep />
      case 'publish':
        return <PublishStep />
      case 'partners':
        return <PartnersStep />
      case 'messages':
        return <MessagesStep />
      case 'product':
        return <ProjectQueueStep kind="product" />
      case 'webinar':
        return <ProjectQueueStep kind="webinar" />
      default:
        return null
    }
  }

  return (
    <WorkspaceWizardShell
      steps={steps}
      currentIndex={currentIndex}
      completedIds={completedIds}
      isSubmitting={isPending}
      validationError={validationError}
      onBack={handleBack}
      onNext={handleNext}
      completeLabel={
        draft.modules.includes('product') || draft.modules.includes('webinar')
          ? 'Save & continue'
          : 'Complete'
      }
    >
      {renderStep()}
    </WorkspaceWizardShell>
  )
}

export default function WorkspaceWizard({
  hideTrigger = false,
  open: controlledOpen,
  onOpenChange,
  presetModules,
  triggerLabel = 'Add to workspace',
  triggerClassName,
}: Props) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen

  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([])
  const [agents, setAgents] = useState<AgentOption[]>([])
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!open) {
      setReady(false)
      return
    }
    let mounted = true
    setLoading(true)
    fetch('/api/workspaces/wizard-options')
      .then(async (res) => {
        if (!res.ok) return { workspaces: [], agents: [] }
        return (await res.json()) as {
          workspaces: WorkspaceOption[]
          agents: AgentOption[]
        }
      })
      .then((data) => {
        if (!mounted) return
        setWorkspaces(data.workspaces ?? [])
        setAgents(data.agents ?? [])
        setReady(true)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [open])

  const skipModulesStep = Boolean(presetModules && presetModules.length > 0)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger ? (
        <DialogTrigger asChild>
          <button
            type="button"
            className={
              triggerClassName ??
              'flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-primary/10 px-4 py-2 text-sm font-normal text-primary backdrop-blur-sm hover:bg-primary/20'
            }
          >
            <PlusIcon className="h-4 w-4" />
            {triggerLabel}
          </button>
        </DialogTrigger>
      ) : null}

      <DialogContent className="max-h-[95vh] max-w-[95vw] overflow-y-auto border-none bg-transparent p-0 sm:max-w-[900px]">
        <DialogTitle className="sr-only">{triggerLabel}</DialogTitle>
        {loading || !ready ? (
          <div className="rounded-3xl border border-border bg-card/90 p-10 text-center text-sm text-muted-foreground">
            Loading wizard…
          </div>
        ) : (
          <WorkspaceWizardProvider
            key={`${open}-${presetModules?.join(',') ?? 'all'}-${workspaces[0]?.id ?? 'new'}`}
            workspaces={workspaces}
            agents={agents}
            initialDraft={
              presetModules
                ? {
                    modules: presetModules,
                  }
                : undefined
            }
          >
            <WizardBody skipModulesStep={skipModulesStep} onClose={() => setOpen(false)} />
          </WorkspaceWizardProvider>
        )}
      </DialogContent>
    </Dialog>
  )
}
