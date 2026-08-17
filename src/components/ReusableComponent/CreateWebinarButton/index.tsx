'use client'

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { useStsStore } from '@/store/useStsStore'
import { DialogTrigger } from '@radix-ui/react-dialog'
import { PlusIcon } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import MultiStepForm from './MultiStepForm'
import TypeStep from './TypeStep'
import BasicInfoStep from './BasicInfoStep'
import CTAStep from './CTAStep'
import AdditionalInfostep from './AdditionalInfostep'
import type Stripe from 'stripe'
import SuccessStep from './SuccessStep'
import { Assistant } from '@vapi-ai/server-sdk/api'
import type { LiveKitUiAgentConfig } from '@/lib/livekit/livekitTypes'
import { buildVariantLinks, sanitizeVariants } from '@/lib/webinarLinkVariants'

type Props = {
  stripeProducts: Stripe.Product[] | []
  assistants: Assistant[] | []
  livekitAgents?: LiveKitUiAgentConfig[]
  hideTrigger?: boolean
  autoOpenIntent?: 'product' | 'webinar'
  preferredTenantId?: string
}

const CreateWebinarButton = ({
  stripeProducts,
  assistants,
  livekitAgents = [],
  hideTrigger = false,
  autoOpenIntent,
  preferredTenantId,
}: Props) => {
  const {
    isModalOpen,
    setModalOpen,
    isComplete,
    setComplete,
    resetForm,
    formData,
    setSelectedVariants,
  } = useStsStore()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const selectedTenantId = preferredTenantId || searchParams.get('tenantId') || undefined

  const [projectLinks, setProjectLinks] = useState<Array<{ label: string; url: string }>>([])
  const [autoOpened, setAutoOpened] = useState(false)

  useEffect(() => {
    if (!autoOpenIntent || autoOpened) return
    resetForm()
    setComplete(false)
    setSelectedVariants(
      autoOpenIntent === 'product' ? ['PRODUCT_BOOK_A_CALL'] : ['PROJECT_BOOK_A_CALL'],
    )
    setModalOpen(true)
    setAutoOpened(true)

    const next = new URLSearchParams(searchParams.toString())
    next.delete('intent')
    next.delete('openAdd')
    router.replace(`${pathname}${next.toString() ? `?${next.toString()}` : ''}`)
  }, [
    autoOpenIntent,
    autoOpened,
    pathname,
    resetForm,
    router,
    searchParams,
    setComplete,
    setModalOpen,
    setSelectedVariants,
  ])

  const steps = [
    {
      id: 'type',
      title: 'Type',
      description: 'Select one or more destination link options for your project',
      component: <TypeStep />,
    },
    {
      id: 'basicInfo', 
      title: 'Basic Information', 
      description: 'Please fill out the standard info needed for your project', component: <BasicInfoStep />,
    },
    {
      id: 'cta',
      title: 'CTA',
      description: 'Please provide the end-point for your customers through your chat',
      component: (
        <CTAStep
          assistants={assistants}
          livekitAgents={livekitAgents}
          stripeProducts={stripeProducts}
        />
      ),
    },
    {
      id: 'additionalInfo', 
      title: 'Additional information', 
      description: 'Please fill out information about additional options if necessary',
      component: <AdditionalInfostep />,
    },
  ]  
  const handleComplete = (webinarid: string) => {
    setComplete(true)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || ''
    const selectedVariants = sanitizeVariants(formData.basicInfo.selectedVariants)
    setProjectLinks(buildVariantLinks(webinarid, selectedVariants, baseUrl))
  }
  const handleCreateNew = () => {
    resetForm()
  }


  return (
    <Dialog 
    open={isModalOpen} 
    onOpenChange={setModalOpen}
    > 
    {!hideTrigger ? (
      <DialogTrigger asChild>
        <button
          className="rounded-xl flex gap-2 items-center hover: cursor-pointer px-4 py-2 border border-border bg-primary/10 backdrop-blur-sm text-sm font-normal text-primary hover:bg-primary-20"
          onClick={() => setModalOpen(true)}
        >
          <PlusIcon />
          Add to workspace
        </button>
      </DialogTrigger>
    ) : null}
    <DialogContent className="max-w-[95vw] sm:max-w-[900px] p-0 bg-transparent border-none overflow-y-auto max-h-[95vh]">
      {isComplete ? (
        <div className="bg-muted text-primary rounded-lg overflow-hidden">
        <DialogTitle className="sr-only">Project Created </DialogTitle>
        <SuccessStep
          links={projectLinks} 
          onCreateNew={handleCreateNew}
        />
      </div>
    ) : (
    <>
      <DialogTitle className="sr-only">Create Video</DialogTitle>
      <MultiStepForm
      steps={steps}
      onComplete={handleComplete}
      tenantId={selectedTenantId}
      />

    </>
      )}
    </DialogContent>
    </Dialog>

  )
}

export default CreateWebinarButton