import { ChannelStatus, type MessageChannel } from '@prisma/client'

export function platformChannelStatus(
  record: Pick<MessageChannel, 'status'> | null | undefined,
): 'active' | 'inactive' | 'error' {
  if (!record) return 'inactive'
  if (record.status === ChannelStatus.ERROR) return 'error'
  if (record.status === ChannelStatus.ACTIVE) return 'active'
  return 'inactive'
}
