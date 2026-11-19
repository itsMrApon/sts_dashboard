/**
 * Turns social profile URLs (found on a creator's website or in search results) into Links
 * accounts. Pure and client-safe. Share buttons, posts and login pages are not profiles and are
 * skipped, so only links that point at an account come back.
 */

import { socialUrl } from '@/lib/business/siteContent'

export type DetectedSocial = { platform: string; handle: string; url: string }

/** First path segments that are site pages, not profiles. */
const NOT_A_PROFILE = new Set([
  'sharer',
  'sharer.php',
  'share',
  'intent',
  'home',
  'login',
  'signup',
  'p',
  'reel',
  'reels',
  'explore',
  'watch',
  'hashtag',
  'search',
  'tr',
  'plugins',
  'dialog',
  'policies',
  'legal',
  'about',
  'help',
  'privacy',
  'terms',
])

const clean = (value: string) => decodeURIComponent(value).replace(/^@/, '').trim()

/** The platform and handle a profile URL points at, or null when it is not a profile link. */
export function detectSocialProfile(raw: string): DetectedSocial | null {
  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`)
  } catch {
    return null
  }
  const host = url.hostname.toLowerCase().replace(/^(www\.|m\.|mobile\.)/, '')
  const parts = url.pathname.split('/').filter(Boolean)
  const first = parts[0] ? clean(parts[0]) : ''
  const valid = (handle: string) => (handle && !NOT_A_PROFILE.has(handle.toLowerCase()) ? handle : '')

  const build = (platform: string, handle: string): DetectedSocial | null => {
    const value = valid(handle)
    return value ? { platform, handle: value, url: socialUrl(platform, value) } : null
  }

  if (host === 'instagram.com') return build('instagram', first)
  if (host === 'tiktok.com') return first.startsWith('@') || parts[0]?.startsWith('@') ? build('tiktok', first) : null
  if (host === 'facebook.com' || host === 'fb.com') {
    if (first === 'profile.php') return null
    return build('facebook', first === 'pages' ? clean(parts[1] ?? '') : first)
  }
  if (host === 'linkedin.com') return parts[0] === 'company' ? build('linkedin', clean(parts[1] ?? '')) : null
  if (host === 'youtube.com') {
    if (parts[0]?.startsWith('@')) return build('youtube', first)
    return null
  }
  if (host === 'x.com' || host === 'twitter.com') return build('x', first)
  if (host === 'wa.me') return build('whatsapp', first.replace(/[^\d]/g, ''))
  if (host === 'api.whatsapp.com') return build('whatsapp', (url.searchParams.get('phone') ?? '').replace(/[^\d]/g, ''))
  if (host === 't.me' || host === 'telegram.me') return build('telegram', first)
  return null
}

/** Profiles from a list of links, one per platform and handle, keeping the first seen. */
export function detectSocialProfiles(links: string[]): DetectedSocial[] {
  const seen = new Set<string>()
  const found: DetectedSocial[] = []
  for (const link of links) {
    const profile = detectSocialProfile(link)
    if (!profile) continue
    const key = `${profile.platform}:${profile.handle.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    found.push(profile)
  }
  return found
}
