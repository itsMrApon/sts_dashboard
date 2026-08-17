'use client'

import { useWorkspaceWizard } from '../WorkspaceWizardContext'

export function ProjectQueueStep({ kind }: { kind: 'product' | 'webinar' }) {
  const { draft } = useWorkspaceWizard()
  const label = kind === 'product' ? 'Product' : 'Live webinar'

  return (
    <div className="space-y-3 text-sm text-muted-foreground">
      <p>
        After you complete this wizard, the {label} multi-step form opens for workspace{' '}
        <span className="font-medium text-foreground">{draft.workspaceName || '…'}</span>.
      </p>
      <p>
        That flow keeps its own title and CTA steps — same design as Projects → Add. The new project
        is linked to this workspace automatically.
      </p>
    </div>
  )
}
