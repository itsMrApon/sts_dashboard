import { getProjectbyId } from '@/actions/webiner'
import { getLiveKitAgentById } from '@/actions/livekitAgent'
import { onAuthenticateUser } from '@/actions/auth'
import React from 'react'
import { redirect } from 'next/navigation'
import RenderProduct from './_components/RenderProduct'
import { WebinarWithPresenter } from '@/lib/type'
import { CtaTypeEnum } from '@prisma/client'
import CreatorProductInbox from './_components/CreatorProductInbox'

type Props = {
  params: Promise<{ liveProductId: string }>
  searchParams: Promise<{ error?: string }>
}

export default async function LiveProductPage({ params, searchParams }: Props) {
  const [{ liveProductId }, { error = '' }] = await Promise.all([params, searchParams])

  const [product, checkUser] = await Promise.all([
    getProjectbyId(liveProductId),
    onAuthenticateUser(),
  ])

  if (!product) {
    return (
      <div className="w-full min-h-screen flex justify-center items-center text-lg sm:text-4xl">
        Product not found
      </div>
    )
  }

  const ctaType = product.ctaType as CtaTypeEnum
  const isBookACall = ctaType === CtaTypeEnum.BOOK_A_CALL
  const isBuyNow = ctaType === CtaTypeEnum.BUY_NOW

  if (!isBookACall && !isBuyNow) {
    redirect(`/live-project/${liveProductId}`)
  }

  // If the creator is signed-in and viewing a BOOK_A_CALL product,
  // show creator inbox/history view (customers still see name/email landing).
  const user = checkUser.user || null
  const isCreator = !!user && user.id === product.presenterId
  if (isCreator && isBookACall) {
    return (
      <div className="w-full min-h-screen mx-auto bg-background">
        <CreatorProductInbox product={product as WebinarWithPresenter} />
      </div>
    )
  }

  let livekitRoomName: string | null = null
  let livekitAssistantName: string | null = null

  if (isBookACall) {
    const livekitAgentId = (product as { livekitAgentId?: string | null }).livekitAgentId
    const hasAiAgent = product.aiAgentId || livekitAgentId
    if (!hasAiAgent) {
      return (
        <div className="w-full min-h-screen flex justify-center items-center text-lg">
          This product has no AI agent configured for the 1:1 call.
        </div>
      )
    }
    if (livekitAgentId) {
      const res = await getLiveKitAgentById(livekitAgentId)
      if (res.success && res.data?.roomName) {
        livekitRoomName = res.data.roomName
        livekitAssistantName = res.data.name ?? 'Assistant'
      }
    }
  }

  return (
    <div className="w-full min-h-screen mx-auto bg-background">
      <RenderProduct
        error={error}
        user={user}
        product={product as WebinarWithPresenter}
        livekitRoomName={livekitRoomName}
        livekitAssistantName={livekitAssistantName}
        ctaType={ctaType}
      />
    </div>
  )
}

