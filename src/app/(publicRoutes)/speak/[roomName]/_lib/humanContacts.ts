/** "Talk to a person" contacts for Speak: the business's WhatsApp, Messenger, Telegram and WeChat. */

export type SocialAccountInput = { platform: string; label: string; url?: string }

type ContactPlatform = 'WHATSAPP' | 'TELEGRAM' | 'MESSENGER' | 'WECHAT'

export type HumanContactRow = {
  id: string
  displayKind: 'WhatsApp' | 'Messenger' | 'Telegram' | 'WeChat'
  label: string
  web: string
  appScheme: string | null
  /** `tel:` link when the label or chat URL implies a phone number. */
  telHref: string | null
  keywords: string[]
}

function dialTelFromLabel(label: string): string | null {
  const digits = label.replace(/\D/g, '')
  if (digits.length < 8) return null
  return `tel:+${digits}`
}

function dialTelFromWaMeUrl(web: string): string | null {
  const m = web.match(/wa\.me\/(\d{8,})/i)
  if (!m) return null
  return `tel:+${m[1]}`
}
function normalizeUrl(value?: string): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  return `https://${trimmed}`
}

function buildWeChatLink(account?: { label: string; url?: string }): string | null {
  const rawUrl = normalizeUrl(account?.url)
  if (rawUrl) return rawUrl
  const label = (account?.label || '').trim()
  if (!label) return null
  if (label.startsWith('http://') || label.startsWith('https://')) return normalizeUrl(label)
  return null
}

function buildContactLink(platform: ContactPlatform, account?: { label: string; url?: string }): string | null {
  if (platform === 'WECHAT') {
    return buildWeChatLink(account)
  }

  const rawUrl = normalizeUrl(account?.url)
  if (rawUrl) return rawUrl

  const label = (account?.label || '').trim()
  if (!label) return null

  if (platform === 'WHATSAPP') {
    const phone = label.replace(/[^\d+]/g, '')
    if (!phone) return null
    return `https://wa.me/${phone.replace('+', '')}`
  }

  if (platform === 'TELEGRAM') {
    const username = label.replace(/^@/, '')
    return username ? `https://t.me/${username}` : null
  }

  const pageId = label.replace(/^@/, '')
  return pageId ? `https://m.me/${pageId}` : null
}


/**
 * Prefer opening the native app on mobile via custom scheme (does not navigate this page).
 * If the tab stays visible, fall back to the HTTPS link (opens chat / call entry in browser or app).
 */
export function openMessagingTarget(webUrl: string, appScheme: string | null) {
  if (typeof window === 'undefined' || !webUrl) return
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '')
  if (appScheme && mobile) {
    const a = document.createElement('a')
    a.href = appScheme
    a.rel = 'noopener noreferrer'
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.setTimeout(() => {
      if (document.visibilityState === 'visible') {
        window.open(webUrl, '_blank', 'noopener,noreferrer')
      }
    }, 800)
    return
  }
  window.open(webUrl, '_blank', 'noopener,noreferrer')
}

export function humanRowsFromSocial(
  accounts: SocialAccountInput[],
): HumanContactRow[] {
  const rows: HumanContactRow[] = []
  let n = 0

  for (const s of accounts) {
    const pl = (s.label || '').trim()
    const hasUrl = Boolean((s.url || '').trim())
    if (!pl && !hasUrl) continue

    if (s.platform === 'WHATSAPP') {
      const web = buildContactLink('WHATSAPP', s)
      if (!web) continue
      const digits = pl.replace(/\D/g, '')
      const appScheme =
        digits.length >= 8 ? `whatsapp://send?phone=${digits.replace(/^\+/, '')}` : null
      const telHref = dialTelFromLabel(pl) || dialTelFromWaMeUrl(web)
      rows.push({
        id: `wa-${n++}`,
        displayKind: 'WhatsApp',
        label: pl || 'WhatsApp',
        web,
        appScheme,
        telHref,
        keywords: [pl, 'whatsapp', 'wa', digits, web, 'dial', 'call', telHref || ''].filter(
          Boolean,
        ),
      })
      continue
    }

    if (
      s.platform === 'FACEBOOK_DM' ||
      s.platform === 'FACEBOOK_MESSENGER' ||
      s.platform === 'MESSENGER'
    ) {
      const web = buildContactLink('MESSENGER', s)
      if (!web) continue
      const telHref = dialTelFromLabel(pl)
      rows.push({
        id: `ms-${n++}`,
        displayKind: 'Messenger',
        label: pl || 'Messenger',
        web,
        appScheme: null,
        telHref,
        keywords: [pl, 'messenger', 'facebook', 'fb', web, 'dial', 'call', telHref || ''].filter(
          Boolean,
        ),
      })
      continue
    }

    if (s.platform === 'TELEGRAM') {
      const web = buildContactLink('TELEGRAM', s)
      if (!web) continue
      const username = pl.replace(/^@/, '').replace(/.*t\.me\//i, '').split('/')[0] || pl
      const appScheme = username ? `tg://resolve?domain=${encodeURIComponent(username)}` : null
      const telHref = dialTelFromLabel(pl)
      rows.push({
        id: `tg-${n++}`,
        displayKind: 'Telegram',
        label: pl || 'Telegram',
        web,
        appScheme,
        telHref,
        keywords: [pl, username, 'telegram', 'tg', web, 'dial', 'call', telHref || ''].filter(
          Boolean,
        ),
      })
      continue
    }

    if (s.platform === 'WECHAT') {
      const web = buildContactLink('WECHAT', s)
      if (!web) continue
      const telHref = dialTelFromLabel(pl)
      rows.push({
        id: `wx-${n++}`,
        displayKind: 'WeChat',
        label: pl || 'WeChat',
        web,
        appScheme: null,
        telHref,
        keywords: [pl, 'wechat', 'weixin', '微信', web, 'dial', 'call', telHref || ''].filter(
          Boolean,
        ),
      })
    }
  }

  const order: Record<HumanContactRow['displayKind'], number> = {
    WhatsApp: 0,
    Messenger: 1,
    Telegram: 2,
    WeChat: 3,
  }
  rows.sort((a, b) => order[a.displayKind] - order[b.displayKind])
  return rows
}
