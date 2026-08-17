'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useWorkspaceWizard } from '../WorkspaceWizardContext'

export function WorkspaceStep() {
  const { draft, patchDraft, workspaces } = useWorkspaceWizard()

  return (
    <div className="space-y-4">
      {workspaces.length > 0 ? (
        <div className="space-y-2">
          <Label>Workspace</Label>
          <Select
            value={
              draft.workspaceMode === 'create' ? '__create__' : draft.workspaceId || undefined
            }
            onValueChange={(value) => {
              if (value === '__create__') {
                patchDraft({
                  workspaceMode: 'create',
                  workspaceId: null,
                  workspaceName: '',
                })
                return
              }
              const selected = workspaces.find((w) => w.id === value)
              patchDraft({
                workspaceMode: 'existing',
                workspaceId: value,
                workspaceName: selected?.name ?? '',
              })
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose workspace" />
            </SelectTrigger>
            <SelectContent>
              {workspaces.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
              <SelectItem value="__create__">+ Create new workspace</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No workspace yet. Name this one — Publish, Partners, and Messages will use the same name.
        </p>
      )}

      {draft.workspaceMode === 'create' || workspaces.length === 0 ? (
        <div className="space-y-2">
          <Label htmlFor="workspace-name">Workspace name</Label>
          <Input
            id="workspace-name"
            value={draft.workspaceName}
            onChange={(e) =>
              patchDraft({
                workspaceMode: 'create',
                workspaceName: e.target.value,
                workspaceId: null,
              })
            }
            placeholder="e.g. Prime One NYC"
          />
          <p className="text-xs text-muted-foreground">
            Publish, Partners, and Messages inherit this name. Product and Live webinar keep their
            own titles.
          </p>
        </div>
      ) : null}
    </div>
  )
}
