'use client'

import { GenericPlatformCard } from './GenericPlatformCard'
import type { MessageChannel } from '@prisma/client'

type Props = {
  roomName: string
  channel: MessageChannel | null
}

export const InstagramCard = ({ roomName, channel }: Props) => {
  return (
    <GenericPlatformCard
      roomName={roomName}
      platform="INSTAGRAM"
      channel={channel}
      description="Connect your Instagram Business account to automate DM responses and manage conversations through the Instagram Graph API."
      labelField="Account handle"
      fields={[
        {
          key: 'accountId',
          label: 'Instagram Account ID',
          placeholder: 'From Instagram Business settings',
          type: 'text',
        },
        {
          key: 'accessToken',
          label: 'Access Token',
          placeholder: 'Long-lived Instagram token',
        },
      ]}
    />
  )
}
