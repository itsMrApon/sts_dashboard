import React from 'react'
import { redirect } from 'next/navigation'
import PageHeader from '@/components/ReusableComponent/PageHeader'
import { ChevronLeft, Building2, Sparkles } from 'lucide-react'
import { onAuthenticateUser } from '@/actions/auth'
import { getOutreachChannels } from '@/actions/outreach'
import { getBusinesses } from '@/actions/business'
import { OutreachPlatform } from '@prisma/client'
import { PlatformSection } from './_components/PlatformSection'
import { AddBusinessButton } from './_components/AddBusinessButton'
import { BusinessSwitcher } from './_components/BusinessSwitcher'
import Link from 'next/link'

export type PlatformConfig = {
  platform: OutreachPlatform
  title: string
  shortLabel: string
  color: string
  description: string
  category: 'social' | 'messaging' | 'other'
  fields: { key: string; label: string; placeholder: string; type?: 'text' | 'password' }[]
  hasPageUrl?: boolean
  pageUrlLabel?: string
  pageUrlPlaceholder?: string
}

const PLATFORMS: PlatformConfig[] = [
  {
    platform: 'YOUTUBE',
    title: 'YouTube',
    shortLabel: 'YT',
    color: 'text-red-500',
    category: 'social',
    description: 'Connect your YouTube channel(s) for video-based outreach and content links.',
    fields: [
      { key: 'channelId', label: 'Channel ID', placeholder: 'UCxxxxxxxx', type: 'text' },
      { key: 'apiKey', label: 'YouTube API Key (optional)', placeholder: 'AIza…' },
    ],
    hasPageUrl: true,
    pageUrlLabel: 'Channel URL',
    pageUrlPlaceholder: 'https://youtube.com/@yourchannel',
  },
  {
    platform: 'INSTAGRAM_DM',
    title: 'Instagram',
    shortLabel: 'IG',
    color: 'text-pink-500',
    category: 'social',
    description: 'Connect your Instagram business pages for DM outreach.',
    fields: [
      { key: 'accountId', label: 'Account ID', placeholder: 'From Instagram Business settings', type: 'text' },
      { key: 'accessToken', label: 'Access Token', placeholder: 'Long-lived token' },
    ],
    hasPageUrl: true,
    pageUrlLabel: 'Profile URL',
    pageUrlPlaceholder: 'https://instagram.com/yourpage',
  },
  {
    platform: 'FACEBOOK_DM',
    title: 'Facebook',
    shortLabel: 'FB',
    color: 'text-blue-500',
    category: 'social',
    description: 'Connect your Facebook pages for Messenger outreach.',
    fields: [
      { key: 'pageId', label: 'Page ID', placeholder: 'From Facebook Page settings', type: 'text' },
      { key: 'pageAccessToken', label: 'Page Access Token', placeholder: 'Long-lived token' },
    ],
    hasPageUrl: true,
    pageUrlLabel: 'Page URL',
    pageUrlPlaceholder: 'https://facebook.com/yourpage',
  },
  {
    platform: 'TIKTOK_DM',
    title: 'TikTok',
    shortLabel: 'TK',
    color: 'text-foreground',
    category: 'social',
    description: 'Connect your TikTok business accounts.',
    fields: [
      { key: 'openId', label: 'Open ID', placeholder: 'From TikTok developer portal', type: 'text' },
      { key: 'accessToken', label: 'Access Token', placeholder: 'TikTok API token' },
    ],
    hasPageUrl: true,
    pageUrlLabel: 'Profile URL',
    pageUrlPlaceholder: 'https://tiktok.com/@yourprofile',
  },
  {
    platform: 'WHATSAPP',
    title: 'WhatsApp Business',
    shortLabel: 'WA',
    color: 'text-emerald-500',
    category: 'messaging',
    description: 'Connect WhatsApp Business accounts via Meta Business API.',
    fields: [
      { key: 'phoneNumberId', label: 'Phone Number ID', placeholder: 'From Meta Business dashboard', type: 'text' },
      { key: 'accessToken', label: 'Access Token', placeholder: 'Permanent access token' },
    ],
  },
  {
    platform: 'TELEGRAM',
    title: 'Telegram',
    shortLabel: 'TG',
    color: 'text-sky-500',
    category: 'messaging',
    description: 'Bot token for Telegram outreach (separate from Messages room bots).',
    fields: [{ key: 'botToken', label: 'Bot token', placeholder: '123456:ABC…', type: 'password' }],
  },
  {
    platform: 'WECHAT',
    title: 'WeChat',
    shortLabel: 'WC',
    color: 'text-green-600',
    category: 'messaging',
    description:
      'WeChat ID or name plus a link (Official Account, mini-program, or QR landing page) for customers.',
    fields: [],
    hasPageUrl: true,
    pageUrlLabel: 'WeChat / Weixin link',
    pageUrlPlaceholder: 'https://…',
  },
  {
    platform: 'EMAIL',
    title: 'Email',
    shortLabel: 'EM',
    color: 'text-purple-500',
    category: 'messaging',
    description: 'Track email accounts used for outreach. Gmail OAuth is configured in the n8n dashboard.',
    fields: [
      { key: 'email', label: 'Email Address', placeholder: 'you@gmail.com', type: 'text' },
    ],
  },
  {
    platform: 'WEBSITE',
    title: 'Website',
    shortLabel: 'WB',
    color: 'text-cyan-500',
    category: 'other',
    description: 'Add your business websites to include in outreach messages and track traffic.',
    fields: [],
    hasPageUrl: true,
    pageUrlLabel: 'Website URL',
    pageUrlPlaceholder: 'https://yourbusiness.com',
  },
]

