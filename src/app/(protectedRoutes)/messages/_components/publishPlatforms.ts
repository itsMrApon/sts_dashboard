import { OutreachPlatform } from '@prisma/client'
import type { ContextPlatformConfig } from './publishTypes'

export type PublishPlatformConfig = ContextPlatformConfig & {
  platform: OutreachPlatform
}

export const PUBLISH_PLATFORMS: PublishPlatformConfig[] = [
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
    description: 'Bot token for Telegram outreach.',
    fields: [{ key: 'botToken', label: 'Bot token', placeholder: '123456:ABC…', type: 'password' }],
  },
  {
    platform: 'EMAIL',
    title: 'Email',
    shortLabel: 'EM',
    color: 'text-purple-500',
    category: 'messaging',
    description: 'Track email accounts used for outreach.',
    fields: [{ key: 'email', label: 'Email Address', placeholder: 'you@gmail.com', type: 'text' }],
  },
  {
    platform: 'WEBSITE',
    title: 'Website',
    shortLabel: 'WB',
    color: 'text-cyan-500',
    category: 'other',
    description: 'Add business websites for outreach and public API context.',
    fields: [],
    hasPageUrl: true,
    pageUrlLabel: 'Website URL',
    pageUrlPlaceholder: 'https://yourbusiness.com',
  },
]

export function publishPlatformGroups() {
  return {
    socialPlatforms: PUBLISH_PLATFORMS.filter((p) => p.category === 'social'),
    messagingPlatforms: PUBLISH_PLATFORMS.filter((p) => p.category === 'messaging'),
    otherPlatforms: PUBLISH_PLATFORMS.filter((p) => p.category === 'other'),
  }
}
