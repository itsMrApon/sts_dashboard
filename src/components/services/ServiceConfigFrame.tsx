'use client'

import { useState, type ReactNode } from 'react'
import { Check, Copy, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { EmbedSetupCard } from '@/components/services/EmbedSetupCard'

type Props = {
  serviceName: string
  /** Business room — the site key + allowed website are set up per business. */
  roomName: string
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  dirty: boolean
  saving: boolean
  onSave: () => void
  /** Settings form (left column). */
  children: ReactNode
  /** Live preview (right column, sticky). */
  preview: ReactNode
  /** Service-specific SDK code for the Integrate tab. */
  snippet: string
  footer?: ReactNode
}

function CodeBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    toast.success(`${label} copied`)
    window.setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="relative rounded-xl border border-border bg-muted/40">
      <Button variant="ghost" size="icon" className="absolute right-2 top-2 h-7 w-7" onClick={copy} aria-label={`Copy ${label}`}>
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
      <pre className="overflow-x-auto p-4 pr-12 text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  )
}

/** Same layout as the Wizard configurator: settings left, live preview right, plus an Integrate tab. */
export function ServiceConfigFrame({
  serviceName,
  roomName,
  enabled,
  onEnabledChange,
  dirty,
  saving,
  onSave,
  children,
  preview,
  snippet,
  footer,
}: Props) {
  const [tab, setTab] = useState<'settings' | 'integrate'>('settings')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-border p-0.5 text-sm">
          {(['settings', 'integrate'] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn('rounded-md px-3 py-1 capitalize', tab === id ? 'bg-primary/15 text-primary' : 'text-muted-foreground')}
            >
              {id}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {dirty ? <span className="text-xs text-amber-500">Unsaved changes</span> : null}
          <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm">
            {serviceName} on website
            <Switch checked={enabled} onCheckedChange={onEnabledChange} />
          </label>
          <Button size="sm" onClick={onSave} disabled={!dirty || saving}>
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
            Save
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          {tab === 'settings' ? (
            children
          ) : (
            <section className="space-y-4 rounded-2xl border border-border bg-card/60 p-5">
              <div>
                <h2 className="text-sm font-semibold">Add {serviceName} to your website</h2>
                <p className="text-xs text-muted-foreground">
                  Headless: the SDK gives state and actions, your designer builds the button and pop-up. One site key
                  covers every service.
                </p>
              </div>
              <EmbedSetupCard roomName={roomName} />
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">4. {serviceName} component</p>
                <CodeBlock code={snippet} label={`${serviceName} snippet`} />
              </div>
              {!enabled ? (
                <p className="text-xs text-amber-500">{serviceName} is off — turn it on and save so the SDK can use it.</p>
              ) : null}
            </section>
          )}
          {footer}
        </div>
        <aside className="lg:sticky lg:top-6 lg:self-start">{preview}</aside>
      </div>
    </div>
  )
}
