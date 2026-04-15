'use client'

import { GenericPlatformCard } from './GenericPlatformCard'
import type { MessageChannel } from '@prisma/client'

type Props = {
  roomName: string
  channel: MessageChannel | null
}

export const WhatsAppCard = ({ roomName, channel }: Props) => {
  return (
    <GenericPlatformCard
      roomName={roomName}
      platform="WHATSAPP"
      channel={channel}
      description="Connect your WhatsApp Business account to send outreach messages and receive replies through the Meta Business API."
      labelField="Account name"
      fields={[
        {
          key: 'phoneNumberId',
          label: 'Phone Number ID',
          placeholder: 'From Meta Business dashboard',
        },
        {
          key: 'accessToken',
          label: 'Permanent Access Token',
          placeholder: 'Meta Business access token',
        },
      ]}
    />
  )
}
