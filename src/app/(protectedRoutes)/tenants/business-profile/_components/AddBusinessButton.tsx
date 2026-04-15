'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Loader2, Plus } from 'lucide-react'
import { createBusinessQuick } from '@/actions/business'

export const AddBusinessButton = () => {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = () => {
    setError('')
    startTransition(async () => {
      const result = await createBusinessQuick({
        name,
        description: description || undefined,
      })
      if (result.ok) {
        setOpen(false)
        setName('')
        setDescription('')
        router.push(`/tenants/business-profile?businessId=${result.data.id}`)
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <>
      <Button type="button" size="sm" variant="default" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-1" />
        Add business
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add business</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div>
              <Label htmlFor="biz-name">Name</Label>
              <Input
                id="biz-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sudotechserve"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="biz-desc">Description (optional)</Label>
              <Textarea
                id="biz-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="mt-1"
                placeholder="Short note about this brand…"
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button onClick={handleSubmit} disabled={isPending || !name.trim()}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
