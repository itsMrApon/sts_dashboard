'use client'

import { useTransition, useState } from 'react'
import { ChannelStatus, MessageChannel } from '@prisma/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { connectTelegram, disconnectTelegram } from '@/actions/messages'
import { AlertTriangle, CheckCircle, Loader2, Stethoscope } from 'lucide-react'

type Props = {
  roomName: string
  channel: MessageChannel | null
}

type HealthResult = {
  healthy: boolean
  status?: string
  webhookUrl?: string
  urlMatches?: boolean
  messagesFlowing?: boolean
  lastActivity?: string | null
  lastTelegramError?: string | null
  lastErrorAge?: string | null
  isErrorRecent?: boolean
  googleApiKeySet?: boolean
  issues?: string[]
  fixes?: string[]
  error?: string
  fix?: string
}

export const TelegramCard = ({ roomName, channel }: Props) => {
  const [isPending, startTransition] = useTransition()
  const [health, setHealth] = useState<HealthResult | null>(null)
  const [checkingHealth, setCheckingHealth] = useState(false)

  const handleConnect = (formData: FormData) => {
    const token = formData.get('botToken') as string
    if (!token) return

    startTransition(async () => {
      await connectTelegram(roomName, token)
      setHealth(null)
    })
  }

  const handleDisconnect = () => {
    startTransition(async () => {
      await disconnectTelegram(roomName)
      setHealth(null)
    })
  }

  const checkHealth = async () => {
    setCheckingHealth(true)
    try {
      const resp = await fetch(`/api/webhook/telegram/${encodeURIComponent(roomName)}/health`)
      const data = (await resp.json()) as HealthResult
      setHealth(data)
    } catch {
      setHealth({ healthy: false, error: 'Failed to reach health endpoint', issues: [], fixes: [] })
    } finally {
      setCheckingHealth(false)
    }
  }

  const isActive = channel?.status === ChannelStatus.ACTIVE

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-muted-foreground">
        Connect a Telegram bot to forward messages into this room&apos;s AI agent.
      </p>
      <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
        One bot token can only serve one room. Connecting this token here overwrites any webhook
        previously set on another room.
      </p>

      <form className="flex flex-col gap-2" action={handleConnect}>
        <Input
          name="botToken"
          type="password"
          placeholder="Bot token (from BotFather)"
          disabled={isPending}
        />
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" disabled={isPending}>
            {isActive ? 'Update connection' : 'Connect bot'}
          </Button>
          {isActive && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={handleDisconnect}
            >
              Disconnect
            </Button>
          )}
          {isActive && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={checkHealth}
              disabled={checkingHealth}
            >
              {checkingHealth ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Stethoscope className="h-3 w-3 mr-1" />
              )}
              Health
            </Button>
          )}
        </div>
      </form>

      {channel?.telegramBotUsername && (
        <p className="text-xs text-muted-foreground">
          Connected as <span className="font-medium">@{channel.telegramBotUsername}</span>
        </p>
      )}

      {health && (
        <div className={`rounded-lg border p-3 text-xs ${health.healthy ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
          <div className="flex items-center gap-2 mb-2">
            {health.healthy ? (
              <>
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                <span className="font-medium text-emerald-500">{health.status || 'Healthy'}</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="font-medium text-red-500">{health.status || 'Issues detected'}</span>
              </>
            )}
          </div>

          {health.error && (
            <p className="text-red-400 mb-1">{health.error}</p>
          )}

          {health.issues && health.issues.length > 0 && (
            <ul className="space-y-1 text-red-400">
              {health.issues.map((issue, i) => (
                <li key={i} className="flex gap-1">
                  <span className="shrink-0">•</span>
                  <span>{issue}</span>
                </li>
              ))}
            </ul>
          )}

          {(health.fixes && health.fixes.length > 0) || health.fix ? (
            <div className="mt-2 pt-2 border-t border-border/50">
              <p className="font-medium text-muted-foreground mb-1">How to fix:</p>
              <ul className="space-y-1 text-muted-foreground">
                {health.fix && <li>• {health.fix}</li>}
                {health.fixes?.map((fix, i) => (
                  <li key={i}>• {fix}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {health.healthy && (
            <div className="text-muted-foreground space-y-1 mt-1">
              <p>Webhook URL: {health.urlMatches ? 'Matches' : 'OK (messages flowing)'}</p>
              <p>Google API Key: {health.googleApiKeySet ? 'Set' : 'Missing'}</p>
              {health.messagesFlowing && health.lastActivity && (
                <p>Last activity: {new Date(health.lastActivity).toLocaleString()}</p>
              )}
              {health.lastTelegramError && !health.isErrorRecent && (
                <p className="text-amber-400">Old Telegram error ({health.lastErrorAge}): {health.lastTelegramError}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
