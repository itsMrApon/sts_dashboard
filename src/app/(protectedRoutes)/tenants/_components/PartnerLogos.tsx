import type { ComponentType } from 'react'

export function MedusaLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="text-violet-600" aria-hidden>
      <path d="M12 2c-2.8 0-5 2.1-5 4.8 0 1.4.6 2.6 1.6 3.5-.9.8-1.6 1.9-1.6 3.3 0 1.7 1 3.1 2.5 3.9C8.6 19.3 10.1 21 12 21s3.4-1.7 4.5-3.5c1.5-.8 2.5-2.2 2.5-3.9 0-1.4-.6-2.5-1.6-3.3 1-.9 1.6-2.1 1.6-3.5C17 4.1 14.8 2 12 2zm0 2c1.7 0 3 1.2 3 2.8S13.7 9.6 12 9.6 9 8.4 9 6.8 10.3 4 12 4zm-3.2 8.6c.7-.4 1.6-.6 3.2-.6s2.5.2 3.2.6c.5.3.8.8.8 1.5 0 .9-.7 1.7-1.7 1.9l-.6.1-.3.6C12.9 17.8 12.4 19 12 19s-.9-1.2-1.4-2.3l-.3-.6-.6-.1c-1-.2-1.7-1-1.7-1.9 0-.7.3-1.2.8-1.5z" />
    </svg>
  )
}

export function ErpnextLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="text-blue-600" aria-hidden>
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path
        d="M7.5 13.2c1.4 2.2 3.1 3.3 4.5 3.3 2.4 0 4.5-2.2 4.5-4.7S14.4 7 12 7c-1.5 0-2.8.7-3.6 1.8"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="8.2" cy="11.2" r="1.2" fill="white" />
    </svg>
  )
}

export function N8nLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="text-red-500" aria-hidden>
      <circle cx="6.5" cy="12" r="3" />
      <circle cx="17.5" cy="7" r="3" />
      <circle cx="17.5" cy="17" r="3" />
      <path
        d="M9.2 12h5.1M14.8 8.6l-4.2 2.6M14.8 15.4l-4.2-2.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  )
}

export function ChatwootLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="text-teal-600" aria-hidden>
      <path d="M4 5.5A3.5 3.5 0 0 1 7.5 2h9A3.5 3.5 0 0 1 20 5.5v7A3.5 3.5 0 0 1 16.5 16H11l-4.2 3.2c-.8.6-1.8-.2-1.6-1.2L6 16h-.5A2.5 2.5 0 0 1 3 13.5v-4A4 4 0 0 1 4 5.5z" />
      <circle cx="9" cy="9" r="1.2" fill="white" />
      <circle cx="12.5" cy="9" r="1.2" fill="white" />
      <circle cx="16" cy="9" r="1.2" fill="white" />
    </svg>
  )
}

export function FirecrawlLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="text-orange-500" aria-hidden>
      <path d="M13.2 2.2c.3 2.4-.4 4.2-1.8 5.8 2.3-.3 4.3-1.8 5.4-3.9 1.8 3.2 1.4 6.6-.4 9.1 1.2-.2 2.3-.8 3.2-1.7.2 3.6-2 7.3-6.1 9.1-3.6 1.6-7.8.8-10.2-2.2C1.4 16.1 2 12 4.6 9.4c.8 2.1 2.3 3.4 4.1 3.8C7.6 8.8 9.3 5 13.2 2.2z" />
    </svg>
  )
}

export function CustomMcpLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="text-emerald-600" aria-hidden>
      <path d="M8 4h3v3H8V4zm5 0h3v3h-3V4zM8 17h3v3H8v-3zm5 0h3v3h-3v-3zM4 8h3v3H4V8zm13 0h3v3h-3V8zM4 13h3v3H4v-3zm13 0h3v3h-3v-3zM9.5 9.5h5v5h-5v-5z" />
    </svg>
  )
}

const PARTNER_LOGOS: Record<string, ComponentType> = {
  medusa: MedusaLogo,
  erpnext: ErpnextLogo,
  n8n: N8nLogo,
  chatwoot: ChatwootLogo,
  firecrawl: FirecrawlLogo,
  custom: CustomMcpLogo,
}

export function PartnerLogo({ kind }: { kind: string }) {
  const Logo = PARTNER_LOGOS[kind] ?? CustomMcpLogo
  return <Logo />
}
