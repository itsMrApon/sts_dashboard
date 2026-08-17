import { extractPartnerPrefixes } from '@/lib/partners/slashCommands'

export type PartnerTurnKind = 'pipeline' | 'partner' | 'off_topic'

export type PartnerTurn = {
  kind: PartnerTurnKind
  preferredTools: string[]
}

const PIPELINE_MARKERS =
  /(?:OUTBOUND|INBOUND)\s+PIPELINE|Active partner:\s*\w+|## Tools you should prefer/i

const PARTNER_TALK =
  /\b(n8n|medusa|madusa|erpnext|erp|chatwoot|firecrawl|workflow|webhook|automation|stock|inventory|sales?|catalog|order|invoice|pos|inbox|whatsapp|reel|youtube|drive)\b/i

const PREFERRED_TOOL_LINE = /`([a-z][a-z0-9_]+)`/gi

export const PARTNER_OFF_TOPIC_REPLY = [
  "You don't need a `/` for this.",
  'This chat is a partner pipeline, not a general assistant.',
  'Ask about n8n, Medusa, ERPNext, or Chatwoot — or copy a pipeline prompt from the Partners page.',
  'Use `/n8n`, `/medusa`, `/erpnext`, or `/chatwoot` only when you want that partner chain to run.',
].join(' ')

export function extractPreferredChainTools(message: string): string[] {
  const blockMatch = message.match(
    /## Tools you should prefer([\s\S]*?)(?:\n## |\n# |$)/i,
  )
  const haystack = blockMatch?.[1] || (PIPELINE_MARKERS.test(message) ? message : '')
  if (!haystack) return []

  const found: string[] = []
  const seen = new Set<string>()
  PREFERRED_TOOL_LINE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = PREFERRED_TOOL_LINE.exec(haystack)) !== null) {
    const name = match[1]
    if (seen.has(name)) continue
    if (!/^(n8n|medusa|erpnext|chatwoot)_/.test(name)) continue
    seen.add(name)
    found.push(name)
  }
  return found
}

const GREETING_ONLY = /^(hi|hello|hey|yo|thanks|thank you|ok|okay|okey)[.!\s]*$/i
const UNRELATED_CHAT =
  /\b(poem|poetry|weather|joke|recipe|story|homework|translate this|who are you|what is love|write (me )?code|capital of)\b/i

export function classifyPartnerTurn(options: {
  message: string
  services: string[]
}): PartnerTurn {
  const preferredTools = extractPreferredChainTools(options.message)
  const prefixes = extractPartnerPrefixes(options.message)
  const hasSlash = prefixes.length > 0
  const partnerTalk = PARTNER_TALK.test(options.message)
  const unrelated =
    GREETING_ONLY.test(options.message.trim()) ||
    (UNRELATED_CHAT.test(options.message) && !hasSlash && !partnerTalk)

  if (preferredTools.length > 0 || PIPELINE_MARKERS.test(options.message)) {
    return { kind: 'pipeline', preferredTools }
  }
  if (unrelated) {
    return { kind: 'off_topic', preferredTools: [] }
  }
  if (hasSlash || partnerTalk || options.services.length > 0) {
    return { kind: 'partner', preferredTools }
  }
  return { kind: 'off_topic', preferredTools: [] }
}
