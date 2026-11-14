import { cn } from '@/lib/utils'
import type {
  ConfigProviderItem,
  ConfigProviderKind,
  ProviderCapability,
  ProviderKeyStatus,
} from '@/lib/usage/configProviders'

export type KeyTone = 'verified' | 'saved' | 'missing'

export function keyTone(status: ProviderKeyStatus): KeyTone {
  if (status.source === 'database') return status.validatedAt ? 'verified' : 'saved'
  return 'missing'
}

export const TONE_LABEL: Record<KeyTone, string> = {
  verified: 'Verified',
  saved: 'Saved · not verified',
  missing: 'No key',
}

const TONE_PILL: Record<KeyTone, string> = {
  verified: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  saved: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  missing: 'border-border bg-muted/60 text-muted-foreground',
}

export const TONE_DOT: Record<KeyTone, string> = {
  verified: 'bg-emerald-400',
  saved: 'bg-amber-400',
  missing: 'bg-rose-500',
}

export const KIND_LABEL: Record<ConfigProviderKind, string> = {
  llm: 'Language model',
  stt: 'Speech to text',
  tts: 'Text to speech',
}

const CAPABILITY_SHORT: Record<ProviderCapability, string> = {
  llm: 'LLM',
  stt: 'STT',
  tts: 'TTS',
  realtime: 'Realtime',
}

/** "LLM · STT · TTS · Realtime", or the single kind's long name for one-stage providers. */
export function capabilityLabel(provider: Pick<ConfigProviderItem, 'kind' | 'capabilities'>): string {
  if (provider.capabilities.length <= 1) return KIND_LABEL[provider.kind]
  return provider.capabilities.map((capability) => CAPABILITY_SHORT[capability]).join(' · ')
}

export function StatusPill({ status, className }: { status: ProviderKeyStatus; className?: string }) {
  const tone = keyTone(status)
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        TONE_PILL[tone],
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', TONE_DOT[tone])} aria-hidden />
      {TONE_LABEL[tone]}
    </span>
  )
}

export function ProviderTile({
  provider,
  size = 'md',
  className,
}: {
  provider: Pick<ConfigProviderItem, 'monogram' | 'accent' | 'name'>
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br font-semibold tracking-tight text-white shadow-sm ring-1 ring-white/10',
        provider.accent,
        size === 'sm' && 'size-7 rounded-md text-[11px]',
        size === 'md' && 'size-10 rounded-lg text-sm',
        size === 'lg' && 'size-12 rounded-xl text-base',
        className,
      )}
    >
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_60%)]" />
      <span className="relative">{provider.monogram}</span>
    </span>
  )
}

export function relativeTime(iso: string | null): string | null {
  if (!iso) return null
  const diffMs = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(diffMs)) return null
  const minutes = Math.round(diffMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}
