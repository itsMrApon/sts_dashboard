'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Building2, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { updateChannelWorkspace, removeMessagingRoom } from '@/actions/messages'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export type WorkspaceOption = {
  id: string
  name: string
  publishName: string | null
}

type Props = {
  roomName: string
  currentWorkspace: WorkspaceOption | null
  workspaces: WorkspaceOption[]
}

/**
 * Option A: every Messages room belongs to a workspace.
 * Creator can Change workspace or Delete room — not unlink to orphan.
 */
export function RoomWorkspaceCard({ roomName, currentWorkspace, workspaces }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [workspaceId, setWorkspaceId] = useState(currentWorkspace?.id ?? '')
  const [deleteOpen, setDeleteOpen] = useState(false)

  useEffect(() => {
    setWorkspaceId(currentWorkspace?.id ?? '')
  }, [currentWorkspace?.id])

  const dirty = Boolean(workspaceId) && workspaceId !== (currentWorkspace?.id ?? '')
  const selected = workspaces.find((w) => w.id === workspaceId) ?? currentWorkspace

  const handleSave = () => {
    if (!workspaceId) {
      toast.error('Choose a workspace')
      return
    }
    startTransition(async () => {
      const result = await updateChannelWorkspace(roomName, workspaceId)
      if (!result.ok) {
        toast.error(result.error || 'Could not update workspace')
        return
      }
      toast.success('Workspace updated')
      router.refresh()
    })
  }

  const handleDelete = () => {
    startTransition(async () => {
      const result = await removeMessagingRoom(roomName)
      if (!result.ok) {
        toast.error(
          result.error === 'FORBIDDEN'
            ? 'You cannot remove this room.'
            : result.error || 'Could not delete room',
        )
        return
      }
      setDeleteOpen(false)
      toast.success('Room removed from Messages')
      router.push('/messages')
      router.refresh()
    })
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-card/70 p-5">
      <div className="flex items-start gap-2">
        <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-medium">Workspace</h3>
            {currentWorkspace ? (
              <Badge variant="secondary">Attached</Badge>
            ) : (
              <Badge variant="outline">Required</Badge>
            )}
          </div>
          {currentWorkspace ? (
            <p className="mt-1 text-sm font-medium text-foreground">{currentWorkspace.name}</p>
          ) : null}
          <p className="mt-1 text-xs text-muted-foreground">
            This room belongs to a workspace. Pitch and publish context come from that workspace
            automatically. Change workspace to move it, or delete the room from Messages.
          </p>
        </div>
      </div>

      {workspaces.length === 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">
          No workspaces yet. Create one under{' '}
          <Link href="/tenants" className="font-medium text-primary underline">
            Workspaces
          </Link>{' '}
          first.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {currentWorkspace ? 'Change workspace' : 'Attach to workspace'}
            </label>
            <Select
              value={workspaceId || currentWorkspace?.id || undefined}
              onValueChange={setWorkspaceId}
              disabled={isPending}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose workspace" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected && !selected.publishName ? (
              <p className="text-[11px] text-muted-foreground">
                No publish profile yet — add one under Messages → Publish.
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={handleSave}
              disabled={isPending || !dirty}
              className="gap-1"
            >
              {isPending && dirty ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {currentWorkspace ? 'Save change' : 'Attach'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
              disabled={isPending}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete room
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this room from Messages?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes messaging channels for @{roomName} and unlinks linked AI agents from this
              hub. The agent stays in AI Agents; the workspace stays. Use New room to connect again.
              Rooms must belong to a workspace — there is no “remove from workspace only” option.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={isPending} onClick={handleDelete}>
              {isPending ? 'Deleting…' : 'Delete room'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
