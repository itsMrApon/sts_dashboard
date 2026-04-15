'use client'

import { useState, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Loader2, Plus, Trash2, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { connectOutreachChannel, disconnectOutreachChannel } from '@/actions/outreach'
import { cn } from '@/lib/utils'
import type { OutreachPlatform, ChannelStatus } from '@prisma/client'

type FieldConfig = {
  key: string
  label: string
  placeholder: string
  type?: 'text' | 'password'
}

type PlatformConfig = {
  platform: OutreachPlatform
  title: string
  shortLabel: string
  color: string
  description: string
  fields: FieldConfig[]
  hasPageUrl?: boolean
  pageUrlLabel?: string
  pageUrlPlaceholder?: string
}

type ConnectedAccount = {
  id: string
  platform: OutreachPlatform
  status: ChannelStatus
  accountLabel: string | null
  pageUrl: string | null
}

type Props = {
  config: PlatformConfig
  connectedAccounts: ConnectedAccount[]
  /** When set, new connections are stored under this business */
  businessId: string
}

export const PlatformSection = ({ config, connectedAccounts, businessId }: Props) => {
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')

  const handleConnect = (formData: FormData) => {
    setError('')
    const label = (formData.get('accountLabel') as string)?.trim()
    if (!label) {
      setError('Account name is required')
      return
    }

    const credentials: Record<string, string> = {}
    for (const field of config.fields) {
      const value = (formData.get(field.key) as string)?.trim()
      if (value) credentials[field.key] = value
    }

    const pageUrl = config.hasPageUrl ? (formData.get('pageUrl') as string)?.trim() : undefined

    startTransition(async () => {
      const result = await connectOutreachChannel(
        config.platform,
        credentials,
        label,
        pageUrl,
        businessId,
      )
      if (result.ok) {
        setShowForm(false)
        setError('')
      } else {
        setError(result.error)
      }
    })
  }

  const handleDisconnect = (channelId: string) => {
    startTransition(async () => {
      await disconnectOutreachChannel(channelId)
    })
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className={cn('text-sm font-bold', config.color)}>
              {config.shortLabel}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold">{config.title}</p>
              {connectedAccounts.length > 0 && (
                <Badge className="bg-emerald-500/10 text-emerald-500 border-transparent text-[10px]">
                  {connectedAccounts.length} connected
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{config.description}</p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? (
            <><ChevronUp className="w-3 h-3 mr-1" /> Close</>
          ) : (
            <><Plus className="w-3 h-3 mr-1" /> Add Account</>
          )}
        </Button>
      </div>

      {connectedAccounts.length > 0 && (
        <div className="border-t border-border">
          {connectedAccounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center justify-between px-4 py-3 border-b border-border last:border-b-0"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={cn(
                  'h-2 w-2 rounded-full shrink-0',
                  account.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-zinc-400',
                )} />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{account.accountLabel || 'Unnamed'}</p>
                  {account.pageUrl && (
                    <a
                      href={account.pageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                    >
                      {account.pageUrl.replace(/^https?:\/\//, '').slice(0, 40)}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDisconnect(account.id)}
                disabled={isPending}
                className="text-red-500 hover:text-red-600 hover:bg-red-500/10 shrink-0"
              >
                {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              </Button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="border-t border-border p-4 bg-muted/20">
          <form className="flex flex-col gap-3" action={handleConnect}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Account Name *</Label>
                <Input
                  name="accountLabel"
                  type="text"
                  placeholder={`e.g. ${config.title} — Main Business`}
                  disabled={isPending}
                />
              </div>
              {config.hasPageUrl && (
                <div>
                  <Label className="text-xs">{config.pageUrlLabel || 'URL'}</Label>
                  <Input
                    name="pageUrl"
                    type="text"
                    placeholder={config.pageUrlPlaceholder || 'https://…'}
                    disabled={isPending}
                  />
                </div>
              )}
            </div>

            {config.fields.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {config.fields.map((field) => (
                  <div key={field.key}>
                    <Label className="text-xs">{field.label}</Label>
                    <Input
                      name={field.key}
                      type={field.type || 'password'}
                      placeholder={field.placeholder}
                      disabled={isPending}
                    />
                  </div>
                ))}
              </div>
            )}

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
                Connect
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
