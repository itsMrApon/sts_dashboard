/** Opens the Messages panel (top right) from anywhere, optionally on one conversation. */
export const OPEN_MESSAGES_EVENT = 'sts:open-messages'

export function openMessages(threadId?: string) {
  window.dispatchEvent(new CustomEvent<string | undefined>(OPEN_MESSAGES_EVENT, { detail: threadId }))
}

/** Pass to openMessages (or ?inbox=) to start a new partner chat. */
export const NEW_PARTNER_CHAT = 'new-chat'
