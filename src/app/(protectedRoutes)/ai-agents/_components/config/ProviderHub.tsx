'use client'

import Link from 'next/link'
import { useCallback, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { getProviderKeyStatuses } from '@/actions/voiceCredentials'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { SakugaTabs } from '@/components/sakuga/SakugaTabs'
import type { AgentEngine } from '@/lib/agents/engineOptions'
import {
  CONFIG_PROVIDERS,
  configProviderById,
  type ConfigCredentialProvider,
  type ConfigProviderItem,
  type ProviderCapability,
  type ProviderKeyStatus,
} from '@/lib/usage/configProviders'
import { cn } from '@/lib/utils'
import ConfigUsageDashboard from '../ConfigUsageDashboard'
import { ProviderKeySheet } from './ProviderKeySheet'
import { EngineComposer } from './EngineComposer'
import { KIND_LABEL, capabilityLabel, ProviderTile, StatusPill, keyTone, relativeTime } from './providerUi'

type StatusMap = Record<ConfigCredentialProvider, ProviderKeyStatus>
type Filter = 'all' | 'llm' | 'voice' | 'attention'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'llm', label: 'Language models' },
  { value: 'voice', label: 'Speech & voice' },
  { value: 'attention', label: 'Needs attention' },
]

const CAPABILITY_LINES: Record<ProviderCapability, string> = {
  llm: 'Thinks: the language model in Pipeline mode.',
  stt: 'Hears: speech to text in Pipeline mode.',
  tts: 'Speaks: text to speech in Pipeline mode.',
  realtime: 'Realtime mode: hears, thinks and speaks as one model.',
}

/** Where each provider is used right now, given the account's saved engine. */
function rolesFor(id: ConfigCredentialProvider, engine: AgentEngine): string[] {
  const roles: string[] = []
  if (id === 'google') roles.push('Chat & leads')
  if (engine.mode === 'realtime') {
    if (engine.realtimeProvider === id) roles.push('Realtime voice')
    return roles
  }
  if (engine.sttProvider === id) roles.push('Hears calls')
  if (engine.llmProvider === id) roles.push('Thinks')
  if (engine.voiceProvider === id) roles.push('Speaks')
  return roles
}

function usedForLines(id: ConfigCredentialProvider, engine: AgentEngine): string[] {
  const lines: string[] = []
  if (id === 'google') {
    lines.push('Chat replies, lead scoring, web research, meeting chat and the workspace assistant. These always run on Gemini.')
  }
  const active = rolesFor(id, engine).filter((role) => role !== 'Chat & leads')
  if (active.length) lines.push(`In use right now: ${active.join(', ').toLowerCase()} on every voice call.`)
  for (const capability of configProviderById(id).capabilities) lines.push(CAPABILITY_LINES[capability])
  if (id === 'fish' || id === 'cartesia' || id === 'elevenlabs') lines.push('Browsing your own and cloned voices in the voice picker.')
  return lines
}

function needsAttention(id: ConfigCredentialProvider, status: ProviderKeyStatus, engine: AgentEngine) {
  const tone = keyTone(status)
  return tone === 'saved' || (tone === 'missing' && rolesFor(id, engine).length > 0)
}

function ProviderCard({
  provider,
  status,
  roles,
  onOpen,
}: {
  provider: ConfigProviderItem
  status: ProviderKeyStatus
  roles: string[]
  onOpen: () => void
}) {
  const missingButUsed = !status.hasKey && roles.length > 0
  const verifiedAgo = relativeTime(status.validatedAt)
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'group relative flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        missingButUsed ? 'border-rose-500/40' : 'border-border hover:border-primary/30',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute -top-10 -right-10 size-28 rounded-full bg-gradient-to-br opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-30',
          provider.accent,
        )}
      />
      <span className="relative flex items-start gap-3">
        <ProviderTile provider={provider} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{provider.name}</span>
          <span className="block text-[11px] text-muted-foreground">{capabilityLabel(provider)}</span>
        </span>
        <StatusPill status={status} />
      </span>
      <span className="relative mt-3 line-clamp-2 min-h-8 text-xs text-muted-foreground">{provider.tagline}</span>
      <span className="relative mt-4 flex items-center justify-between gap-2 border-t border-border/60 pt-3">
        <span className="min-w-0 truncate font-mono text-[11px] text-muted-foreground">
          {status.masked ?? (missingButUsed ? 'Required, add a key' : 'Not connected')}
        </span>
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {verifiedAgo ? `checked ${verifiedAgo}` : null}
        </span>
      </span>
      {roles.length ? (
        <span className="relative mt-2 flex flex-wrap gap-1">
          {roles.map((role) => (
            <span
              key={role}
              className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary/90"
            >
              {role}
            </span>
          ))}
        </span>
      ) : null}
    </button>
  )
}

