'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { createTenant } from '@/actions/tenants'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** @deprecated ignored — publish profile is created with the workspace name */
  businesses?: Array<{ id: string; name: string }>
  defaultBusinessId?: string
  onCreated?: (tenantId: string) => void
}

type WebinarOption = { id: string; title: string }

export const CreateTenantModal = ({ open, onOpenChange, onCreated }: Props) => {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [pitchMessage, setPitchMessage] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [webinarId, setWebinarId] = useState('')
  const [webinars, setWebinars] = useState<WebinarOption[]>([])

  useEffect(() => {
    if (!open) return
    fetch('/api/user/webinars')
      .then((r) => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) setWebinars(data as WebinarOption[])
      })
      .catch(() => {})
  }, [open])

  const reset = () => {
    setName('')
    setPitchMessage('')
    setVideoUrl('')
    setWebinarId('')
    setError('')
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const handleSubmit = () => {
    setError('')
    startTransition(async () => {
      const result = await createTenant({
        name: name.trim(),
        pitchMessage,
        videoUrl: videoUrl || undefined,
        webinarId: webinarId || undefined,
      })

      if (result.success && result.tenant) {
        handleOpenChange(false)
        if (onCreated) {
          onCreated(result.tenant.id)
        } else {
          router.push(`/tenants?tenantId=${result.tenant.id}`)
        }
        router.refresh()
      } else {
        setError(result.error || 'Failed to create workspace')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New workspace</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            A workspace is for partner tools and internal chat. Website business details live in
            Messages → Publish, on the room attached to this workspace.
          </div>

          <div>
            <Label>Workspace name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. switchtoswag"
            />
          </div>
          <div>
            <Label>Pitch message</Label>
            <Textarea
              value={pitchMessage}
              onChange={(e) => setPitchMessage(e.target.value)}
              rows={3}
              placeholder="What the AI should know when talking to leads…"
            />
          </div>
          <div>
            <Label>Pitch video URL (optional)</Label>
            <Input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
          <div>
            <Label>Link to project / product (optional)</Label>
            <select
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={webinarId}
              onChange={(e) => setWebinarId(e.target.value)}
            >
              <option value="">None</option>
              {webinars.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.title}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button
            onClick={handleSubmit}
            disabled={isPending || !name.trim() || !pitchMessage.trim()}
          >
            {isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Create workspace
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
