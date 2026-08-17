'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, Check, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { WizardStepDef } from './types'

type Props = {
  steps: WizardStepDef[]
  currentIndex: number
  completedIds: string[]
  isSubmitting: boolean
  validationError: string | null
  onBack: () => void
  onNext: () => void
  children: React.ReactNode
  completeLabel?: string
}

/** Visual shell matching the product/webinar MultiStepForm design. */
export function WorkspaceWizardShell({
  steps,
  currentIndex,
  completedIds,
  isSubmitting,
  validationError,
  onBack,
  onNext,
  children,
  completeLabel = 'Complete',
}: Props) {
  const currentStep = steps[currentIndex]
  const isFirstStep = currentIndex === 0
  const isLastStep = currentIndex === steps.length - 1

  if (!currentStep) return null

  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center justify-center overflow-hidden rounded-3xl border border-border bg-[#27272A]/20 backdrop-blur-[106px]">
      <div className="flex w-full flex-col items-start justify-start md:flex-row">
        <div className="w-full border-b border-border p-4 md:w-1/3 md:border-b-0 md:border-r md:p-6">
          <div className="space-y-6">
            {steps.map((step, index) => {
              const isCompleted = completedIds.includes(step.id)
              const isCurrent = index === currentIndex
              const isPast = index < currentIndex
              return (
                <div key={step.id} className="relative">
                  <div className="flex items-start gap-4">
                    <div className="relative">
                      <motion.div
                        initial={false}
                        animate={{
                          backgroundColor:
                            isCurrent && !isCompleted ? 'rgb(147,51,234)' : 'rgb(31, 41, 55)',
                          scale: [isCurrent && !isCompleted ? 0.8 : 1, 1],
                          transition: { duration: 0.3 },
                        }}
                        className="z-10 flex h-8 w-8 items-center justify-center rounded-full"
                      >
                        <AnimatePresence mode="wait">
                          {isCompleted ? (
                            <motion.div
                              key="check"
                              initial={{ opacity: 0, scale: 0.5 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.5 }}
                            >
                              <Check className="h-5 w-5 text-white" />
                            </motion.div>
                          ) : (
                            <motion.div
                              key="number"
                              initial={{ opacity: 0, scale: 0.5 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.5 }}
                              className="text-sm text-white/80"
                            >
                              {index + 1}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                      {index < steps.length - 1 && (
                        <div className="absolute top-8 left-4 h-12 w-0.5 overflow-hidden bg-gray-700 md:h-16">
                          <motion.div
                            initial={{ height: isPast || isCompleted ? '100%' : '0%' }}
                            animate={{
                              height: isPast || isCompleted ? '100%' : '0%',
                              backgroundColor: 'rgb(147,51,234)',
                            }}
                            transition={{ duration: 0.5, ease: 'easeInOut' }}
                            className="h-full w-full"
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 pt-1">
                      <motion.h3
                        animate={{
                          color:
                            isCurrent || isCompleted ? 'rgb(255,255,255)' : 'rgb(156, 163, 175)',
                        }}
                        className="text-sm font-medium md:text-base"
                      >
                        {step.title}
                      </motion.h3>
                      <p className="mt-0.5 text-xs text-gray-500 md:text-sm">{step.description}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <Separator
          orientation="vertical"
          className="hidden data-[orientation=vertical]:h-auto md:block"
        />

        <div className="w-full md:w-2/3">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep.id}
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="w-full p-4 md:p-6"
            >
              <div className="mb-4 md:mb-6">
                <h2 className="text-lg font-semibold md:text-xl">{currentStep.title}</h2>
                <p className="text-sm text-gray-400 md:text-base">{currentStep.description}</p>
              </div>
              <div className="w-full">{children}</div>
              {validationError ? (
                <div className="mt-4 flex items-start gap-2 rounded-md border border-red-800 bg-red-900/30 p-3 text-red-300">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                  <p>{validationError}</p>
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="flex w-full flex-col justify-between gap-3 border-t border-border p-4 sm:flex-row sm:gap-0 md:p-6">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={isSubmitting}
          className={cn(
            'w-full border-gray-700 text-white hover:bg-gray-800 sm:w-auto',
            isFirstStep && 'opacity-50',
          )}
        >
          {isFirstStep ? 'Cancel' : 'Back'}
        </Button>
        <Button onClick={onNext} disabled={isSubmitting} className="w-full sm:w-auto">
          {isLastStep ? (
            isSubmitting ? (
              <>
                <Loader2 className="mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              completeLabel
            )
          ) : (
            <>
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

export function useWizardNavigation(stepCount: number) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [completedIds, setCompletedIds] = useState<string[]>([])
  return { currentIndex, setCurrentIndex, completedIds, setCompletedIds, stepCount }
}
