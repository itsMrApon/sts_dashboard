'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Copy, PlugZap } from 'lucide-react'
import { toast } from '@/lib/toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { disconnectWhatsApp, saveWhatsApp, testWhatsApp } from '@/actions/whatsapp'
import type { WhatsAppConnectionView } from '@/lib/whatsapp/connection'
import { guardAction } from '@/lib/clientActionErrors'

export function WhatsAppSettings({ view, webhookAddress }: { view: WhatsAppConnectionView; webhookAddress: string | null }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [apiKey, setApiKey] = useState('')
  const [phoneNumberId, setPhoneNumberId] = useState(view.phoneNumberId ?? '')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [aiReplies, setAiReplies] = useState(view.aiReplies)

  const run = (action: () => ReturnType<typeof testWhatsApp>, fallback: string, after?: () => void) =>
    startTransition(
      guardAction(async () => {
        const result = await action()
        if (result.ok) {
          toast.success(result.message ?? fallback)
          after?.()
          router.refresh()
        } else toast.error(result.error)
      }),
    )

  const copy = async () => {
    if (!webhookAddress) return
    try {
      await navigator.clipboard.writeText(webhookAddress)
      toast.success('Webhook address copied')
    } catch {
      toast.error('Copy did not work. Select the address and copy it.')
    }
  }

  return (
    <div className="space-y-4">
      <section className="space-y-4 rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-medium">Your Kapso project</h2>
            <p className="text-sm text-muted-foreground">From kapso.ai: API keys, and the number&apos;s Phone number ID.</p>
          </div>
          <Badge variant={view.connected ? 'secondary' : 'outline'}>
            {view.connected ? view.displayPhone ?? 'Connected' : 'Not connected'}
          </Badge>
        </div>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            run(() => saveWhatsApp({ apiKey, phoneNumberId, webhookSecret, aiReplies }), 'WhatsApp saved', () => {
              setApiKey('')
              setWebhookSecret('')
            })
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="wa-key">Kapso API key</Label>
            <Input
              id="wa-key"
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={view.connected ? 'Leave blank to keep the saved key' : 'Your project API key'}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="wa-phone">Phone number ID</Label>
            <Input
              id="wa-phone"
              inputMode="numeric"
              autoComplete="off"
              value={phoneNumberId}
              onChange={(event) => setPhoneNumberId(event.target.value)}
              placeholder="123456789012345"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="wa-secret">Webhook secret key</Label>
            <Input
              id="wa-secret"
              type="password"
              autoComplete="off"
              value={webhookSecret}
              onChange={(event) => setWebhookSecret(event.target.value)}
              placeholder={view.connected ? 'Leave blank to keep the saved secret' : 'The secret key on your Kapso webhook'}
            />
          </div>
          <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
            <span>
              <span className="font-medium">Chat AI answers on WhatsApp</span>
              <span className="block text-muted-foreground">Turn off to only collect the messages. Take over in a pipeline still pauses one chat.</span>
            </span>
            <Switch checked={aiReplies} onCheckedChange={setAiReplies} aria-label="Chat AI answers on WhatsApp" />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" type="submit" disabled={pending}>
              {view.connected ? 'Save' : 'Connect'}
            </Button>
            {view.connected ? (
              <>
                <Button size="sm" type="button" variant="outline" disabled={pending} onClick={() => run(() => testWhatsApp(), 'Connected')}>
                  <PlugZap className="mr-1.5 size-4" aria-hidden />
                  Test connection
                </Button>
                <Button size="sm" type="button" variant="ghost" disabled={pending} onClick={() => run(() => disconnectWhatsApp(), 'Disconnected')}>
                  Disconnect
                </Button>
              </>
            ) : null}
          </div>
        </form>
      </section>

      {webhookAddress ? (
        <section className="space-y-3 rounded-xl border bg-card p-5">
          <div>
            <h2 className="font-medium">Webhook address</h2>
            <p className="text-sm text-muted-foreground">
              In Kapso, add a webhook for this number with this URL, the event <code className="font-mono text-xs">whatsapp.message.received</code>,
              and the same secret key you saved above.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-3 py-2 font-mono text-xs">{webhookAddress}</code>
            <Button size="sm" variant="outline" type="button" onClick={copy} aria-label="Copy webhook address">
              <Copy className="size-4" aria-hidden />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {view.lastInboundAt ? `Last message received ${new Date(view.lastInboundAt).toLocaleString()}.` : 'No messages received yet.'}
          </p>
        </section>
      ) : null}

      <section className="space-y-2 rounded-xl border bg-card p-5 text-sm">
        <h2 className="font-medium">Good to know</h2>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>WhatsApp lets businesses reply freely for 24 hours after the customer writes. After that only approved templates can be sent.</li>
          <li>Messages count against your Kapso plan (free: 2,000 a month, incoming and outgoing). Meta may charge per message too.</li>
          <li>Chats appear in Projects → General questions, like website chats.</li>
        </ul>
      </section>
    </div>
  )
}