type PageProps = {
  searchParams: Promise<{ businessId?: string }>
}

const page = async ({ searchParams }: PageProps) => {
  const auth = await onAuthenticateUser()
  if (!auth.user) redirect('/sign-in')

  const { businessId: queryBusinessId } = await searchParams
  const businesses = await getBusinesses()

  const activeBusinessId =
    queryBusinessId && businesses.some((b) => b.id === queryBusinessId)
      ? queryBusinessId
      : businesses[0]?.id

  const channels = activeBusinessId ? await getOutreachChannels(activeBusinessId) : []

  const socialPlatforms = PLATFORMS.filter((p) => p.category === 'social')
  const messagingPlatforms = PLATFORMS.filter((p) => p.category === 'messaging')
  const otherPlatforms = PLATFORMS.filter((p) => p.category === 'other')

  return (
    <div className="w-full flex flex-col gap-8">
      <PageHeader
        leftIcon={<ChevronLeft className="w-3 h-3" />}
        mainIcon={<Building2 className="w-12 h-12" />}
        rightIcon={<Sparkles className="w-4 h-4" />}
        heading="Business Profile"
        placeholder="Search channels…"
      >
        <div className="flex flex-wrap items-center justify-end gap-2 w-full">
          <Link
            href="/tenants"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Tenants
          </Link>
          <AddBusinessButton />
        </div>
      </PageHeader>

      {businesses.length > 0 && activeBusinessId && (
        <BusinessSwitcher
          businesses={businesses.map((b) => ({ id: b.id, name: b.name }))}
          activeBusinessId={activeBusinessId}
          defaultBusinessId={businesses[0]?.id ?? null}
        />
      )}

      <p className="text-sm text-muted-foreground -mt-4">
        Connect accounts for the selected business. They are used in AI context (Messages) and optional n8n flows.
      </p>

      {!activeBusinessId && (
        <p className="text-sm text-amber-600 dark:text-amber-500">
          Add a business in your workspace before connecting channels.
        </p>
      )}

      {activeBusinessId && (
        <div className="flex flex-col gap-10">
          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">
              Social Platforms
            </h2>
            <div className="flex flex-col gap-6">
              {socialPlatforms.map((config) => (
                <PlatformSection
                  key={config.platform}
                  config={config}
                  businessId={activeBusinessId}
                  connectedAccounts={channels.filter((c) => c.platform === config.platform)}
                />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">
              Messaging
            </h2>
            <div className="flex flex-col gap-6">
              {messagingPlatforms.map((config) => (
                <PlatformSection
                  key={config.platform}
                  config={config}
                  businessId={activeBusinessId}
                  connectedAccounts={channels.filter((c) => c.platform === config.platform)}
                />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">
              Other
            </h2>
            <div className="flex flex-col gap-6">
              {otherPlatforms.map((config) => (
                <PlatformSection
                  key={config.platform}
                  config={config}
                  businessId={activeBusinessId}
                  connectedAccounts={channels.filter((c) => c.platform === config.platform)}
                />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

export default page
