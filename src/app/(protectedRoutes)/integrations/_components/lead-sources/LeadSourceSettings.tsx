'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition, type ReactNode } from 'react'
import { CalendarDays } from 'lucide-react'
import { toast } from '@/lib/toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  clearSerperApiKey,
  connectFathom,
  disconnectCallIntelProvider,
  saveCalendarEventFilter,
  saveGoogleOAuthApp,
  saveSerperApiKey,
} from '@/actions/callIntel'
import type { LeadConnectionSettings } from '@/lib/leads/leadConnectionSettings'
import { guardAction } from '@/lib/clientActionErrors'

/**
 * The lead connections, one box each on /integrations (they used to share the Lead settings panel):
 * Fathom brings in calls, Google OAuth links the calendar and Meet, Serper searches Google Maps.
 */

function useRun() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const run = (action: () => Promise<{ ok: boolean; error?: string }>, okMessage: string, after?: () => void) =>
    startTransition(
      guardAction(async () => {
        const res = await action()
        if (res.ok) {
          toast.success(okMessage)
          after?.()
          router.refresh()
        } else toast.error(res.error || 'That didn’t work. Try again.')
      }),
    )
  return { pending, run, startTransition, router }
}

function Box({ title, description, status, children }: { title: string; description: string; status: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-medium">{title}</h2>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
        {status}
      </div>
      {children}
    </section>
  )
}

export function FathomSettings({ fathomOk }: Pick<LeadConnectionSettings, 'fathomOk'>) {
  const { pending, run } = useRun()
  const [key, setKey] = useState('')

  return (
    <Box
      title="Fathom"
      description="Call recordings and summaries become leads."
      status={<Badge variant={fathomOk ? 'secondary' : 'outline'}>{fathomOk ? 'Connected' : 'Not connected'}</Badge>}
    >
      {fathomOk ? (
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            New calls come in by themselves when they end, and a nightly backup pulls the last 3 days. To bring in
            older calls, open the Fathom folder in{' '}
            <Link href="/lead" className="text-foreground font-medium underline">
              Lead → Intel
            </Link>
            .
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => disconnectCallIntelProvider('FATHOM'), 'Fathom disconnected')}
          >
            Disconnect
          </Button>
        </div>
      ) : (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault()
            if (!key.trim()) {
              toast.error('Paste your Fathom API key first.')
              return
            }
            run(() => connectFathom(key), 'Fathom connected', () => setKey(''))
          }}
        >
          <Input type="password" placeholder="Fathom API key" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" />
          <Button size="sm" type="submit" disabled={pending}>
            {pending ? 'Connecting…' : 'Connect'}
          </Button>
        </form>
      )}
    </Box>
  )
}

export function SerperSettings({ serperConfigured, hasUserSerperKey }: Pick<LeadConnectionSettings, 'serperConfigured' | 'hasUserSerperKey'>) {
  const { pending, run } = useRun()
  const [key, setKey] = useState('')

  return (
    <Box
      title="Serper"
      description="Searches Google Maps for businesses: the daily 10 and Find."
      status={
        <Badge variant={serperConfigured ? 'secondary' : 'outline'}>
          {hasUserSerperKey ? 'Saved here' : serperConfigured ? 'From env' : 'Not set'}
        </Badge>
      }
    >
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault()
          if (!key.trim()) {
            toast.error('Paste your Serper API key first.')
            return
          }
          run(() => saveSerperApiKey(key), 'Serper key saved', () => setKey(''))
        }}
      >
        <Input type="password" placeholder="Serper API key" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" />
        <Button size="sm" type="submit" variant="secondary" disabled={pending}>
          Save
        </Button>
        {hasUserSerperKey ? (
          <Button size="sm" type="button" variant="ghost" disabled={pending} onClick={() => run(() => clearSerperApiKey(), 'Serper key cleared')}>
            Clear
          </Button>
        ) : null}
      </form>
    </Box>
  )
}

