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

type BusinessOption = { id: string; name: string }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  businesses: BusinessOption[]
}

type WebinarOption = { id: string; title: string }

export const CreateTenantModal = ({ open, onOpenChange, businesses }: Props) => {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [pitchMessage, setPitchMessage] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [webinarId, setWebinarId] = useState('')
  const [businessId, setBusinessId] = useState(
    () => (businesses.length === 1 ? businesses[0].id : ''),
  )
  const [webinars, setWebinars] = useState<WebinarOption[]>([])

  useEffect(() => {
    if (!open) return
    fetch('/api/user/webinars')
      .then((r) => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) setWebinars(data as WebinarOption[])
      })
      .catch(() => {})
    if (businesses.length === 1) setBusinessId(businesses[0].id)
  }, [open, businesses])

  const handleSubmit = () => {
    setError('')
    if (!businessId && businesses.length > 0) {
      setError('Select a business')
      return
    }
    startTransition(async () => {
      const result = await createTenant({
        name,
        pitchMessage,
        videoUrl: videoUrl || undefined,
        webinarId: webinarId || undefined,
        businessId: businessId || undefined,
      })
      if (result.success && result.tenant) {
        onOpenChange(false)
        router.push(`/tenants/${result.tenant.id}`)
      } else {
        setError(result.error || 'Failed to create tenant')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New tenant</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {businesses.length > 1 && (
            <div>
              <Label>Business</Label>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm mt-1"
                value={businessId}
                onChange={(e) => setBusinessId(e.target.value)}
              >
                <option value="">Select business…</option>
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <Label>Tenant name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Brand A — sales assistant"
            />
          </div>
          <div>
            <Label>Pitch message</Label>
            <Textarea
              value={pitchMessage}
              onChange={(e) => setPitchMessage(e.target.value)}
              rows={4}
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
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm mt-1"
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
            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Create tenant
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
