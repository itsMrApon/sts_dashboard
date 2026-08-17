export type WorkspaceModuleId =
  | 'publish'
  | 'partners'
  | 'messages'
  | 'product'
  | 'webinar'

export type WorkspaceOption = {
  id: string
  name: string
  publishId: string | null
  publishName: string | null
}

export type AgentOption = {
  id: string
  name: string
  roomName: string
}

export type WizardStepDef = {
  id: string
  title: string
  description: string
  kind: 'workspace' | 'modules' | WorkspaceModuleId
}

export type PublishDraft = {
  description: string
  pitchMessage: string
}

export type PartnersDraft = {
  kind: string
  label: string
  mcpUrl: string
  authType: string
  authSecret: string
}

export type MessagesDraft = {
  agentIds: string[]
}

export type WorkspaceWizardDraft = {
  /** existing | create */
  workspaceMode: 'existing' | 'create'
  workspaceId: string | null
  workspaceName: string
  modules: WorkspaceModuleId[]
  publish: PublishDraft
  partners: PartnersDraft
  messages: MessagesDraft
}

export const MODULE_META: Record<
  WorkspaceModuleId,
  { label: string; description: string }
> = {
  publish: {
    label: 'Publish',
    description: 'Business info, services, social links, and terms',
  },
  partners: {
    label: 'Partners',
    description: 'Connect one MCP endpoint per partner type',
  },
  messages: {
    label: 'Messages',
    description: 'Room, widget, Telegram, Discord, and channel setup',
  },
  product: {
    label: 'Product',
    description: 'Create a product-style project flow',
  },
  webinar: {
    label: 'Live webinar',
    description: 'Create a live project/webinar flow',
  },
}

export const EMPTY_DRAFT: WorkspaceWizardDraft = {
  workspaceMode: 'create',
  workspaceId: null,
  workspaceName: '',
  modules: [],
  publish: {
    description: '',
    pitchMessage: '',
  },
  partners: {
    kind: 'medusa',
    label: '',
    mcpUrl: 'http://localhost:9001',
    authType: 'none',
    authSecret: '',
  },
  messages: {
    agentIds: [],
  },
}

/** Build the step list: workspace → modules (optional) → selected module blocks. */
export function buildWizardSteps(options: {
  modules: WorkspaceModuleId[]
  /** When true, skip the multi-select modules step (preset from Messages page etc.) */
  skipModulesStep?: boolean
}): WizardStepDef[] {
  const steps: WizardStepDef[] = [
    {
      id: 'workspace',
      title: 'Workspace',
      description: 'Create a workspace or choose an existing one',
      kind: 'workspace',
    },
  ]

  if (!options.skipModulesStep) {
    steps.push({
      id: 'modules',
      title: 'Modules',
      description: 'Select what to add — more selections add more steps',
      kind: 'modules',
    })
  }

  const order: WorkspaceModuleId[] = [
    'publish',
    'partners',
    'messages',
    'product',
    'webinar',
  ]

  for (const id of order) {
    if (!options.modules.includes(id)) continue
    if (id === 'product' || id === 'webinar') {
      steps.push({
        id,
        title: MODULE_META[id].label,
        description: 'Opens the project wizard after setup',
        kind: id,
      })
      continue
    }
    steps.push({
      id,
      title: MODULE_META[id].label,
      description: MODULE_META[id].description,
      kind: id,
    })
  }

  return steps
}
