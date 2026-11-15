'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, Loader2, RefreshCw, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type EmbedConfig = {
  configured: boolean
  enabled: boolean
  allowedOrigins: string[]
  siteKeyPrefix: string | null
}

/**
 * The allowed website and its site key (one for every service). The full key is shown once,
 * right after it is created or rotated.
 */
export function WebsiteKeyCard({ roomName, onConnected }: { roomName: string; onConnected?: (origin: string) => void }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [config, setConfig] = useState<EmbedConfig | null>(null)
  const [domain, setDomain] = useState('')
  const [siteKeyOnce, setSiteKeyOnce] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const loadConfig = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/embed/v1/config?roomName=${encodeURIComponent(roomName)}`)
      const data = (await res.json()) as EmbedConfig & { error?: string }
      if (!res.ok) {
        toast.error(data.error || 'Could not load the connection')
        return
      }
      setConfig(data)
      setDomain(data.allowedOrigins[0] || '')
    } catch {
      toast.error('Could not load the connection')
    } finally {
      setLoading(false)
    }
  }, [roomName])

  useEffect(() => {
    void loadConfig()
  }, [loadConfig])

  const saveConfig = async () => {
    const trimmed = domain.trim()
    if (!trimmed) {
      toast.error('Add your website URL (e.g. https://your-site.com)')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/embed/v1/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName, allowedOrigins: [trimmed], enabled: true }),
      })
      const data = (await res.json()) as EmbedConfig & { siteKey?: string; error?: string }
      if (!res.ok) {
        toast.error(data.error || 'Could not save the website')
        return
      }
      setConfig(data)
      if (data.siteKey) {
        setSiteKeyOnce(data.siteKey)
        toast.success('Website connected. Copy the key now, it is shown once.')
      } else {
        toast.success('Website saved')
      }
      if (data.allowedOrigins[0]) onConnected?.(data.allowedOrigins[0])
      // The header's connection pill is server-rendered.
      router.refresh()
    } catch {
      toast.error('Could not save the website')
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
        toast.error(data.error || 'Could not rotate the key')
        return
      }
      setSiteKeyOnce(data.siteKey)
      toast.success('New key ready. Copy it now.')
      await loadConfig()
    } catch {
      toast.error('Could not rotate the key')
    } finally {
      setRotating(false)
    }
  }

  const copyKey = async () => {
    if (!siteKeyOnce) return
    try {
      await navigator.clipboard.writeText(siteKeyOnce)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Copy failed')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Allowed website</p>
        <div className="flex gap-2">
          <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="https://your-site.com" aria-label="Allowed website" />
          <Button type="button" variant="secondary" onClick={() => void saveConfig()} disabled={saving} aria-label="Save website">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {config?.configured ? (
        <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium">Site key</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void rotateKey()} disabled={rotating}>
              {rotating ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
              Rotate
            </Button>
          </div>
          <p className="break-all font-mono text-xs text-muted-foreground">{siteKeyOnce || `${config.siteKeyPrefix || 'sts_pk_live_'}…`}</p>
          {siteKeyOnce ? (
            <Button type="button" variant="ghost" size="sm" className="h-7" onClick={() => void copyKey()}>
              {copied ? <Check className="mr-1 h-3 w-3 text-emerald-500" /> : <Copy className="mr-1 h-3 w-3" />}
              Copy key
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
