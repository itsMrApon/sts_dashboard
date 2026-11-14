'use client'

import type { Ref } from 'react'
import type { PublicWizard } from '@/lib/wizard/types'
import { WizardTour, type WizardTourControl } from '@/app/(publicRoutes)/wizard/[slug]/_components/WizardTour'

export type OfferTourControl = WizardTourControl

type Props = {
  /** The tour the creator picked for this offer (Ways to order → AI sales assistant). */
  wizard: PublicWizard
  onOrderRequested: () => void
  controlRef?: Ref<OfferTourControl>
  /** Called when narration starts, so the voice call can stop (one voice at a time). */
  onPlay?: () => void
}

/** Guided tour panel on the share page: the creator's wizard, ending in Continue to payment. */
export function OfferTour({ wizard, onOrderRequested, controlRef, onPlay }: Props) {
  return (
    <WizardTour
      wizard={wizard}
      embedded
      controlRef={controlRef}
      onPlay={onPlay}
      orderAction={{ label: 'Continue to payment', onClick: onOrderRequested }}
    />
  )
}
