'use client'

import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useState } from 'react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { createAssistant } from '@/actions/vapi'
import { createLiveKitAgent } from '@/actions/livekitAgent'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'

type AssistantType = 'vapi' | 'livekit'

type Props = {
  isOpen: boolean
  onClose: () => void
}

const CreateAssistantModal = ({ isOpen, onClose }: Props) => {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [assistantType, setAssistantType] = useState<AssistantType>('vapi')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (assistantType === 'vapi') {
        const res = await createAssistant(name)
        if (!res.success) {
          throw new Error((res as { error?: string }).error || 'Failed to create Vapi assistant')
        }
        toast.success('Vapi assistant created successfully.')
      } else {
        const res = await createLiveKitAgent(name)
        if (!res.success) {
          throw new Error(res.error || 'Failed to create LiveKit agent')
        }
        toast.success('LiveKit assistant created successfully.')
      }
      router.refresh()
      setName('')
      onClose()
    } catch (error) {
      toast.error('Failed to create assistant. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-muted/80 border border-input shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Create Assistant
          </DialogTitle>
        </DialogHeader>
        <DialogClose className="absolute right-4 top-4 text-neutral-400 hover:text-white" />
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-neutral-400 mb-2">
              Assistant Type
            </label>
            <Tabs
              value={assistantType}
              onValueChange={(v) => setAssistantType(v as AssistantType)}
              className="w-full"
            >
              <TabsList className="w-full bg-neutral-800">
                <TabsTrigger value="vapi" className="flex-1">
                  Vapi
                </TabsTrigger>
                <TabsTrigger value="livekit" className="flex-1">
                  LiveKit
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="mb-6">
            <label htmlFor="name" className="block text-sm font-medium text-neutral-400">
              Assistant Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Assistant Name"
              className="bg-neutral-800 border-neutral-700"
              required
            />
            <p className="text-xs text-neutral-400 mt-2">
              This name will be used to identify your assistant.
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={onClose} variant="outline">
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Assistant'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
export default CreateAssistantModal
