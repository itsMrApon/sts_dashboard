'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { createPublishProfileQuick } from '@/actions/publishProfiles'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When false, stay on current page after create (e.g. workspace console). */
  redirectOnCreate?: boolean
  onCreated?: (publishProfileId: string) => void
}

export function AddBusinessModal({
  open,
  onOpenChange,
  redirectOnCreate = true,
  onCreated,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [logo, setLogo] = useState('')
  const [error, setError] = useState('')

  const reset = () => {
    setName('')
    setDescription('')
    setLogo('')
    setError('')
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setLogo(reader.result)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = () => {
    setError('')
    startTransition(async () => {
      const result = await createPublishProfileQuick({
        name,
        description: description || undefined,
        logo: logo || undefined,
      })
      if (result.ok) {
        handleOpenChange(false)
        onCreated?.(result.data.id)
        if (redirectOnCreate) {
          router.push('/messages/publish')
        }
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
          <div>
            <Label htmlFor="biz-logo">Logo (optional)</Label>
            <Input
              id="biz-logo"
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="mt-1"
            />
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                alt="Business logo preview"
                className="mt-2 h-14 w-14 rounded-full border border-border object-cover"
              />
            ) : null}
          </div>
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          <Button onClick={handleSubmit} disabled={isPending || !name.trim()}>
            {isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
