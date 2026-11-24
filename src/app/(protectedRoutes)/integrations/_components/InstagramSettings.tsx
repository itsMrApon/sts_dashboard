'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Pause, Play, Plus, Trash2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  deleteInstagramCampaign,
  disconnectInstagram,
  loadInstagramMedia,
  saveInstagramCampaign,
  setInstagramCampaignActive,
} from '@/actions/instagram'
import type { InstagramMedia } from '@/lib/instagram/graph'
import { guardAction } from '@/lib/clientActionErrors'
import { cn } from '@/lib/utils'

type Campaign = {
  id: string
  mediaId: string | null
  mediaCaption: string | null
  mediaThumb: string | null
  keywords: string[]
  matchMode: 'contains' | 'word'
  dmText: string
  linkUrl: string | null
  publicReply: string | null
  askContact: boolean
  active: boolean
  matchedCount: number
  sentCount: number
  contactsCount: number
}

type Props = {
  configured: boolean
  connection: { username: string | null; tokenExpiresAt: string | null; webhookSubscribed: boolean } | null
  campaigns: Campaign[]
}

const EMPTY_FORM = {
  mediaId: null as string | null,
  mediaCaption: null as string | null,
  mediaThumb: null as string | null,
  keywords: '',
  matchMode: 'contains' as 'contains' | 'word',
  dmText: 'Hi {username}! Thanks for your comment. Here are the details you asked for:',
  linkUrl: '',
  publicReply: 'Sent you a DM!',
  askContact: true,
}

