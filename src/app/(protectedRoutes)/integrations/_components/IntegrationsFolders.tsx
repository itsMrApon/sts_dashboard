'use client'

import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import { ChevronRight, FileUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import Riffle from '@/components/ui/hairline-riffle'
import { PageViewport } from '@/components/ReusableComponent/PageViewport'
import { ConnectAgentButton } from '@/components/agent/ConnectAgentButton'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PARTNER_PRESETS } from '@/lib/partners/partnerPresets'
import { normalizePartnerKind } from '@/lib/tenants/tenantServices'
import { PartnerLogo } from './PartnerLogos'

export type ConnectedPartnerOption = { id: string; kind: string; label: string }

type Props = {
  workspaceId: string | null
  connectedPartners?: ConnectedPartnerOption[]
  /** The creator's Telegram bot is set up and linked to a chat. */
  telegramLinked?: boolean
  /** The creator's Twilio number is answered by their Voice AI. */
  phoneNumber?: string | null
  leadSources?: { fathomOk: boolean; googleOk: boolean; gcalLinked: boolean; serperOk: boolean }
  /** Platform owners only: the trigger.dev project that runs everyone's background jobs. */
  triggerDev?: { connected: boolean } | null
  /** The creator's WhatsApp number when connected ("Connected" when Kapso gave no number). */
  whatsApp?: string | null
  instagram?: string | null
  email?: string | null
}

type Item = { title: string; description: string; href: string; status: string | null; logo: ReactNode }
/** `counted: false` for a folder with nothing to connect (Imports): no "0 of 1 connected". */
type Folder = { key: string; label: string; hint: string; items: Item[]; note?: ReactNode; counted?: boolean }

function introKind(kind: string): string {
  const normalized = normalizePartnerKind(kind)
  return normalized === 'custom' || normalized.startsWith('custom:') ? 'custom' : normalized
}

/**
 * /integrations: the same folder tray as /lead, /social and /services. One folder per group
 * (Channels, Lead sources, Imports, Partner apps, and Platform for owners); a folder opens its
 * list, each row going to that integration's page. The partner assistant lives in Messages.
 */
