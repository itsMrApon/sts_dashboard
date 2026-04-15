'use client'

import { GenericPlatformCard } from './GenericPlatformCard'
import type { MessageChannel } from '@prisma/client'

type Props = {
  roomName: string
  channel: MessageChannel | null
}

export const YouTubeCard = ({ roomName, channel }: Props) => {
  return (
    <GenericPlatformCard
      roomName={roomName}
      platform="YOUTUBE"
      channel={channel}
      description="Connect your YouTube channel to automate comment replies and community post engagement using the YouTube Data API."
      labelField="Channel name"
      fields={[
        {
          key: 'channelId',
          label: 'Channel ID',
          placeholder: 'UC... from your channel URL',
          type: 'text',
        },
        {
          key: 'apiKey',
          label: 'API Key',
          placeholder: 'From Google Cloud Console',
        },
      ]}
    />
  )
}
