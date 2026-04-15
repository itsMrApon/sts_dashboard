import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prismaClient } from '@/lib/prismaClient'
import { decryptToken } from '@/lib/messages/encrypt'
import { Platform } from '@prisma/client'

type WebhookInfo = {
  ok?: boolean
  result?: {
    url?: string
    has_custom_certificate?: boolean
    pending_update_count?: number
    last_error_date?: number
    last_error_message?: string
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ roomName: string }> },
) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { roomName } = await params

  const channel = await prismaClient.messageChannel.findUnique({
    where: {
      roomName_platform: { roomName, platform: Platform.TELEGRAM },
    },
  })

  if (!channel || !channel.telegramBotToken) {
    return NextResponse.json({
      healthy: false,
      error: 'No Telegram channel configured for this room',
      fix: 'Go to Messages → select agent → connect Telegram with a bot token',
    }, { status: 200 })
  }

  let token: string | null = null
  try {
    token = decryptToken(channel.telegramBotToken)
  } catch {
    return NextResponse.json({
      healthy: false,
      error: 'Failed to decrypt bot token. ENCRYPTION_KEY may have changed since the token was saved.',
      fix: 'Reconnect your Telegram bot: disconnect and re-enter the token',
    }, { status: 200 })
  }

  if (!token) {
    return NextResponse.json({
      healthy: false,
      error: 'Bot token decrypted to empty string',
      fix: 'Reconnect your Telegram bot with a valid token from @BotFather',
    }, { status: 200 })
  }

  const recentConversation = await prismaClient.messageConversation.findFirst({
    where: {
      channelId: channel.id,
      updatedAt: { gte: new Date(Date.now() - 30 * 60 * 1000) },
    },
    select: { updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  })

  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
    const info = (await resp.json()) as WebhookInfo

    if (!info.ok || !info.result) {
      return NextResponse.json({
        healthy: false,
        error: 'Could not reach Telegram API — bot token may be invalid or revoked',
        fix: 'Check your bot token in @BotFather and reconnect',
        raw: info,
      }, { status: 200 })
    }

    const webhookUrl = info.result.url || ''
    const expectedBase = process.env.NEXT_PUBLIC_APP_URL || ''
    const expectedUrl = `${expectedBase.replace(/\/$/, '')}/api/webhook/telegram/${encodeURIComponent(roomName)}`

    const urlMatches = webhookUrl === expectedUrl
    const lastErrorDate = info.result.last_error_date
      ? new Date(info.result.last_error_date * 1000)
      : null
    const lastErrorMsg = info.result.last_error_message || null
    const pendingUpdates = info.result.pending_update_count || 0

    const isErrorRecent = lastErrorDate
      ? Date.now() - lastErrorDate.getTime() < 5 * 60 * 1000
      : false

    const messagesFlowing = !!recentConversation

    const issues: string[] = []
    const fixes: string[] = []

    if (!webhookUrl) {
      issues.push('No webhook URL is set on Telegram')
      fixes.push('Disconnect and reconnect your Telegram bot to re-set the webhook')
    } else if (!urlMatches) {
      if (messagesFlowing) {
        // URL doesn't match exactly but messages are coming through — likely a minor encoding difference
      } else {
        issues.push(`Webhook URL mismatch. Telegram has: ${webhookUrl} — Expected: ${expectedUrl}`)
        fixes.push('Your ngrok URL likely changed. Disconnect and reconnect Telegram to set the new webhook URL')
      }
    }

    if (lastErrorMsg && isErrorRecent) {
      issues.push(`Telegram error (${lastErrorDate?.toLocaleTimeString()}): ${lastErrorMsg}`)
      if (lastErrorMsg.includes('Wrong response from the webhook')) {
        fixes.push('The webhook endpoint returned an error. Check your server logs')
      }
      if (lastErrorMsg.includes('Connection refused') || lastErrorMsg.includes('timed out')) {
        fixes.push('Telegram cannot reach your server. Ensure ngrok is running and NEXT_PUBLIC_APP_URL is correct')
      }
    }

    if (!expectedBase) {
      issues.push('NEXT_PUBLIC_APP_URL is not set in .env')
      fixes.push('Add NEXT_PUBLIC_APP_URL=https://your-ngrok-url.ngrok-free.dev to .env')
    }

    const apiKeySet = !!process.env.GOOGLE_API_KEY
    if (!apiKeySet) {
      issues.push('GOOGLE_API_KEY is missing — bot will not generate AI replies')
      fixes.push('Add your Google Gemini API key to .env as GOOGLE_API_KEY')
    }

    const healthy = issues.length === 0

    return NextResponse.json({
      healthy,
      status: healthy
        ? messagesFlowing ? 'Working — messages flowing' : 'Configured — waiting for messages'
        : 'Issues detected',
      webhookUrl,
      expectedUrl,
      urlMatches,
      messagesFlowing,
      lastActivity: recentConversation?.updatedAt || null,
      pendingUpdates,
      lastTelegramError: lastErrorMsg,
      lastErrorAge: lastErrorDate
        ? `${Math.round((Date.now() - lastErrorDate.getTime()) / 60000)} minutes ago`
        : null,
      isErrorRecent,
      googleApiKeySet: apiKeySet,
      issues,
      fixes,
    }, { status: 200 })
  } catch (err) {
    return NextResponse.json({
      healthy: false,
      error: `Failed to contact Telegram API: ${err instanceof Error ? err.message : String(err)}`,
      fix: 'Check your internet connection and bot token validity',
    }, { status: 200 })
  }
}