export function GoogleSettings(
  props: Pick<
    LeadConnectionSettings,
    'googleOAuthConfigured' | 'hasUserGoogleOAuth' | 'gcalOk' | 'gcalNeedsReconnect' | 'calendarFilterMode' | 'calendarKeyword'
  >,
) {
  const { pending, run, startTransition, router } = useRun()
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [filterMode, setFilterMode] = useState<'ALL' | 'KEYWORD'>(props.calendarFilterMode)
  const [filterKeyword, setFilterKeyword] = useState(props.calendarKeyword)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const calendarLinked = props.gcalOk && !props.gcalNeedsReconnect
  const keep = props.hasUserGoogleOAuth || props.googleOAuthConfigured

  return (
    <Box
      title="Google OAuth"
      description="Your Google client for Calendar and Meet scheduling."
      status={
        <Badge variant={props.googleOAuthConfigured ? 'secondary' : 'outline'}>
          {props.hasUserGoogleOAuth ? 'Saved here' : props.googleOAuthConfigured ? 'From env' : 'Not set'}
        </Badge>
      }
    >
      <div className="grid gap-2">
        <Label htmlFor="g-client-id">Client ID</Label>
        <Input
          id="g-client-id"
          placeholder={keep ? 'Leave blank to keep current · paste only to replace' : 'xxxx.apps.googleusercontent.com'}
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          autoComplete="off"
        />
        <Label htmlFor="g-client-secret">Client secret</Label>
        <Input
          id="g-client-secret"
          type="password"
          placeholder={keep ? 'Leave blank to keep current · paste only to replace' : 'Client secret'}
          value={clientSecret}
          onChange={(e) => setClientSecret(e.target.value)}
          autoComplete="off"
        />
        <p className="text-muted-foreground text-xs leading-relaxed">
          Refresh tokens are tied to this Client ID, so saving a <span className="font-medium">different</span> one means
          connecting the calendar again. While your Google Cloud OAuth app is in{' '}
          <span className="font-medium">Testing</span>, Google expires refresh tokens after about 7 days; publish the
          consent screen to Production for a lasting connection.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => {
            if (!clientId.trim() || !clientSecret.trim()) {
              toast.error('Paste both the Client ID and the secret.')
              return
            }
            startTransition(
              guardAction(async () => {
                const res = await saveGoogleOAuthApp({ clientId, clientSecret })
                if (!res.ok) {
                  toast.error(res.error || 'Failed')
                  return
                }
                setClientId('')
                setClientSecret('')
                if (res.data?.requiresCalendarReconnect) toast.warning('Your Google client changed, so connect your calendar again.')
                else toast.success('Google sign-in saved')
                router.refresh()
              }),
            )
          }}
        >
          Save OAuth
        </Button>
        {props.googleOAuthConfigured ? (
          <Button asChild size="sm" variant="outline">
            <Link href="/api/integrations/google-calendar/connect">{calendarLinked ? 'Reconnect Calendar' : 'Connect Calendar'}</Link>
          </Button>
        ) : null}
        {calendarLinked ? (
          <Badge variant="secondary">Calendar linked</Badge>
        ) : props.gcalNeedsReconnect ? (
          <Badge variant="outline">Needs reconnect</Badge>
        ) : null}

        <Dialog open={optionsOpen} onOpenChange={setOptionsOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <CalendarDays className="mr-1 size-3.5" />
              Meeting options
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Meeting options</DialogTitle>
              <DialogDescription>
                Which Google Calendar events show on the lead calendar: all of them, or only those matching a keyword
                such as [Sales].
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <Label>Which events to include</Label>
              <Select value={filterMode} onValueChange={(v) => setFilterMode(v as 'ALL' | 'KEYWORD')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All events</SelectItem>
                  <SelectItem value="KEYWORD">Keyword filter</SelectItem>
                </SelectContent>
              </Select>
              {filterMode === 'KEYWORD' ? (
                <Input value={filterKeyword} onChange={(e) => setFilterKeyword(e.target.value)} placeholder="[Sales]" />
              ) : null}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOptionsOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={pending}
                onClick={() =>
                  run(
                    () => saveCalendarEventFilter({ calendarFilterMode: filterMode, calendarKeyword: filterKeyword }),
                    'Meeting options saved',
                    () => setOptionsOpen(false),
                  )
                }
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Box>
  )
}
