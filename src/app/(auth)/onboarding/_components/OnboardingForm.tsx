'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createMyBusiness } from '@/actions/business'
import { WizardGem } from '@/components/wizard/WizardGem'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export function OnboardingForm({ defaultName }: { defaultName: string }) {
  const router = useRouter()
  const [name, setName] = useState(defaultName)
  const [description, setDescription] = useState('')
  const [isPending, startTransition] = useTransition()

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) {
      toast.error('Enter your business name')
      return
    }
    startTransition(async () => {
      const result = await createMyBusiness({ name, description })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      router.replace('/messages')
      router.refresh()
    })
  }

  return (
    <form
      onSubmit={submit}
      className="flex w-full max-w-md flex-col items-center gap-6 rounded-3xl border border-border bg-card/70 p-8 text-center"
    >
      <WizardGem theme="aurora" shape="circle" size={96} />
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">What&apos;s your business called?</h1>
        <p className="text-sm text-muted-foreground">
          One business, one AI. Chat AI, Speak AI, Form and Wizard all run from it on your website.
        </p>
      </div>
      <div className="w-full space-y-4 text-left">
        <div className="space-y-2">
          <Label htmlFor="business-name">Business name</Label>
          <Input
            id="business-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Prime One Insurance"
            maxLength={120}
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="business-description">What do you do? (optional)</Label>
          <Textarea
            id="business-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="One or two lines — your AI uses this to answer visitors."
            maxLength={500}
            rows={3}
          />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Create my business
      </Button>
    </form>
  )
}
