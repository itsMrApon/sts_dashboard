import { Loader2, X } from 'lucide-react'
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
import { Button } from '@/components/ui/button'

type Props = {
  isOpen: boolean
  onClose: () => void
}

const CreateAssistantModal = ({ isOpen, onClose }: Props) => {  
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      // create assistant with vapi need to change it to livekit in default
      const res = await createAssistant(name)
      if (!res.success) {
        throw new Error(res.message)
      } 
      router.refresh()
      setName('')
      onClose()
      toast.success('Assistant created successfully.')
    } catch (error) {
      // console.error('Error creating assistant:', error)
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
        <DialogClose className="absolute right-4 top-4 text-neutral-400 hover:text-white">
        </DialogClose>
        <form onSubmit={handleSubmit}>
        <div className="mb-6">
          <label htmlFor="name" className="block text-sm font-medium text-neutral-400">Assistant Name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Assistant Name"
            className="bg-neutral-800 border-neutral-700"
            required
          />
          <p className="text -xs text-neutral-400 mt-2" >This name will be used to identify your assistant.</p>
        </div>
        <Button 
          type="button" 
          onClick={onClose}
          variant="outline"
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={!name.trim() || loading}
        >
          {loading ?(<>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Creating...
            </>
          ) : (
            'Create Assistant'
          )}
        </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
export default CreateAssistantModal