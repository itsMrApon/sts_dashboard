'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from '@/lib/toast'
import { guardAction } from '@/lib/clientActionErrors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  connectTelegramBot,
  disconnectTelegram,
  getTelegramSetup,
  sendTelegramTest,
  setTelegramEnabled,
  type TelegramSetupView,
} from '@/actions/telegram'
import { TelegramLogo } from '../../_components/PartnerLogos'

type Props = { initialSetup: TelegramSetupView | null; publicAppUrl: boolean }

const ALERTS: { title: string; body: string }[] = [
  { title: 'New chat', body: 'Someone starts chatting on one of your projects.' },
  { title: 'Waiting for you', body: 'You took a chat over and the buyer wrote again.' },
  { title: 'Ready to buy', body: 'The AI showed a buyer the order button.' },
]

function Step({ number, title, done, children }: { number: number; title: string; done?: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="mb-3 flex items-center gap-3">
        <span
          className={
            done
              ? 'grid size-7 place-items-center rounded-full bg-primary text-sm font-medium text-primary-foreground'
              : 'grid size-7 place-items-center rounded-full border text-sm font-medium'
          }
        >
          {done ? '✓' : number}
        </span>
        <h2 className="font-medium">{title}</h2>
      </div>
      <div className="space-y-3 pl-10 text-sm">{children}</div>
    </section>
  )
}

export function TelegramSetup({ initialSetup, publicAppUrl }: Props) {
  const [setup, setSetup] = useState(initialSetup)
  const [token, setToken] = useState('')
  const [changingChat, setChangingChat] = useState(false)
  const [pending, startTransition] = useTransition()
  const linked = Boolean(setup?.chatTitle) && !changingChat

  // While the creator is in Telegram linking a chat, check every few seconds whether it went through.
  const waitingForLink = Boolean(setup) && !linked
  const linkedBefore = setup?.linkedAt ?? null
  useEffect(() => {
    if (!waitingForLink) return
    const timer = window.setInterval(async () => {
      const next = await getTelegramSetup().catch(() => null)
      if (next?.linkedAt && next.linkedAt !== linkedBefore) {
        setSetup(next)
        setChangingChat(false)
        toast.success(`Linked to ${next.chatTitle}`)
      }
    }, 3000)
    return () => window.clearInterval(timer)
  }, [waitingForLink, linkedBefore])

  const connect = () =>
    startTransition(
      guardAction(async () => {
        const result = await connectTelegramBot({ token })
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        setToken('')
        setSetup(result.setup)
        toast.success(`@${result.setup.botUsername} is ready`)
      }),
    )

  const toggle = (enabled: boolean) =>
    startTransition(
      guardAction(async () => {
        const result = await setTelegramEnabled({ enabled })
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        setSetup((current) => (current ? { ...current, enabled } : current))
      }),
    )

  const test = () =>
    startTransition(
      guardAction(async () => {
        const result = await sendTelegramTest()
        if (result.ok) toast.success('Sent. Check Telegram.')
        else toast.error(result.error)
      }),
    )

  const disconnect = () =>
    startTransition(
      guardAction(async () => {
        const result = await disconnectTelegram()
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        setSetup(null)
        setChangingChat(false)
        toast.success('Telegram disconnected')
      }),
    )

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-10">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/integrations" className="hover:text-foreground">
          Integrations
        </Link>
        <span>/</span>
        <span className="text-foreground">Telegram</span>
      </div>

      <header className="flex items-start gap-4">
        <div className="size-12 shrink-0 *:size-12">
          <TelegramLogo />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Telegram</h1>
          <p className="text-muted-foreground">
            Buyer chats show up in Telegram, on your phone or in a team group. Reply to an alert and your answer goes
            straight into the buyer&apos;s chat. It&apos;s free: you use your own bot.
          </p>
        </div>
      </header>

      {!publicAppUrl ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          Telegram can only reach this app on a public https address. Set NEXT_PUBLIC_APP_URL to your live address
          to connect a bot.
        </p>
      ) : null}

      <Step number={1} title="Make a bot" done={Boolean(setup)}>
        {setup ? (
          <p>
            Using <span className="font-medium">@{setup.botUsername}</span>.
          </p>
        ) : (
          <>
            <p className="text-muted-foreground">
              Open{' '}
              <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="font-medium text-primary underline">
                @BotFather
              </a>{' '}
              in Telegram, send <code className="rounded bg-muted px-1">/newbot</code>, pick a name, and paste the token
              it sends you here.
            </p>
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault()
                connect()
              }}
            >
              <Input
                type="password"
                autoComplete="off"
                placeholder="123456789:AA..."
                value={token}
                onChange={(event) => setToken(event.target.value)}
                aria-label="Bot token"
                className="flex-1"
              />
              <Button type="submit" disabled={pending || !token.trim() || !publicAppUrl}>
                {pending ? 'Connecting…' : 'Connect'}
              </Button>
            </form>
          </>
        )}
      </Step>

      <Step number={2} title="Pick where alerts go" done={linked}>
        {!setup ? (
          <p className="text-muted-foreground">Connect your bot first.</p>
        ) : linked ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>
              Alerts go to <span className="font-medium">{setup.chatTitle}</span>.
            </p>
            <Button variant="outline" size="sm" onClick={() => setChangingChat(true)}>
              Change chat
            </Button>
          </div>
        ) : (
          <>
            <p className="text-muted-foreground">
              Add the bot to your team group, or use a private chat with it. Telegram will ask you to confirm, then this
              page updates by itself.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <a href={setup.groupLinkUrl} target="_blank" rel="noreferrer">
                  Add to a group
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href={setup.privateLinkUrl} target="_blank" rel="noreferrer">
                  Use a private chat
                </a>
              </Button>
              {changingChat ? (
                <Button variant="ghost" onClick={() => setChangingChat(false)}>
                  Cancel
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">Waiting for Telegram…</p>
          </>
        )}
      </Step>

      <Step number={3} title="What you'll get" done={linked}>
        <ul className="space-y-2">
          {ALERTS.map((alert) => (
            <li key={alert.title}>
              <span className="font-medium">{alert.title}.</span>{' '}
              <span className="text-muted-foreground">{alert.body}</span>
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground">
          Reply to an alert (swipe it, or tap Reply) to answer the buyer. The AI waits while you talk; hand the chat back
          to the AI from the project&apos;s buyers page.
        </p>
        {setup && linked ? (
          <div className="flex flex-wrap items-center gap-4 border-t pt-4">
            <label className="flex items-center gap-2">
              <Switch checked={setup.enabled} onCheckedChange={toggle} disabled={pending} aria-label="Send alerts" />
              <span>{setup.enabled ? 'Alerts on' : 'Alerts off'}</span>
            </label>
            <Button variant="outline" size="sm" onClick={test} disabled={pending || !setup.enabled}>
              Send a test
            </Button>
          </div>
        ) : null}
      </Step>

      {setup ? (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" className="text-destructive" onClick={disconnect} disabled={pending}>
            Disconnect @{setup.botUsername}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
