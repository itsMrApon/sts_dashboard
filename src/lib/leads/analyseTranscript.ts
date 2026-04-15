export type TranscriptMessage = {
  role: string
  text: string
  timestamp?: string
}

export type TranscriptAnalysis = {
  summary: string
  objections: string[]
  outcome: 'converted' | 'follow_up' | 'lost' | 'unknown'
  sentiment: 'positive' | 'neutral' | 'negative'
}

const POSITIVE_KEYWORDS = ['interested', 'great', 'good', 'yes', 'buy', 'purchase', 'ready']
const NEGATIVE_KEYWORDS = ['not interested', 'no', 'later', 'expensive', 'costly', 'budget', 'stop']
const CONVERTED_KEYWORDS = ['paid', 'payment', 'order placed', 'booked', 'confirmed', 'converted']
const FOLLOW_UP_KEYWORDS = ['follow up', 'call later', 'next week', 'tomorrow', 'send details']
const LOST_KEYWORDS = ['not now', 'not interested', 'do not call', 'cancel']

function includesAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word))
}

export async function analyseTranscript(
  transcript: TranscriptMessage[],
): Promise<TranscriptAnalysis> {
  if (!transcript.length) {
    return { summary: 'No transcript available.', objections: [], outcome: 'unknown', sentiment: 'neutral' }
  }

  const normalized = transcript.map((m) => ({
    ...m,
    text: m.text.trim(),
    lower: m.text.toLowerCase(),
  }))

  const combined = normalized.map((m) => m.lower).join(' ')
  const customerMessages = normalized.filter((m) => m.role.toLowerCase() !== 'agent')
  const objections = customerMessages
    .map((m) => m.text)
    .filter(
      (line) =>
        includesAny(line.toLowerCase(), ['price', 'budget', 'expensive', 'later', 'busy', 'not now']) &&
        line.length > 6,
    )
    .slice(0, 5)

  let outcome: TranscriptAnalysis['outcome'] = 'unknown'
  if (includesAny(combined, CONVERTED_KEYWORDS)) outcome = 'converted'
  else if (includesAny(combined, LOST_KEYWORDS)) outcome = 'lost'
  else if (includesAny(combined, FOLLOW_UP_KEYWORDS)) outcome = 'follow_up'

  let sentiment: TranscriptAnalysis['sentiment'] = 'neutral'
  if (includesAny(combined, POSITIVE_KEYWORDS)) sentiment = 'positive'
  if (includesAny(combined, NEGATIVE_KEYWORDS)) sentiment = sentiment === 'positive' ? 'neutral' : 'negative'

  const firstUser = customerMessages[0]?.text
  const lastUser = customerMessages.at(-1)?.text
  const summaryParts = [
    firstUser ? `Started with: "${firstUser.slice(0, 120)}"` : 'Lead conversation captured.',
    lastUser ? `Latest customer response: "${lastUser.slice(0, 120)}"` : null,
    `Detected outcome: ${outcome}.`,
  ].filter(Boolean)

  return {
    summary: summaryParts.join(' '),
    objections,
    outcome,
    sentiment,
  }
}
