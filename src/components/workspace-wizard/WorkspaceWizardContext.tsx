'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  EMPTY_DRAFT,
  type AgentOption,
  type WorkspaceModuleId,
  type WorkspaceOption,
  type WorkspaceWizardDraft,
} from './types'

type WorkspaceWizardContextValue = {
  draft: WorkspaceWizardDraft
  setDraft: React.Dispatch<React.SetStateAction<WorkspaceWizardDraft>>
  patchDraft: (partial: Partial<WorkspaceWizardDraft>) => void
  workspaces: WorkspaceOption[]
  agents: AgentOption[]
  toggleModule: (id: WorkspaceModuleId) => void
}

const WorkspaceWizardContext = createContext<WorkspaceWizardContextValue | null>(null)

export function WorkspaceWizardProvider({
  children,
  initialDraft,
  workspaces,
  agents,
}: {
  children: ReactNode
  initialDraft?: Partial<WorkspaceWizardDraft>
  workspaces: WorkspaceOption[]
  agents: AgentOption[]
}) {
  const [draft, setDraft] = useState<WorkspaceWizardDraft>(() => ({
    ...EMPTY_DRAFT,
    workspaceMode: workspaces.length > 0 ? 'existing' : 'create',
    workspaceId: workspaces[0]?.id ?? null,
    workspaceName: workspaces[0]?.name ?? '',
    ...initialDraft,
  }))

  const patchDraft = useCallback((partial: Partial<WorkspaceWizardDraft>) => {
    setDraft((prev) => ({ ...prev, ...partial }))
  }, [])

  const toggleModule = useCallback((id: WorkspaceModuleId) => {
    setDraft((prev) => {
      const has = prev.modules.includes(id)
      return {
        ...prev,
        modules: has ? prev.modules.filter((m) => m !== id) : [...prev.modules, id],
      }
    })
  }, [])

  const value = useMemo(
    () => ({ draft, setDraft, patchDraft, workspaces, agents, toggleModule }),
    [draft, patchDraft, workspaces, agents, toggleModule],
  )

  return (
    <WorkspaceWizardContext.Provider value={value}>{children}</WorkspaceWizardContext.Provider>
  )
}

export function useWorkspaceWizard() {
  const ctx = useContext(WorkspaceWizardContext)
  if (!ctx) throw new Error('useWorkspaceWizard must be used within WorkspaceWizardProvider')
  return ctx
}