export function InstagramSettings({ configured, connection, campaigns }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState(EMPTY_FORM)
  const [formOpen, setFormOpen] = useState(false)
  const [media, setMedia] = useState<InstagramMedia[] | null>(null)

  const run = (action: () => ReturnType<typeof disconnectInstagram>, fallback: string, after?: () => void) =>
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

  const openForm = () => {
    setForm(EMPTY_FORM)
    setFormOpen(true)
    startTransition(async () => {
      const result = await loadInstagramMedia()
      if (result.ok) setMedia(result.media)
      else toast.error(result.error)
    })
  }

  if (!configured) {
    return (
      <section className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
        Instagram needs the platform&apos;s Meta app keys on the server (INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET and
        INSTAGRAM_WEBHOOK_VERIFY_TOKEN). Ask the platform owner to add them.
      </section>
    )
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-5">
        <div>
          <h2 className="font-medium">Account</h2>
          <p className="text-sm text-muted-foreground">
            {connection
              ? `@${connection.username ?? 'your account'}${connection.webhookSubscribed ? '' : ' · comments are not arriving yet: reconnect'}`
              : 'Connect an Instagram Business or Creator account.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {connection ? <Badge variant="secondary">Connected</Badge> : null}
          <Button size="sm" asChild variant={connection ? 'outline' : 'default'}>
            <a href="/api/instagram/connect">{connection ? 'Reconnect' : 'Connect Instagram'}</a>
          </Button>
          {connection ? (
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => disconnectInstagram(), 'Disconnected')}>
              Disconnect
            </Button>
          ) : null}
        </div>
      </section>

      {connection ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Campaigns</h2>
            {!formOpen ? (
              <Button size="sm" onClick={openForm}>
                <Plus className="mr-1.5 size-4" aria-hidden />
                New campaign
              </Button>
            ) : null}
          </div>

          {formOpen ? (
            <form
              className="space-y-4 rounded-xl border bg-card p-5"
              onSubmit={(event) => {
                event.preventDefault()
                run(() => saveInstagramCampaign(form), 'Campaign saved', () => setFormOpen(false))
              }}
            >
              <div className="space-y-2">
                <Label>Which post</Label>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, mediaId: null, mediaCaption: null, mediaThumb: null })}
                    className={cn('flex aspect-square items-center justify-center rounded-lg border text-xs', !form.mediaId && 'ring-2 ring-primary')}
                  >
                    Any post
                  </button>
                  {(media ?? []).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      title={item.caption ?? ''}
                      onClick={() => setForm({ ...form, mediaId: item.id, mediaCaption: item.caption, mediaThumb: item.thumbnail })}
                      className={cn('aspect-square overflow-hidden rounded-lg border bg-muted', form.mediaId === item.id && 'ring-2 ring-primary')}
                    >
                      {item.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element -- Instagram CDN thumbnails
                        <img src={item.thumbnail} alt={item.caption ?? 'Post'} className="h-full w-full object-cover" />
                      ) : (
                        <span className="p-1 text-[10px]">{item.caption?.slice(0, 30) ?? 'Post'}</span>
                      )}
                    </button>
                  ))}
                </div>
                {media === null ? <p className="text-xs text-muted-foreground">Loading your posts…</p> : null}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ig-keywords">Keywords</Label>
                <Input
                  id="ig-keywords"
                  value={form.keywords}
                  onChange={(event) => setForm({ ...form, keywords: event.target.value })}
                  placeholder="PRICE, LINK, দাম"
                />
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={form.matchMode === 'word'}
                    onChange={(event) => setForm({ ...form, matchMode: event.target.checked ? 'word' : 'contains' })}
                  />
                  Whole word only (so &quot;price&quot; does not match &quot;priceless&quot;)
                </label>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ig-dm">The DM they get</Label>
                <Textarea id="ig-dm" rows={3} value={form.dmText} onChange={(event) => setForm({ ...form, dmText: event.target.value })} />
                <p className="text-xs text-muted-foreground">{'{username}'} becomes their Instagram name.</p>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ig-link">Link in the DM (optional)</Label>
                <Input id="ig-link" value={form.linkUrl} onChange={(event) => setForm({ ...form, linkUrl: event.target.value })} placeholder="https://sudotechserve.com/o/your-offer" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ig-public">Public reply under the comment (optional)</Label>
                <Input id="ig-public" value={form.publicReply} onChange={(event) => setForm({ ...form, publicReply: event.target.value })} />
              </div>
              <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                <span>Ask for their email or WhatsApp in the DM, and add it to the lead</span>
                <Switch checked={form.askContact} onCheckedChange={(askContact) => setForm({ ...form, askContact })} />
              </label>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={pending}>
                  Save campaign
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setFormOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : null}

          {campaigns.length === 0 && !formOpen ? (
            <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">No campaigns yet.</p>
          ) : null}
          <ul className="space-y-3">
            {campaigns.map((campaign) => (
              <li key={campaign.id} className={cn('flex gap-3 rounded-xl border bg-card p-4', !campaign.active && 'opacity-60')}>
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {campaign.mediaThumb ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Instagram CDN thumbnails
                    <img src={campaign.mediaThumb} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-[10px] text-muted-foreground">Any post</span>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-medium">{campaign.keywords.join(', ')}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{campaign.dmText}</p>
                  <p className="text-xs text-muted-foreground">
                    {campaign.matchedCount} comments matched · {campaign.sentCount} DMs sent · {campaign.contactsCount} contacts
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    aria-label={campaign.active ? 'Pause campaign' : 'Turn campaign on'}
                    onClick={() => run(() => setInstagramCampaignActive({ id: campaign.id, active: !campaign.active }), 'Saved')}
                  >
                    {campaign.active ? <Pause className="size-4" /> : <Play className="size-4" />}
                  </Button>
                  <Button size="sm" variant="ghost" disabled={pending} aria-label="Delete campaign" onClick={() => run(() => deleteInstagramCampaign({ id: campaign.id }), 'Deleted')}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-2 rounded-xl border bg-card p-5 text-sm">
        <h2 className="font-medium">Good to know</h2>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>One DM per comment, only on your own posts, within 7 days of the comment.</li>
          <li>If you used ManyChat on this account, disconnect it there first, or DMs fail.</li>
          <li>Commenters appear in Lead → List, labelled Instagram.</li>
        </ul>
      </section>
    </div>
  )
}
