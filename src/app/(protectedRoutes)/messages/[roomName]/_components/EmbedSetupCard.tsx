'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Check, Copy, Loader2, RefreshCw, Save } from 'lucide-react'
import { toast } from 'sonner'

type Props = {
  roomName: string
}

type EmbedConfig = {
  roomName: string
  configured: boolean
  enabled: boolean
  allowedOrigins: string[]
  siteKeyPrefix: string | null
  workspaceId: string | null
  publishProfileId: string | null
}

export const EmbedSetupCard = ({ roomName }: Props) => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [config, setConfig] = useState<EmbedConfig | null>(null)
  const [domain, setDomain] = useState('')
  const [siteKeyOnce, setSiteKeyOnce] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const appUrl = useMemo(() => {
    if (typeof window !== 'undefined') return window.location.origin
    return process.env.NEXT_PUBLIC_APP_URL || 'https://your-sts-ai.com'
  }, [])

  const loadConfig = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/embed/v1/config?roomName=${encodeURIComponent(roomName)}`)
      const data = (await res.json()) as EmbedConfig & { error?: string }
      if (!res.ok) {
        toast.error(data.error || 'Failed to load embed config')
        return
      }
      setConfig(data)
      setDomain(data.allowedOrigins[0] || '')
    } catch {
      toast.error('Failed to load embed config')
    } finally {
      setLoading(false)
    }
  }, [roomName])

  useEffect(() => {
    void loadConfig()
  }, [loadConfig])

  const copyText = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey((c) => (c === key ? null : c)), 1500)
    } catch {
      toast.error('Copy failed')
    }
  }

  const saveConfig = async () => {
    const trimmed = domain.trim()
    if (!trimmed) {
      toast.error('Allowed website URL is required (e.g. https://primeone.com)')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/embed/v1/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName,
          allowedOrigins: [trimmed],
          enabled: true,
        }),
      })
      const data = (await res.json()) as EmbedConfig & {
        siteKey?: string
        siteKeyShownOnce?: boolean
        error?: string
      }
      if (!res.ok) {
        toast.error(data.error || 'Failed to save embed config')
        return
      }
      setConfig(data)
      if (data.siteKey) {
        setSiteKeyOnce(data.siteKey)
        toast.success('Embed key created — copy it now. It is shown only once.')
      } else {
        toast.success('Embed settings saved')
      }
    } catch {
      toast.error('Failed to save embed config')
    } finally {
      setSaving(false)
    }
  }

  const rotateKey = async () => {
    setRotating(true)
    try {
      const res = await fetch('/api/embed/v1/config/rotate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName }),
      })
      const data = (await res.json()) as { siteKey?: string; error?: string }
      if (!res.ok || !data.siteKey) {
        toast.error(data.error || 'Failed to rotate key')
        return
      }
      setSiteKeyOnce(data.siteKey)
      toast.success('New embed key generated — copy it now.')
      await loadConfig()
    } catch {
      toast.error('Failed to rotate key')
    } finally {
      setRotating(false)
    }
  }

  const envBlock = `NEXT_PUBLIC_STS_AI_URL=${appUrl}
NEXT_PUBLIC_STS_SITE_KEY=${siteKeyOnce || 'sts_pk_live_...'}
NEXT_PUBLIC_STS_ROOM_NAME=${roomName}
NEXT_PUBLIC_STS_WORKSPACE_ID=${config?.workspaceId || 'your-workspace-id'}
STS_SITE_KEY=${siteKeyOnce || 'sts_pk_live_...'}`

  const componentSnippet = `import { StsAiRoom } from '@sts-ai/sudotechserve'
import '@sts-ai/sudotechserve/styles.css'

export function AiSupportSection() {
  return (
    <section className="h-[520px] w-full">
      <StsAiRoom
        apiBase={process.env.NEXT_PUBLIC_STS_AI_URL!}
        siteKey={process.env.NEXT_PUBLIC_STS_SITE_KEY!}
        roomName={process.env.NEXT_PUBLIC_STS_ROOM_NAME!}
        embedMode
        defaultTab="voice"
      />
    </section>
  )
}`

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading embed setup…
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 text-sm">
      <p className="text-muted-foreground">
        Install <code className="text-xs bg-muted px-1 py-0.5 rounded">@sts-ai/sudotechserve</code> on
        your Next.js site. Visitors chat with your AI room directly — no login required.
      </p>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Allowed website URL</p>
        <div className="flex gap-2">
          <Input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="https://your-creator-site.com"
          />
          <Button type="button" variant="secondary" onClick={() => void saveConfig()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {config?.configured && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium">Site key</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void rotateKey()}
              disabled={rotating}
            >
              {rotating ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1" />
              )}
              Rotate key
            </Button>
          </div>
          <p className="text-xs text-muted-foreground font-mono">
            {siteKeyOnce || `${config.siteKeyPrefix || 'sts_pk_live_'}…`}
          </p>
          {siteKeyOnce && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() => void copyText(siteKeyOnce, 'siteKey')}
            >
              {copiedKey === 'siteKey' ? (
                <Check className="h-3 w-3 mr-1 text-emerald-500" />
              ) : (
                <Copy className="h-3 w-3 mr-1" />
              )}
              Copy full site key
            </Button>
          )}
        </div>
      )}

      <div className="rounded-lg bg-muted p-3 space-y-2">
        <p className="text-xs text-muted-foreground font-medium">1. Install package</p>
        <code className="text-xs bg-background px-2 py-1 rounded block">
          npm install @sts-ai/sudotechserve
        </code>
      </div>

      <div className="rounded-lg bg-muted p-3 space-y-2">
        <p className="text-xs text-muted-foreground font-medium">2. Environment variables (creator site)</p>
        <div className="flex items-start gap-2">
          <code className="text-xs bg-background px-2 py-1 rounded flex-1 whitespace-pre-wrap break-all">
            {envBlock}
          </code>
          <Button variant="ghost" size="sm" onClick={() => void copyText(envBlock, 'env')}>
            {copiedKey === 'env' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      <div className="rounded-lg bg-muted p-3 space-y-2">
        <p className="text-xs text-muted-foreground font-medium">3. React component</p>
        <div className="flex items-start gap-2">
          <code className="text-xs bg-background px-2 py-1 rounded flex-1 whitespace-pre-wrap break-all">
            {componentSnippet}
          </code>
          <Button variant="ghost" size="sm" onClick={() => void copyText(componentSnippet, 'snippet')}>
            {copiedKey === 'snippet' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      <div className="rounded-lg bg-muted p-3 space-y-2">
        <p className="text-xs text-muted-foreground font-medium">4. Website content API (services, profile)</p>
        <code className="text-xs bg-background px-2 py-1 rounded block whitespace-pre-wrap break-all">
          {`npm install @sts-ai/site-sdk

GET ${appUrl}/api/public/v1/workspaces/${config?.workspaceId || '{workspaceId}'}/services
Header: X-Sts-Site-Key`}
        </code>
      </div>

      <p className="text-xs text-muted-foreground">
        Use <code className="text-xs bg-muted px-1 py-0.5 rounded">@sts-ai/site-sdk</code> for published
        business pages. <code className="text-xs bg-muted px-1 py-0.5 rounded">@sts-ai/sudotechserve</code>{' '}
        handles the AI room only.
      </p>
    </div>
  )
}