export function IntegrationsFolders({
  workspaceId,
  connectedPartners = [],
  telegramLinked = false,
  phoneNumber = null,
  leadSources,
  triggerDev = null,
  whatsApp = null,
  instagram = null,
  email = null,
}: Props) {
  const [pulled, setPulled] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const connectedKinds = new Set(connectedPartners.map((partner) => introKind(partner.kind)))
  const partnersHref = (kind: string) => {
    const params = new URLSearchParams({ kind })
    if (workspaceId) params.set('tenantId', workspaceId)
    return `/integrations/partners?${params.toString()}`
  }

  const folders: Folder[] = [
    {
      key: 'channels',
      label: 'Channels',
      hint: 'where customers reach you',
      items: [
        { title: 'Telegram', description: 'Buyer chats on your phone or in a team group, answered from Telegram', href: '/integrations/telegram', status: telegramLinked ? 'Connected' : null, logo: <PartnerLogo kind="telegram" /> },
        { title: 'Phone', description: phoneNumber ? `Your Voice AI answers ${phoneNumber}` : 'Your Voice AI answers calls to your own Twilio number', href: '/integrations/phone', status: phoneNumber ? 'Connected' : null, logo: <PartnerLogo kind="twilio" /> },
        { title: 'WhatsApp', description: whatsApp ? `Your Chat AI answers ${whatsApp}` : 'Your Chat AI answers your own WhatsApp number (Kapso)', href: '/integrations/whatsapp', status: whatsApp ? 'Connected' : null, logo: <PartnerLogo kind="whatsapp" /> },
        { title: 'Instagram', description: instagram ? `Comment keywords on @${instagram} send a DM and make a lead` : 'Comment a keyword, get a DM: commenters become leads', href: '/integrations/instagram', status: instagram ? 'Connected' : null, logo: <PartnerLogo kind="instagram" /> },
        { title: 'Email', description: email ? `Form answers, reviews and reminders send from ${email}` : 'Send form answers, review requests and reminders from your own address', href: '/integrations/email', status: email ? 'Connected' : null, logo: <PartnerLogo kind="email" /> },
      ],
    },
    {
      key: 'leads',
      label: 'Lead sources',
      hint: 'your accounts that bring in calls and businesses',
      items: [
        { title: 'Fathom', description: 'Recorded calls and their summaries come in as leads', href: '/integrations/fathom', status: leadSources?.fathomOk ? 'Connected' : null, logo: <PartnerLogo kind="fathom" /> },
        { title: 'Google OAuth', description: 'Link Google Calendar and schedule Meet calls with leads', href: '/integrations/google', status: leadSources?.gcalLinked ? 'Calendar linked' : leadSources?.googleOk ? 'Saved' : null, logo: <PartnerLogo kind="google" /> },
        { title: 'Serper', description: 'Find businesses on Google Maps for your outreach', href: '/integrations/serper', status: leadSources?.serperOk ? 'Connected' : null, logo: <PartnerLogo kind="serper" /> },
      ],
    },
    {
      key: 'imports',
      label: 'Imports',
      hint: 'leads in from a file or another app',
      counted: false,
      items: [
        { title: 'Lead imports', description: 'CSV, Sellbird and n8n webhooks bring leads in. Export is on the lead list', href: '/lead', status: null, logo: <FileUp className="text-violet-500" aria-hidden /> },
      ],
    },
    {
      key: 'partners',
      label: 'Partner apps',
      hint: 'apps sts-ai calls while it works',
      note: workspaceId ? (
        'Ask them anything from the partner assistant, pinned in Messages (top right).'
      ) : (
        <>
          Partners attach to your Messages room.{' '}
          <Link href="/services" className="text-foreground font-medium underline">
            Create a room
          </Link>{' '}
          first, then come back to connect.
        </>
      ),
      items: PARTNER_PRESETS.map((preset) => ({
        title: preset.label,
        description: preset.description,
        href: partnersHref(preset.kind),
        status: connectedKinds.has(preset.kind) ? 'Connected' : null,
        logo: <PartnerLogo kind={preset.kind} />,
      })),
    },
    ...(triggerDev
      ? [
          {
            key: 'platform',
            label: 'Platform',
            hint: 'settings for all of sts-ai (owners only)',
            items: [
              { title: 'Background jobs', description: "trigger.dev or Inngest runs every creator's scheduled jobs", href: '/integrations/trigger', status: triggerDev.connected ? 'Connected' : null, logo: <PartnerLogo kind="trigger" /> },
            ],
          },
        ]
      : []),
  ]

  const connectedCount = (folder: Folder) => folder.items.filter((item) => item.status).length
  const pulledFolder = folders.find((f) => f.key === pulled) ?? null
  const openFolder = folders.find((f) => f.key === open) ?? null

  return (
    <PageViewport bottomPad={16}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 justify-center">
          <ConnectAgentButton />
        </div>
        <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto overscroll-contain pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-full max-w-xl flex-col items-center">
            <Riffle
              aria-label="Integrations, as folders. Hover or use the arrow keys to pull one, then click or press Enter to open it."
              labels={folders.map((f) => f.label)}
              className="text-foreground w-full max-w-[min(28rem,50dvh)]"
              onRead={(text) => {
                const n = Number(text)
                setPulled(Number.isInteger(n) && n >= 1 ? (folders[n - 1]?.key ?? null) : null)
              }}
              onPick={(card) => {
                const folder = folders[card - 1]
                if (folder) setOpen(folder.key)
              }}
            />

            <p className="text-muted-foreground -mt-2 min-h-5 text-center text-sm" aria-hidden="true">
              {pulledFolder ? (
                <>
                  <span className="text-foreground font-medium">{pulledFolder.label}</span> · {pulledFolder.hint}
                  {pulledFolder.counted === false
                    ? ''
                    : ` · ${connectedCount(pulledFolder)} of ${pulledFolder.items.length} connected`}
                </>
              ) : (
                'Pull a folder to see what it opens'
              )}
            </p>

            {/* The same folders as buttons, for touch and keyboard. */}
            <ul className="mt-5 flex flex-wrap justify-center gap-2" aria-label="Integration groups">
              {folders.map((folder) => (
                <li key={folder.key}>
                  <button
                    type="button"
                    onClick={() => setOpen(folder.key)}
                    onMouseEnter={() => setPulled(folder.key)}
                    className={cn(
                      'border-border bg-background hover:bg-muted inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition-colors',
                      'focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none',
                      pulled === folder.key && 'border-foreground/40',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'size-1.5 rounded-full',
                        folder.counted === false || connectedCount(folder) > 0 ? 'bg-emerald-500' : 'bg-muted-foreground/40',
                      )}
                    />
                    {folder.label}
                    {folder.counted === false ? null : (
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {connectedCount(folder)}/{folder.items.length}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <Dialog open={Boolean(openFolder)} onOpenChange={(next) => !next && setOpen(null)}>
        <DialogContent className="gap-4 sm:max-w-lg">
          {openFolder ? (
            <>
              <DialogHeader>
                <DialogTitle>{openFolder.label}</DialogTitle>
                <DialogDescription>{openFolder.note ?? `${openFolder.hint[0].toUpperCase()}${openFolder.hint.slice(1)}.`}</DialogDescription>
              </DialogHeader>
              <ul className="divide-border -mx-1 max-h-[60dvh] divide-y overflow-y-auto">
                {openFolder.items.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="hover:bg-muted flex items-center gap-3 rounded-md px-1 py-2.5">
                      <span className="grid size-9 flex-none place-items-center rounded-md border border-border [&_svg]:size-5">{item.logo}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-sm font-medium">
                          {item.title}
                          {item.status ? (
                            <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-500">{item.status}</span>
                          ) : null}
                        </span>
                        <span className="text-muted-foreground block truncate text-xs">{item.description}</span>
                      </span>
                      <ChevronRight className="text-muted-foreground size-4 flex-none" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </PageViewport>
  )
}