export default function ProviderHub({
  initialStatuses,
  initialEngine,
  initialVoiceLabel,
  savedBefore,
  agentCount,
  initialOpenProvider,
}: {
  initialStatuses: StatusMap
  initialEngine: AgentEngine
  initialVoiceLabel: string | null
  savedBefore: boolean
  agentCount: number
  initialOpenProvider: ConfigCredentialProvider | null
}) {
  const [statuses, setStatuses] = useState<StatusMap>(initialStatuses)
  // The saved (live) engine drives the "in use" badges; drafts live inside EngineComposer.
  const [engine, setEngine] = useState<AgentEngine>(initialEngine)
  const [voiceLabel, setVoiceLabel] = useState<string | null>(initialVoiceLabel)
  const [openId, setOpenId] = useState<ConfigCredentialProvider | null>(initialOpenProvider)
  const [sheetOpen, setSheetOpen] = useState(Boolean(initialOpenProvider))
  const [filter, setFilter] = useState<Filter>('all')
  const [section, setSection] = useState('providers')
  const [query, setQuery] = useState('')

  const refresh = useCallback(async () => {
    const res = await getProviderKeyStatuses()
    if (res.ok) setStatuses(res.statuses)
  }, [])

  const syncUrl = (id: ConfigCredentialProvider | null) => {
    const url = new URL(window.location.href)
    if (id) url.searchParams.set('provider', id)
    else url.searchParams.delete('provider')
    window.history.replaceState(null, '', url)
  }

  const openProvider = (id: ConfigCredentialProvider) => {
    setOpenId(id)
    setSheetOpen(true)
    syncUrl(id)
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return CONFIG_PROVIDERS.filter((item) => {
      if (filter === 'llm' && !item.capabilities.includes('llm')) return false
      if (filter === 'voice' && !item.capabilities.some((capability) => capability !== 'llm')) return false
      if (filter === 'attention' && !needsAttention(item.id, statuses[item.id], engine)) return false
      if (!q) return true
      return `${item.name} ${item.kind} ${KIND_LABEL[item.kind]} ${item.tagline}`.toLowerCase().includes(q)
    })
  }, [filter, query, statuses, engine])

  const attentionCount = CONFIG_PROVIDERS.filter((item) => needsAttention(item.id, statuses[item.id], engine)).length
  const connectedCount = CONFIG_PROVIDERS.filter((item) => statuses[item.id].hasKey).length
  const openProviderItem = openId ? configProviderById(openId) : null

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 p-4 text-primary md:p-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/ai-agents"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Agents
        </Link>
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground tabular-nums">{connectedCount}</span> of{' '}
          {CONFIG_PROVIDERS.length} providers connected
        </p>
      </div>

      <EngineComposer
        engine={engine}
        voiceLabel={voiceLabel}
        savedBefore={savedBefore}
        agentCount={agentCount}
        statuses={statuses}
        onOpenKey={openProvider}
        onSaved={(nextEngine, nextVoiceLabel) => {
          setEngine(nextEngine)
          setVoiceLabel(nextVoiceLabel)
        }}
      />

      <Tabs value={section} onValueChange={setSection} className="gap-4">
        <SakugaTabs
          label="Provider sections"
          value={section}
          onChange={setSection}
          options={[
            { value: 'providers', label: 'Providers' },
            { value: 'usage', label: 'Usage' },
          ]}
        />

        <TabsContent value="providers" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div
              role="radiogroup"
              aria-label="Filter providers"
              className="-mx-1 flex min-w-0 gap-1.5 overflow-x-auto px-1 py-0.5 [scrollbar-width:none]"
            >
              {FILTERS.map((option) => {
                const active = filter === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setFilter(option.value)}
                    className={cn(
                      'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                      active
                        ? 'border-primary/40 bg-primary/15 text-foreground'
                        : 'border-border text-muted-foreground hover:border-primary/30 hover:text-foreground',
                    )}
                  >
                    {option.label}
                    {option.value === 'attention' && attentionCount ? (
                      <span className="rounded-full bg-rose-500/20 px-1.5 text-[10px] text-rose-400 tabular-nums">
                        {attentionCount}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
            <div className="relative shrink-0 sm:w-56">
              <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" aria-hidden />
              <Input
                placeholder="Search providers"
                aria-label="Search providers"
                className="pl-9"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>

          {visible.length ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {visible.map((item) => (
                <ProviderCard
                  key={item.id}
                  provider={item}
                  status={statuses[item.id]}
                  roles={rolesFor(item.id, engine)}
                  onOpen={() => openProvider(item.id)}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              {filter === 'attention' ? 'Nothing needs attention. Every provider in use has a working key.' : 'No providers match.'}
            </p>
          )}
        </TabsContent>

        <TabsContent value="usage">
          <ConfigUsageDashboard />
        </TabsContent>
      </Tabs>

      <ProviderKeySheet
        provider={openProviderItem}
        status={openId ? statuses[openId] : null}
        usedFor={openId ? usedForLines(openId, engine) : []}
        open={sheetOpen}
        onOpenChange={(next) => {
          setSheetOpen(next)
          if (!next) syncUrl(null)
        }}
        onChanged={refresh}
      />
    </div>
  )
}
