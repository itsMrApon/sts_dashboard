'use client'

import { CtaTypeEnum, User } from '@prisma/client'
import { WebinarWithPresenter } from '@/lib/type'
import React, { useEffect, useState } from 'react'
import { useAttendeeStore } from '@/store/useAttendeeStore'
import { toast } from 'sonner'
import ProductLanding from './ProductLanding'
import ProductExperience from './ProductExperience'
import BuyNowRedirect from './BuyNowRedirect'

type Props = {
  error: string | undefined
  user: User | null
  product: WebinarWithPresenter
  livekitRoomName: string | null
  livekitAssistantName: string | null
  ctaType: CtaTypeEnum
}

export default function RenderProduct({
  error,
  user,
  product,
  livekitRoomName,
  livekitAssistantName,
  ctaType,
}: Props) {
  const { attendee, enteredProductId } = useAttendeeStore()
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    if (error) {
      toast.error(error)
    }
  }, [error])

  const showExperience = attendee && (entered || enteredProductId === product.id)

  if (showExperience && attendee) {
    if (ctaType === CtaTypeEnum.BUY_NOW) {
      return <BuyNowRedirect product={product} attendee={attendee} />
    }
    return (
      <ProductExperience
        user={user}
        product={product}
        attendee={attendee}
        livekitRoomName={livekitRoomName}
        livekitAssistantName={livekitAssistantName}
      />
    )
  }

  return (
    <ProductLanding
      product={product}
      onEnter={() => setEntered(true)}
    />
  )
}
