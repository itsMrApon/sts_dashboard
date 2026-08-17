import {
  cleanFathomSummaryText,
  formatFathomTranscript,
  getFathomMeeting,
  type FathomActionItem,
} from '@/lib/fathom/client'
import { resolveUserGeminiApiKey } from '@/lib/leads/resolveUserLlmKey'
import { generateReply } from '@/lib/messages/geminiText'
import { decryptToken } from '@/lib/messages/encrypt'
import { prismaClient } from '@/lib/prismaClient'

type ChatTurn = { role: 'user' | 'assistant'; content: string }

function formatActionItems(items: unknown): string {
  if (!Array.isArray(items) || items.length === 0) return ''
  return items
    .map((raw) => {
      const item = raw as FathomActionItem
      const who = item.assignee?.name || item.assignee?.email || 'Unassigned'
      const done = item.completed ? ' (done)' : ''
      const desc = item.description?.trim() || ''
      return desc ? `- ${desc} — ${who}${done}` : ''
    })
    .filter(Boolean)
    .join('\n')
}

function buildMeetingChatSystemPrompt(options: {
  leadName: string
  leadEmail: string | null
  company: string | null
  recordedAt: string
  summary: string | null
  transcript: string
  actionItems: string
}): string {
  const parts = [
    'You are a meeting assistant similar to Fathom in-app chat.',
    'Answer questions about this call using ONLY the meeting context below.',
    'Be concise and specific. Quote speakers when helpful.',
    'If the answer is not in the context, say you cannot find it in this recording.',
    '',
    `Lead: ${options.leadName}`,
    options.leadEmail ? `Lead email: ${options.leadEmail}` : null,
    options.company ? `Company: ${options.company}` : null,
    `Recorded: ${options.recordedAt}`,
  ].filter(Boolean) as string[]

  if (options.summary) {
    parts.push('', '## Meeting summary', options.summary)
  }
  if (options.actionItems) {
    parts.push('', '## Action items', options.actionItems)
  }
  if (options.transcript) {
    parts.push('', '## Transcript', options.transcript)
  } else if (!options.summary) {
    parts.push('', 'No summary or transcript is available for this meeting.')
  }

  return parts.join('\n')
}

export async function askMeetingChatQuestion(options: {
  userId: string
  meetingId: string
  message: string
  history: ChatTurn[]
}): Promise<{ ok: true; reply: string } | { ok: false; error: string }> {
  const message = options.message.trim()
  if (!message) return { ok: false, error: 'Message is required' }

  const meeting = await prismaClient.callIntelMeeting.findFirst({
    where: { id: options.meetingId, userId: options.userId },
    include: {
      lead: {
        select: { name: true, email: true, company: true },
      },
    },
  })
  if (!meeting) return { ok: false, error: 'Meeting not found' }

  const geminiApiKey = await resolveUserGeminiApiKey(options.userId)
  if (!geminiApiKey) {
    return {
      ok: false,
      error:
        'Gemini API key is missing. Add it in Config Agent (/ai-agents/config).',
    }
  }

  let transcript = ''
  const conn = await prismaClient.callIntelConnection.findUnique({
    where: {
      userId_provider: { userId: options.userId, provider: 'FATHOM' },
    },
  })
  if (conn?.status === 'ACTIVE' && conn.credentials) {
    const apiKey = decryptToken(
      (conn.credentials as { apiKey?: string }).apiKey,
    )
    if (apiKey) {
      try {
        const remote = await getFathomMeeting(apiKey, meeting.fathomRecordingId, {
          include_transcript: true,
        })
        transcript = formatFathomTranscript(remote.transcript)
      } catch (err) {
        console.warn('Fathom transcript fetch failed for meeting chat', err)
      }
    }
  }

  const summary = meeting.summary
    ? cleanFathomSummaryText(meeting.summary)
    : null
  const actionItems = formatActionItems(meeting.actionItems)

  if (!summary && !transcript) {
    return {
      ok: false,
      error:
        'This meeting has no summary or transcript yet. Sync Fathom from /lead setup first.',
    }
  }

  const systemPrompt = buildMeetingChatSystemPrompt({
    leadName: meeting.lead?.name || 'Lead',
    leadEmail: meeting.lead?.email || null,
    company: meeting.lead?.company || null,
    recordedAt: meeting.recordedAt.toISOString(),
    summary,
    transcript,
    actionItems,
  })

  const result = await generateReply({
    userMessage: message,
    history: options.history,
    systemPrompt,
    apiKey: geminiApiKey,
    accountUserId: options.userId,
    usageSurface: 'leads',
  })

  if (!result.ok) return { ok: false, error: result.error }
  return { ok: true, reply: result.text }
}
