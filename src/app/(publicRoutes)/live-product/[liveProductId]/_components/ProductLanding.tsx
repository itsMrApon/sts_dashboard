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
import { Attendee, CtaTypeEnum } from '@prisma/client'
import Image from 'next/image'

type Props = {
  product: WebinarWithPresenter
  ctaType: CtaTypeEnum
  onEnter: () => void
}

export default function ProductLanding({ product, ctaType, onEnter }: Props) {
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
    <div className="w-full min-h-screen bg-background px-4 py-10 sm:py-16">
      <div className="mx-auto flex w-full max-w-md flex-col items-center">
        <div className="w-full rounded-3xl border border-border/70 bg-card p-6 shadow-lg sm:p-7">
          <div className="mb-5 space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
              {product.title}
            </h1>
            {product.description && (
              <p className="text-sm leading-relaxed text-muted-foreground">{product.description}</p>
            )}
            <p className="pt-1 text-sm text-muted-foreground">
              {ctaType === CtaTypeEnum.BUY_NOW
                ? 'Enter your details to continue to Stripe checkout.'
                : 'Enter your details to start a 1:1 call with AI and chat. You can purchase at any time.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="mx-auto mb-5 w-full max-w-sm">
              <div className="relative aspect-[4/3] overflow-hidden rounded-3xl">
                <Image
                  src={product.thumbnail || '/darkthumbnail.png'}
                  alt={product.title}
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-name">Name</Label>
            <Input
              id="product-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="h-11 rounded-xl border-border bg-background"
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
              className="h-11 rounded-xl border-border bg-background"
              required
            />
            </div>
            <Button
              type="submit"
              className="h-11 w-full rounded-xl font-semibold"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting…
                </>
              ) : (
                ctaType === CtaTypeEnum.BUY_NOW ? 'Go to Stripe' : 'Start 1:1 with AI'
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
