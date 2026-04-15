'use client'

import { GenericPlatformCard } from './GenericPlatformCard'
import type { MessageChannel } from '@prisma/client'

type Props = {
  roomName: string
  channel: MessageChannel | null
}

export const FacebookMessengerCard = ({ roomName, channel }: Props) => {
  return (
    <GenericPlatformCard
      roomName={roomName}
      platform="FACEBOOK_MESSENGER"
      channel={channel}
      description="Connect your Facebook Page to send and receive Messenger conversations through the Meta Graph API."
      labelField="Page name"
      fields={[
        {
          key: 'pageId',
          label: 'Page ID',
          placeholder: 'From Facebook Page settings',
          type: 'text',
        },
        {
          key: 'pageAccessToken',
          label: 'Page Access Token',
          placeholder: 'Long-lived token from Graph API Explorer',
        },
      ]}
    />
  )
}
