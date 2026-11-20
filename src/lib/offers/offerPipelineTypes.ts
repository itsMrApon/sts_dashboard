/** Client-safe shapes for the offer pipeline (/projects/[id]/pipeline). */

export type PipelineOrderStatus = 'PENDING' | 'DEPOSIT_PAID' | 'PAID' | 'REFUNDED' | 'FAILED' | 'CANCELED'

export type PipelinePerson = {
  /** Contact id, or `attendee:<id>` for someone known only from an older waitlist sign-up. */
  key: string
  contactId: string | null
  name: string
  email: string | null
  phone: string | null
  /** Where they first came from (?src= tag, "live", "link"). */
  source: string | null
  /** ISO string: when they registered on this offer (share link or Live link). */
  registeredAt: string | null
  /** ISO string: latest of registration, chat, call and order. */
  lastActivityAt: string
  chat: { count: number; updatedAt: string; lastMessage: string | null; fromBuyerLast: boolean } | null
  voiceCalls: number
  order: { status: PipelineOrderStatus; amountPaidCents: number; amountTotalCents: number } | null
}

export type PipelineView = {
  offer: {
    id: string
    title: string
    slug: string | null
    businessName: string
    /** The offer has an AI agent, so buyers can chat and the creator can reply. */
    canChat: boolean
  }
  people: PipelinePerson[]
}

export type PipelineMessage = {
  role: 'user' | 'assistant'
  content: string
  from?: 'creator'
  timestamp?: string
}

export type PipelineCall = {
  id: string
  /** ISO string */
  createdAt: string
  durationSec: number
  summary: string | null
  outcome: string | null
  lines: { role: 'user' | 'agent'; text: string }[]
}

export type PipelineThread = {
  messages: PipelineMessage[]
  calls: PipelineCall[]
  /** A person has taken over this chat: the AI stays quiet until handed back. */
  aiPaused: boolean
}

/** A chat touched in the last two minutes counts as "chatting now". */
export const CHATTING_NOW_MS = 2 * 60 * 1000
