'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useWorkspaceWizard } from '../WorkspaceWizardContext'

export function PublishStep() {
  const { draft, patchDraft } = useWorkspaceWizard()

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Uses workspace name <span className="font-medium text-foreground">{draft.workspaceName || '…'}</span>{' '}
        as the publish profile. Add optional details now; full services/social stay on Publish.
      </p>
      <div className="space-y-2">
        <Label htmlFor="publish-desc">Short description (optional)</Label>
        <Textarea
          id="publish-desc"
          value={draft.publish.description}
          onChange={(e) =>
            patchDraft({ publish: { ...draft.publish, description: e.target.value } })
          }
          placeholder="What this business offers"
          rows={3}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="publish-pitch">Pitch for AI (optional)</Label>
        <Input
          id="publish-pitch"
          value={draft.publish.pitchMessage}
          onChange={(e) =>
            patchDraft({ publish: { ...draft.publish, pitchMessage: e.target.value } })
          }
          placeholder="Defaults to a welcome line using the workspace name"
        />
      </div>
    </div>
  )
}
