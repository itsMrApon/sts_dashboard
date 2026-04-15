'use client'

import { registerAttendee } from '@/actions/attendance'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAttendeeStore } from '@/store/useAttendeeStore'
import { Loader2 } from 'lucide-react'
import React, { useState } from 'react'
import { toast } from 'sonner'
import { WebinarWithPresenter } from '@/lib/type'
import { Attendee } from '@prisma/client'

type Props = {
  product: WebinarWithPresenter
  onEnter: () => void
}

export default function ProductLanding({ product, onEnter }: Props) {
  const { setAttendee, setEnteredProductId, attendee: storedAttendee } = useAttendeeStore()
  const [name, setName] = useState(storedAttendee?.name ?? '')
  const [email, setEmail] = useState(storedAttendee?.email ?? '')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim()) {
      toast.error('Name and email are required')
      return
    }
    setIsSubmitting(true)
    try {
      const res = await registerAttendee({
        projectId: product.id,
        email: email.trim(),
        name: name.trim(),
      })
      const data = res as { success?: boolean; data?: { user?: { id: string; name: string; email: string } }; message?: string }
      const attendee = data.data?.user
      if (attendee) {
        setAttendee(attendee as Attendee)
        setEnteredProductId(product.id)
        toast.success(res.success ? 'You’re in. Starting your experience…' : 'Welcome back.')
        onEnter()
      } else {
        toast.error(data.message ?? 'Registration failed')
      }
    } catch (err) {
      console.error(err)
      toast.error('Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
        <h1 className="text-xl font-semibold text-primary mb-1">{product.title}</h1>
        {product.description && (
          <p className="text-sm text-muted-foreground mb-6">{product.description}</p>
        )}
        <p className="text-sm text-muted-foreground mb-4">
          Enter your details to start a 1:1 call with the AI and chat. You can purchase at any time.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="product-name">Name</Label>
            <Input
              id="product-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="bg-background border-border"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-email">Email</Label>
            <Input
              id="product-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="bg-background border-border"
              required
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting…
              </>
            ) : (
              'Start 1:1 with AI'
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
