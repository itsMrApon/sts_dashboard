'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from '@/lib/toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { SetupLinks } from '@/components/integrations/SetupLinks'
import { disconnectEmail, saveEmailConnection, sendTestEmail } from '@/actions/email'
import { SMTP_PROVIDERS, smtpProvider, type SmtpProviderId } from '@/lib/email/smtpProviders'
import { guardAction } from '@/lib/clientActionErrors'
import { cn } from '@/lib/utils'

type Connection = {
  provider: string
  host: string
  port: number
  secure: boolean
  username: string
  fromEmail: string
  fromName: string | null
  verifiedAt: string | null
  lastError: string | null
}

type Props = { ownerEmail: string; platformFallback: boolean; connection: Connection | null }

const USES = ['Form answers to you', 'Callback requests', 'Review requests to buyers', 'Webinar reminders to attendees']

export function EmailSettings({ ownerEmail, platformFallback, connection }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({
    provider: (connection?.provider ?? 'gmail') as SmtpProviderId,
    host: connection?.host ?? 'smtp.gmail.com',
    port: connection?.port ?? 465,
    secure: connection?.secure ?? true,
    username: connection?.username ?? ownerEmail,
    password: '',
    fromEmail: connection?.fromEmail ?? ownerEmail,
    fromName: connection?.fromName ?? '',
  })
  const provider = smtpProvider(form.provider)

  const pickProvider = (id: SmtpProviderId) => {
    const next = smtpProvider(id)
    setForm((current) => ({
      ...current,
      provider: id,
      host: next.host || (id === 'custom' ? current.host : ''),
      port: next.port,
      secure: next.secure,
      username: next.username ?? (current.username === 'resend' ? ownerEmail : current.username),
    }))
  }

  const run = (action: () => ReturnType<typeof sendTestEmail>) =>
    startTransition(
      guardAction(async () => {
        const result = await action()
        if (result.ok) toast.success(result.message ?? 'Saved')
        else toast.error(result.error)
        router.refresh()
      }),
    )

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-5">
        <div className="min-w-0">
          <h2 className="font-medium">Sending from</h2>
          <p className="text-sm text-muted-foreground">
            {connection
              ? `${connection.fromName ? `${connection.fromName} · ` : ''}${connection.fromEmail}`
              : platformFallback
                ? 'The platform’s shared address, until you connect your own.'
                : 'Nothing yet: forms and reminders can’t send email until you connect one.'}
          </p>
          {connection?.lastError ? <p className="mt-1 text-xs text-rose-500">Last send failed: {connection.lastError}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          {connection ? <Badge variant="secondary">Connected</Badge> : null}
          {connection ? (
            <>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => run(sendTestEmail)}>
                Send test email
              </Button>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(disconnectEmail)}>
                Disconnect
              </Button>
            </>
          ) : null}
        </div>
      </section>

      <form
        className="space-y-4 rounded-xl border bg-card p-5"
        onSubmit={(event) => {
          event.preventDefault()
          run(() => saveEmailConnection(form))
        }}
      >
        <div className="space-y-2">
          <Label>Your email service</Label>
          <div className="flex flex-wrap gap-2">
            {SMTP_PROVIDERS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => pickProvider(item.id)}
                className={cn(
                  'rounded-full border px-3 py-1 text-sm',
                  form.provider === item.id ? 'border-primary bg-primary/10 font-medium' : 'hover:bg-muted',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{provider.limit}.</p>
        </div>

        <SetupLinks title={`Get your ${provider.label} details`} links={provider.links} />

        <div className="grid gap-3 sm:grid-cols-[1fr_110px_auto]">
          <div className="grid gap-1.5">
            <Label htmlFor="smtp-host">SMTP server</Label>
            <Input id="smtp-host" value={form.host} placeholder="smtp.example.com" onChange={(e) => setForm({ ...form, host: e.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="smtp-port">Port</Label>
            <Input id="smtp-port" inputMode="numeric" value={form.port} onChange={(e) => setForm({ ...form, port: Number(e.target.value.replace(/\D/g, '')) || 0 })} />
          </div>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <Switch checked={form.secure} onCheckedChange={(secure) => setForm({ ...form, secure, port: secure ? 465 : 587 })} />
            SSL
          </label>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="smtp-user">Username</Label>
          <Input id="smtp-user" autoComplete="off" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          <p className="text-xs text-muted-foreground">{provider.usernameHint}</p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="smtp-pass">Password</Label>
          <Input
            id="smtp-pass"
            type="password"
            autoComplete="new-password"
            value={form.password}
            placeholder={connection ? 'Saved. Leave empty to keep it' : ''}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">{provider.passwordHint}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="smtp-from">Send from (email)</Label>
            <Input id="smtp-from" type="email" value={form.fromEmail} onChange={(e) => setForm({ ...form, fromEmail: e.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="smtp-name">Sender name (optional)</Label>
            <Input id="smtp-name" value={form.fromName} placeholder="Your business name" onChange={(e) => setForm({ ...form, fromName: e.target.value })} />
          </div>
        </div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Checking…' : connection ? 'Save and check' : 'Connect email'}
        </Button>
        <p className="text-xs text-muted-foreground">sts-ai logs in to your email server to check these before saving. Nothing is sent.</p>
      </form>

      <section className="rounded-xl border bg-card p-5 text-sm">
        <h2 className="mb-2 font-medium">Used for</h2>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          {USES.map((use) => (
            <li key={use}>{use}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}
