'use client'

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { useStsStore } from '@/store/useStsStore'
import { DialogTrigger } from '@radix-ui/react-dialog'
import { PlusIcon } from 'lucide-react'
import React, { useState } from 'react'
import MultiStepForm from './MultiStepForm'
import TypeStep from './TypeStep'
import BasicInfoStep from './BasicInfoStep'
import CTAStep from './CTAStep'
import AdditionalInfostep from './AdditionalInfostep'
import type Stripe from 'stripe'
import SuccessStep from './SuccessStep'
import { Assistant } from '@vapi-ai/server-sdk/api'
import type { LiveKitUiAgentConfig } from '@/lib/livekit/livekitTypes'

type Props = {
  stripeProducts: Stripe.Product[] | []
  assistants: Assistant[] | []
  livekitAgents?: LiveKitUiAgentConfig[]
}

const CreateWebinarButton = ({ stripeProducts, assistants, livekitAgents = [] }: Props) => {
  const { isModalOpen, setModalOpen, isComplete, setComplete, resetForm, formData } = useStsStore()

  const [projectLink, setProjectLink] = useState('')

  const steps = [
    {
      id: 'type',
      title: 'Type',
      description: 'Choose whether you want to create a project or a product',
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
    const kind = formData.basicInfo.kind || 'project'
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || ''
    const path =
      kind === 'product'
        ? `/live-product/${webinarid}`
        : `/live-project/${webinarid}`
    setProjectLink(`${baseUrl}${path}`)
  }
  const handleCreateNew = () => {
    resetForm()
  }


  return (
    <Dialog 
    open={isModalOpen} 
    onOpenChange={setModalOpen}
    > 
    <DialogTrigger asChild>
      <button
        className="rounded-xl flex gap-2 items-center hover: cursor-pointer px-4 py-2 border border-border bg-primary/10 backdrop-blur-sm text-sm font-normal text-primary hover:bg-primary-20"
        onClick={() => setModalOpen(true)}
      >
        <PlusIcon />
        Create Project
      </button>
    </DialogTrigger>
    <DialogContent className="max-w-[95vw] sm:max-w-[900px] p-0 bg-transparent border-none overflow-y-auto max-h-[95vh]">
      {isComplete ? (
        <div className="bg-muted text-primary rounded-lg overflow-hidden">
        <DialogTitle className="sr-only">Project Created </DialogTitle>
        <SuccessStep
          projectLink={projectLink} 
          onCreateNew={handleCreateNew}
        />
      </div>
    ) : (
    <>
      <DialogTitle className="sr-only">Create Video</DialogTitle>
      <MultiStepForm
      steps={steps}
      onComplete={handleComplete}
      />

    </>
      )}
    </DialogContent>
    </Dialog>

  )
}

export default CreateWebinarButton