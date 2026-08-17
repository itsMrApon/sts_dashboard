'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { CalendarDays, KeyRound, Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  clearSerperApiKey,
  connectFathom,
  disconnectCallIntelProvider,
  saveCalendarEventFilter,
  saveGoogleOAuthApp,
  saveSerperApiKey,
} from '@/actions/callIntel'

type Props = {
  fathomOk: boolean
  gcalOk: boolean
  gcalNeedsReconnect: boolean
  googleOAuthConfigured: boolean
  hasUserGoogleOAuth: boolean
  serperConfigured: boolean
  hasUserSerperKey: boolean
  calendarFilterMode: 'ALL' | 'KEYWORD'
  calendarKeyword: string
}

export function LeadApiSettings(props: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [fathomKey, setFathomKey] = useState('')
  const [googleClientId, setGoogleClientId] = useState('')
  const [googleClientSecret, setGoogleClientSecret] = useState('')
  const [serperKey, setSerperKey] = useState('')
  const [filterMode, setFilterMode] = useState<'ALL' | 'KEYWORD'>(
    props.calendarFilterMode,
  )
  const [filterKeyword, setFilterKeyword] = useState(props.calendarKeyword)
  const [eventFilterOpen, setEventFilterOpen] = useState(false)

  function run(
    action: () => Promise<{ ok: boolean; error?: string }>,
    okMsg: string,
  ) {
    startTransition(async () => {
      try {
        const res = await action()
        if (res.ok) {
          toast.success(okMsg)
          router.refresh()
        } else toast.error(res.error || 'Failed')
      } catch {
        toast.error('Connection lost. Try again.')
      }
    })
  }

  return (
    <section className="rounded-xl border bg-background">
      <div className="flex items-start gap-3 border-b px-5 py-4 sm:px-6">
        <div className="mt-0.5 flex size-10 items-center justify-center rounded-lg bg-muted">
          <KeyRound className="size-5 text-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold tracking-tight">
            Lead connections
          </h2>
          <p className="text-muted-foreground text-sm">
            Fathom, Google Calendar, and Serper for /lead outreach.
          </p>
        </div>
      </div>

      <div className="grid gap-6 p-5 sm:p-6">
        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-medium">Fathom</h3>
              <p className="text-muted-foreground text-xs">
                Instant meeting recordings and summaries
              </p>
            </div>
            <Badge variant={props.fathomOk ? 'secondary' : 'outline'}>
              {props.fathomOk ? 'Connected' : 'Not connected'}
            </Badge>
          </div>
          {props.fathomOk ? (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  run(
                    () => disconnectCallIntelProvider('FATHOM'),
                    'Fathom disconnected',
                  )
                }
              >
                Disconnect
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                type="password"
                placeholder="Fathom API key"
                value={fathomKey}
                onChange={(e) => setFathomKey(e.target.value)}
              />
              <Button
                size="sm"
                disabled={pending || !fathomKey.trim()}
                onClick={() =>
                  run(() => connectFathom(fathomKey), 'Fathom connected')
                }
              >
                Connect
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-medium">Google OAuth</h3>
              <p className="text-muted-foreground text-xs">
                Client ID & secret for Calendar + Meet scheduling
              </p>
            </div>
            <Badge variant={props.googleOAuthConfigured ? 'secondary' : 'outline'}>
              {props.hasUserGoogleOAuth
                ? 'Saved here'
                : props.googleOAuthConfigured
                  ? 'From env'
                  : 'Not set'}
            </Badge>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="g-client-id">Client ID</Label>
            <Input
              id="g-client-id"
              placeholder={
                props.hasUserGoogleOAuth || props.googleOAuthConfigured
                  ? 'Leave blank to keep current · paste only to replace'
                  : 'xxxx.apps.googleusercontent.com'
              }
              value={googleClientId}
              onChange={(e) => setGoogleClientId(e.target.value)}
              autoComplete="off"
            />
            <Label htmlFor="g-client-secret">Client Secret</Label>
            <Input
              id="g-client-secret"
              type="password"
              placeholder={
                props.hasUserGoogleOAuth || props.googleOAuthConfigured
                  ? 'Leave blank to keep current · paste only to replace'
                  : 'Client secret'
              }
              value={googleClientSecret}
              onChange={(e) => setGoogleClientSecret(e.target.value)}
              autoComplete="off"
            />
            <p className="text-muted-foreground text-xs leading-relaxed">
              Refresh tokens are permanently tied to this Client ID. Saving a
              <span className="font-medium"> different </span>
              Client ID will require Connect Calendar again. If your Google Cloud
              OAuth app is still in <span className="font-medium">Testing</span>,
              Google expires refresh tokens after ~7 days — publish the consent
              screen to Production for a lasting connection.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                size="sm"
                variant="secondary"
                disabled={
                  pending ||
                  !googleClientId.trim() ||
                  !googleClientSecret.trim()
                }
                onClick={() => {
                  startTransition(async () => {
                    try {
                      const res = await saveGoogleOAuthApp({
                        clientId: googleClientId,
                        clientSecret: googleClientSecret,
                      })
                      if (!res.ok) {
                        toast.error(res.error || 'Failed')
                        return
                      }
                      setGoogleClientId('')
                      setGoogleClientSecret('')
                      if (res.data?.requiresCalendarReconnect) {
                        toast.warning(
                          'OAuth Client ID changed — click Connect Calendar again.',
                        )
                      } else {
                        toast.success('Google OAuth saved')
                      }
                      router.refresh()
                    } catch {
                      toast.error('Connection lost. Try again.')
                    }
                  })
                }}
              >
                Save OAuth
              </Button>
              {props.googleOAuthConfigured ? (
                <Button asChild size="sm" variant="outline">
                  <Link href="/api/integrations/google-calendar/connect">
                    <Link2 className="mr-1 size-3.5" />
                    {props.gcalOk && !props.gcalNeedsReconnect
                      ? 'Reconnect Calendar'
                      : 'Connect Calendar'}
                  </Link>
                </Button>
              ) : null}
              {props.gcalOk && !props.gcalNeedsReconnect ? (
                <Badge variant="secondary">Calendar linked</Badge>
              ) : props.gcalNeedsReconnect ? (
                <Badge variant="outline">Needs reconnect</Badge>
              ) : null}
              <Dialog open={eventFilterOpen} onOpenChange={setEventFilterOpen}>
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
                      Choose which Google Calendar events appear on the lead
                      calendar — all events, or only those matching a keyword
                      (e.g. [Sales]).
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-3 py-2">
                    <Label>Which events to include</Label>
                    <Select
                      value={filterMode}
                      onValueChange={(v) =>
                        setFilterMode(v as 'ALL' | 'KEYWORD')
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All events</SelectItem>
                        <SelectItem value="KEYWORD">
                          Keyword / hash filter
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {filterMode === 'KEYWORD' ? (
                      <Input
                        value={filterKeyword}
                        onChange={(e) => setFilterKeyword(e.target.value)}
                        placeholder="[Sales]"
                      />
                    ) : null}
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setEventFilterOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      disabled={pending}
                      onClick={() => {
                        startTransition(async () => {
                          try {
                            const res = await saveCalendarEventFilter({
                              calendarFilterMode: filterMode,
                              calendarKeyword: filterKeyword,
                            })
                            if (!res.ok) {
                              toast.error(res.error || 'Failed')
                              return
                            }
                            toast.success('Meeting options saved')
                            setEventFilterOpen(false)
                            router.refresh()
                          } catch {
                            toast.error('Connection lost. Try again.')
                          }
                        })
                      }}
                    >
                      Save
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-medium">Serper</h3>
              <p className="text-muted-foreground text-xs">
                Google Maps business discovery (daily 10 + Search)
              </p>
            </div>
            <Badge variant={props.serperConfigured ? 'secondary' : 'outline'}>
              {props.hasUserSerperKey
                ? 'Saved here'
                : props.serperConfigured
                  ? 'From env'
                  : 'Not set'}
            </Badge>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="password"
              placeholder="Serper API key"
              value={serperKey}
              onChange={(e) => setSerperKey(e.target.value)}
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={pending || !serperKey.trim()}
              onClick={() =>
                run(() => saveSerperApiKey(serperKey), 'Serper key saved')
              }
            >
              Save
            </Button>
            {props.hasUserSerperKey ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  run(() => clearSerperApiKey(), 'Serper key cleared')
                }
              >
                Clear
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}
