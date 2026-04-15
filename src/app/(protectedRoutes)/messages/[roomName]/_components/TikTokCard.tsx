'use client'

import { GenericPlatformCard } from './GenericPlatformCard'
import type { MessageChannel } from '@prisma/client'

type Props = {
  roomName: string
  channel: MessageChannel | null
}

export const TikTokCard = ({ roomName, channel }: Props) => {
  return (
    <GenericPlatformCard
      roomName={roomName}
      platform="TIKTOK"
      channel={channel}
      description="Connect your TikTok for Business account to manage comments and inbox messages through the TikTok Content API."
      labelField="Account name"
      fields={[
        {
          key: 'openId',
          label: 'Open ID',
          placeholder: 'From TikTok for Developers portal',
          type: 'text',
        },
        {
          key: 'accessToken',
          label: 'Access Token',
          placeholder: 'TikTok API access token',
        },
      ]}
    />
  )
}
