import 'server-only'
import { networkInterfaces } from 'node:os'

/**
 * Base URL for links buyers open (share links, Stripe return URLs).
 *
 * In production this is NEXT_PUBLIC_BASE_URL. In development, when that points at localhost,
 * the host is swapped for this machine's network address, so a phone on the same Wi-Fi can open
 * the links (http://192.168.x.x:3000/o/...). The dev server already listens on all interfaces.
 */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/** Home / office Wi-Fi ranges. VPN addresses (e.g. Tailscale's 100.64.0.0/10) come last. */
const PRIVATE_LAN_RE = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/

function lanAddress(): string | null {
  const candidates = Object.values(networkInterfaces())
    .flatMap((addresses) => addresses ?? [])
    .filter((address) => address.family === 'IPv4' && !address.internal)
    .map((address) => address.address)
  return candidates.find((ip) => PRIVATE_LAN_RE.test(ip)) ?? candidates[0] ?? null
}

export function publicBaseUrl(): string {
  const configured = (process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/+$/, '')
  if (process.env.NODE_ENV === 'production' || !configured) return configured
  try {
    const url = new URL(configured)
    if (!LOCAL_HOSTS.has(url.hostname)) return configured
    const ip = lanAddress()
    if (!ip) return configured
    url.hostname = ip
    return url.toString().replace(/\/+$/, '')
  } catch {
    return configured
  }
}
